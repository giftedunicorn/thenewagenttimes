import type {
  NewsIngestionSkippedByReason,
  NewsSourceHealthSummary,
  NewsSourceRefreshResult,
} from "@acme/ingestion";

export interface NewsRefreshSummary {
  sourcesSeeded: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  skippedByReason: NewsIngestionSkippedByReason;
  results: readonly NewsSourceRefreshResult[];
  sourceHealth: NewsSourceHealthSummary;
}

interface HandleNewsRefreshRequestInput {
  expectedSecret: string | undefined;
  refresh: () => Promise<NewsRefreshSummary>;
  request: Request;
}

type NewsRefreshNextStep =
  | "embed-news-stories"
  | "inspect-source-failures"
  | "ready"
  | "seed-news-sources";

const newsRefreshCommands = {
  embed: "pnpm run news:embed:remote",
  refresh: "pnpm run news:refresh:remote",
  seedSources: "pnpm run news:seed-sources",
} as const;

const readRequestSecret = (request: Request) => {
  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  return (
    bearerMatch?.[1] ??
    request.headers.get("x-news-refresh-secret") ??
    undefined
  );
};

const getNewsRefreshErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown news refresh failure";

const getNewsRefreshNextStep = (
  result: NewsRefreshSummary,
): NewsRefreshNextStep => {
  if (result.sourcesSeeded === 0) return "seed-news-sources";
  if (result.sourcesFailed > 0) return "inspect-source-failures";
  if (result.itemsCreated + result.itemsUpdated > 0) {
    return "embed-news-stories";
  }

  return "ready";
};

const getNewsRefreshFailedSourceDiagnostics = (result: NewsRefreshSummary) => {
  const failedSources = result.sourceHealth.failedSourceSlugs
    .map((slug) => {
      const message = result.sourceHealth.failureMessages[slug];

      return message ? `${slug} (${message})` : slug;
    })
    .join(", ");
  const emptySources =
    result.sourceHealth.emptySourceSlugs.length > 0
      ? ` Empty sources: ${result.sourceHealth.emptySourceSlugs
          .map((slug) => {
            const message = result.sourceHealth.emptyReasonMessages[slug];

            return message ? `${slug} (${message})` : slug;
          })
          .join(", ")}.`
      : "";

  return `Inspect failed news sources: ${failedSources}.${emptySources} Rerun pnpm run news:refresh:remote after fixing source issues.`;
};

const getNewsRefreshActionRequired = (
  nextStep: NewsRefreshNextStep,
  result: NewsRefreshSummary,
) => {
  switch (nextStep) {
    case "embed-news-stories":
      return [
        "Run pnpm run news:embed:remote so semantic recommendations include refreshed stories.",
      ];
    case "inspect-source-failures":
      return [getNewsRefreshFailedSourceDiagnostics(result)];
    case "seed-news-sources":
      return [
        "Run pnpm run news:refresh:remote so the deployed service seeds sources before ingesting stories.",
      ];
    case "ready":
      return [];
  }
};

const getNewsRefreshCommandForNextStep = (nextStep: NewsRefreshNextStep) => {
  switch (nextStep) {
    case "embed-news-stories":
      return newsRefreshCommands.embed;
    case "inspect-source-failures":
      return newsRefreshCommands.refresh;
    case "seed-news-sources":
      return newsRefreshCommands.refresh;
    case "ready":
      return newsRefreshCommands.refresh;
  }
};

const newsRefreshNextStepLabels: Record<NewsRefreshNextStep, string> = {
  "embed-news-stories": "Generate embeddings",
  "inspect-source-failures": "Inspect source failures",
  ready: "Ready",
  "seed-news-sources": "Seed sources",
};

const getNewsRefreshOperatorNextStep = ({
  actionRequired,
  command,
  nextStep,
}: {
  actionRequired: readonly string[];
  command: string;
  nextStep: NewsRefreshNextStep;
}) => ({
  command,
  detail:
    actionRequired[0] ??
    "Refresh completed without new stories; run the health check to confirm the edition is ready.",
  label: newsRefreshNextStepLabels[nextStep],
  step: nextStep,
});

export const handleNewsRefreshRequest = async ({
  expectedSecret,
  refresh,
  request,
}: HandleNewsRefreshRequestInput) => {
  if (!expectedSecret) {
    return Response.json(
      { error: "NEWS_REFRESH_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (readRequestSecret(request) !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let result: NewsRefreshSummary;

  try {
    result = await refresh();
  } catch (error) {
    return Response.json(
      { error: getNewsRefreshErrorMessage(error), ok: false },
      { status: 500 },
    );
  }
  const nextStep = getNewsRefreshNextStep(result);
  const actionRequired = getNewsRefreshActionRequired(nextStep, result);
  const nextCommand = getNewsRefreshCommandForNextStep(nextStep);

  return Response.json({
    actionRequired,
    commands: {
      embed: newsRefreshCommands.embed,
      next: nextCommand,
      refresh: newsRefreshCommands.refresh,
      seedSources: newsRefreshCommands.seedSources,
    },
    nextStep,
    ok: true,
    operatorNextStep: getNewsRefreshOperatorNextStep({
      actionRequired,
      command: nextCommand,
      nextStep,
    }),
    ready: nextStep === "ready",
    ...result,
  });
};
