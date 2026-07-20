import { initialNewsSources } from "@acme/ingestion";

import type { NewsDeskStatus } from "../../../_components/news-home-model";
import {
  buildNewsDeskStatus,
  getNewsDeskFreshnessStatus,
  getNewsDeskRunYieldLabel,
  getNewsDeskStatusSummary,
  getPreviewNewsHomeItems,
  newsDeskMaxStoryAgeHours,
} from "../../../_components/news-home-model";

interface HandleNewsHealthRequestInput {
  getDeskStatus: () => Promise<NewsDeskStatus>;
  getSchemaReadiness?: (() => Promise<NewsSchemaReadiness>) | undefined;
  refreshSecret: string | undefined;
}

type NewsSchemaReadinessState =
  | "incomplete"
  | "missing"
  | "ready"
  | "unavailable";

export interface NewsSchemaReadiness {
  newsItemClusterKey: NewsSchemaReadinessState;
}

interface NewsExpectedSourceCatalog {
  activeSources: number;
  totalSources: number;
}

type NewsHealthNextStep =
  | "apply-database-schema"
  | "embed-news-stories"
  | "configure-refresh-secret"
  | "inspect-ingestion-run"
  | "ready"
  | "run-news-refresh"
  | "seed-news-sources";

const unavailableNewsDeskStatus = () =>
  buildNewsDeskStatus({
    activeSources: 0,
    latestPublishedAt: null,
    latestRun: null,
    publishedStories: 0,
    totalSources: 0,
    unavailable: true,
  });

const unavailableNewsSchemaReadiness = (): NewsSchemaReadiness => ({
  newsItemClusterKey: "unavailable",
});

const getDefaultNewsSchemaReadiness = (
  status: NewsDeskStatus,
): NewsSchemaReadiness => ({
  newsItemClusterKey: status.health === "unavailable" ? "unavailable" : "ready",
});

const isNewsSchemaReady = ({
  schemaReadiness,
  status,
}: {
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}) =>
  status.health !== "unavailable" &&
  schemaReadiness.newsItemClusterKey === "ready";

const getNewsSchemaAction = (schemaReadiness: NewsSchemaReadiness) =>
  schemaReadiness.newsItemClusterKey === "missing"
    ? "Apply the database schema so news_item.cluster_key is available."
    : schemaReadiness.newsItemClusterKey === "incomplete"
      ? "Run pnpm run db:predeploy so news_item.cluster_key is backfilled and non-null."
      : "Apply the database schema to the target database.";

const expectedNewsSourceCatalog: NewsExpectedSourceCatalog = {
  activeSources: initialNewsSources.filter((source) => source.isActive).length,
  totalSources: initialNewsSources.length,
};

const isNewsSourceCatalogReady = ({
  expectedSourceCatalog,
  status,
}: {
  expectedSourceCatalog: NewsExpectedSourceCatalog;
  status: NewsDeskStatus;
}) =>
  status.activeSources >= expectedSourceCatalog.activeSources &&
  status.totalSources >= expectedSourceCatalog.totalSources;

const getNewsSourceCatalogAction = (
  expectedSourceCatalog: NewsExpectedSourceCatalog,
) =>
  `Enqueue a news refresh so the worker seeds the current ${expectedSourceCatalog.activeSources} active-source catalog before ingesting stories.`;

const getFailedSourceDiagnostics = (status: NewsDeskStatus) => {
  const sourceHealth = status.latestRun?.sourceHealth;

  if (!sourceHealth || sourceHealth.failedSourceSlugs.length === 0) {
    return null;
  }

  const failedSources = sourceHealth.failedSourceSlugs
    .map((slug) => {
      const message = sourceHealth.failureMessages[slug];

      return message ? `${slug} (${message})` : slug;
    })
    .join(", ");
  const emptySources =
    sourceHealth.emptySourceSlugs.length > 0
      ? ` Empty sources: ${sourceHealth.emptySourceSlugs
          .map((slug) => {
            const message = sourceHealth.emptyReasonMessages?.[slug];

            return message ? `${slug} (${message})` : slug;
          })
          .join(", ")}.`
      : "";

  return `Inspect failed sources: ${failedSources}.${emptySources} Enqueue a news refresh after fixing source issues.`;
};

const getNewsHealthActions = ({
  refreshConfigured,
  schemaReadiness,
  status,
  expectedSourceCatalog,
}: {
  expectedSourceCatalog: NewsExpectedSourceCatalog;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}) => {
  const actions: string[] = [];

  if (!refreshConfigured) {
    actions.push("Set CRON_SECRET in the Railway service environment.");
  }

  if (!isNewsSchemaReady({ schemaReadiness, status })) {
    actions.push(getNewsSchemaAction(schemaReadiness));
    if (status.health === "unavailable") {
      actions.push("Deploy the schema, then enqueue a news refresh.");
    }
    return actions;
  }

  if (!isNewsSourceCatalogReady({ expectedSourceCatalog, status })) {
    actions.push(getNewsSourceCatalogAction(expectedSourceCatalog));
    return actions;
  }

  if (status.health === "empty") {
    actions.push("Enqueue a news refresh so the worker seeds sources.");
    return actions;
  }

  if (status.health === "seeded") {
    actions.push("Enqueue a news refresh for the background worker.");
    return actions;
  }

  if (status.health === "error") {
    actions.push(
      getFailedSourceDiagnostics(status) ??
        "Inspect the latest ingestion run and enqueue another news refresh.",
    );
  }

  if (status.health === "live" && !isNewsFreshReady(status)) {
    actions.push(
      `Enqueue a news refresh because the latest live story is older than ${newsDeskMaxStoryAgeHours} hours.`,
    );
  }

  if (status.health === "live" && !isNewsSemanticReady(status)) {
    actions.push(
      "The background worker must finish embedding the live edition; inspect failed background jobs if progress stops.",
    );
  }

  return actions;
};

const isNewsSemanticReady = (status: NewsDeskStatus) =>
  status.publishedStories > 0 &&
  (status.embeddedStories ?? 0) > 0 &&
  (status.unembeddedStories ?? status.publishedStories) === 0;

const isNewsLiveReady = (status: NewsDeskStatus) => status.health === "live";

const isNewsFreshReady = (status: NewsDeskStatus) =>
  getNewsDeskFreshnessStatus({ status }).state === "fresh";

const isNewsReady = (status: NewsDeskStatus) =>
  isNewsFreshReady(status) && isNewsSemanticReady(status);

const getNewsHomepageHealth = (status: NewsDeskStatus) => {
  const previewStories = getPreviewNewsHomeItems().length;
  const mode = status.publishedStories > 0 ? "live" : "preview";

  return {
    liveStories: status.publishedStories,
    mode,
    path: "/",
    previewStories,
    servingNewsExperience: mode === "live" || previewStories > 0,
    title: "The New AI Times",
  };
};

const newsHealthCommands = {
  bootstrap: null,
  embed: null,
  health: "pnpm run news:health:remote",
  refresh: null,
  schema: "pnpm run db:predeploy",
  seedSources: "pnpm run news:seed-sources",
} as const;

const getNewsHealthChecks = ({
  refreshConfigured,
  schemaReadiness,
  status,
  expectedSourceCatalog,
}: {
  expectedSourceCatalog: NewsExpectedSourceCatalog;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}) => ({
  freshness: isNewsFreshReady(status),
  refreshSecret: refreshConfigured,
  schema: isNewsSchemaReady({ schemaReadiness, status }),
  semantic: isNewsSemanticReady(status),
  sourceCatalog: isNewsSourceCatalogReady({ expectedSourceCatalog, status }),
  sources: status.activeSources > 0,
  stories: status.health === "live",
});

const areNewsHealthChecksReady = (
  checks: ReturnType<typeof getNewsHealthChecks>,
) =>
  checks.freshness &&
  checks.refreshSecret &&
  checks.schema &&
  checks.semantic &&
  checks.sourceCatalog &&
  checks.sources &&
  checks.stories;

const getNewsHealthNextStep = ({
  refreshConfigured,
  schemaReadiness,
  status,
  expectedSourceCatalog,
}: {
  expectedSourceCatalog: NewsExpectedSourceCatalog;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}): NewsHealthNextStep => {
  if (!refreshConfigured) return "configure-refresh-secret";
  if (!isNewsSchemaReady({ schemaReadiness, status })) {
    return "apply-database-schema";
  }
  if (!isNewsSourceCatalogReady({ expectedSourceCatalog, status })) {
    return "seed-news-sources";
  }
  if (status.health === "empty") return "seed-news-sources";
  if (status.health === "seeded") return "run-news-refresh";
  if (status.health === "error") return "inspect-ingestion-run";
  if (status.health === "live" && !isNewsFreshReady(status)) {
    return "run-news-refresh";
  }
  if (!isNewsSemanticReady(status)) return "embed-news-stories";

  return "ready";
};

const getNewsHealthCommandForNextStep = (nextStep: NewsHealthNextStep) => {
  switch (nextStep) {
    case "apply-database-schema":
      return newsHealthCommands.schema;
    case "seed-news-sources":
      return newsHealthCommands.refresh;
    case "run-news-refresh":
    case "inspect-ingestion-run":
      return newsHealthCommands.refresh;
    case "embed-news-stories":
      return newsHealthCommands.embed;
    case "configure-refresh-secret":
    case "ready":
      return null;
  }
};

const newsHealthNextStepLabels: Record<NewsHealthNextStep, string> = {
  "apply-database-schema": "Apply database schema",
  "configure-refresh-secret": "Configure refresh secret",
  "embed-news-stories": "Generate embeddings",
  "inspect-ingestion-run": "Inspect ingestion run",
  ready: "Ready",
  "run-news-refresh": "Run news refresh",
  "seed-news-sources": "Seed sources",
};

const getNewsHealthOperatorNextStep = ({
  actionRequired,
  command,
  nextStep,
}: {
  actionRequired: readonly string[];
  command: string | null;
  nextStep: NewsHealthNextStep;
}) => ({
  command,
  detail:
    actionRequired[0] ??
    "The live news edition is fresh, embedded, and ready to serve.",
  label: newsHealthNextStepLabels[nextStep],
  step: nextStep,
});

export const handleNewsHealthRequest = async ({
  getDeskStatus,
  getSchemaReadiness,
  refreshSecret,
}: HandleNewsHealthRequestInput) => {
  const refreshConfigured = Boolean(refreshSecret?.trim());
  const expectedSourceCatalog = expectedNewsSourceCatalog;
  const [status, schemaReadinessResult] = await Promise.all([
    getDeskStatus().catch(() => unavailableNewsDeskStatus()),
    getSchemaReadiness
      ? getSchemaReadiness().catch(() => unavailableNewsSchemaReadiness())
      : Promise.resolve(null),
  ]);
  const schemaReadiness =
    schemaReadinessResult ?? getDefaultNewsSchemaReadiness(status);
  const checks = getNewsHealthChecks({
    expectedSourceCatalog,
    refreshConfigured,
    schemaReadiness,
    status,
  });
  const actionRequired = getNewsHealthActions({
    expectedSourceCatalog,
    refreshConfigured,
    schemaReadiness,
    status,
  });
  const nextStep = getNewsHealthNextStep({
    expectedSourceCatalog,
    refreshConfigured,
    schemaReadiness,
    status,
  });
  const nextCommand = getNewsHealthCommandForNextStep(nextStep);

  return Response.json({
    actionRequired,
    checks,
    commands: {
      ...newsHealthCommands,
      next: nextCommand,
    },
    homepage: getNewsHomepageHealth(status),
    news: {
      activeSources: status.activeSources,
      embeddedStories: status.embeddedStories ?? 0,
      expectedActiveSources: expectedNewsSourceCatalog.activeSources,
      expectedTotalSources: expectedNewsSourceCatalog.totalSources,
      freshReady: isNewsFreshReady(status),
      health: status.health,
      latestPublishedAt: status.latestPublishedAt,
      latestRun: status.latestRun,
      latestRunYield: getNewsDeskRunYieldLabel(status.latestRun),
      liveReady: isNewsLiveReady(status),
      maxStoryAgeHours: newsDeskMaxStoryAgeHours,
      publishedStories: status.publishedStories,
      ready: isNewsReady(status),
      semanticReady: isNewsSemanticReady(status),
      sourceCatalogReady: isNewsSourceCatalogReady({
        expectedSourceCatalog,
        status,
      }),
      summary: getNewsDeskStatusSummary(status),
      totalSources: status.totalSources,
      unembeddedStories: status.unembeddedStories ?? status.publishedStories,
    },
    nextStep,
    operatorNextStep: getNewsHealthOperatorNextStep({
      actionRequired,
      command: nextCommand,
      nextStep,
    }),
    ok: true,
    ready: areNewsHealthChecksReady(checks),
    refreshConfigured,
    schema: schemaReadiness,
    web: "ready",
  });
};
