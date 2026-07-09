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
  authSecret?: string | undefined;
  embeddingApiKey?: string | undefined;
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

type NewsHealthNextStep =
  | "apply-database-schema"
  | "configure-embedding-provider"
  | "embed-news-stories"
  | "configure-auth-secret"
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
      ? ` Empty sources: ${sourceHealth.emptySourceSlugs.join(", ")}.`
      : "";

  return `Inspect failed sources: ${failedSources}.${emptySources} Rerun pnpm run news:refresh:remote after fixing source issues.`;
};

const getNewsHealthActions = ({
  authConfigured,
  embeddingConfigured,
  refreshConfigured,
  schemaReadiness,
  status,
}: {
  authConfigured: boolean;
  embeddingConfigured: boolean;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}) => {
  const actions: string[] = [];
  const addEmbeddingProviderAction = () => {
    if (!embeddingConfigured) {
      actions.push(
        "Set OPENAI_API_KEY in the Railway service environment before running semantic embeddings.",
      );
    }
  };

  if (!authConfigured) {
    actions.push(
      "Set BETTER_AUTH_SECRET or AUTH_SECRET in the Railway service environment.",
    );
  }

  if (!refreshConfigured) {
    actions.push("Set NEWS_REFRESH_SECRET in the Railway service environment.");
  }

  if (!isNewsSchemaReady({ schemaReadiness, status })) {
    actions.push(getNewsSchemaAction(schemaReadiness));
    if (status.health === "unavailable") {
      actions.push("Seed sources and run pnpm run news:refresh:remote.");
    }
    addEmbeddingProviderAction();
    return actions;
  }

  if (status.health === "empty") {
    actions.push("Seed sources and run pnpm run news:refresh:remote.");
    addEmbeddingProviderAction();
    return actions;
  }

  if (status.health === "seeded") {
    actions.push(
      "Run pnpm run news:refresh:remote against the deployed service.",
    );
    addEmbeddingProviderAction();
    return actions;
  }

  if (status.health === "error") {
    actions.push(
      getFailedSourceDiagnostics(status) ??
        "Inspect the latest ingestion run and rerun pnpm run news:refresh:remote.",
    );
  }

  if (status.health === "live" && !isNewsFreshReady(status)) {
    actions.push(
      `Run pnpm run news:refresh:remote because the latest live story is older than ${newsDeskMaxStoryAgeHours} hours.`,
    );
  }

  addEmbeddingProviderAction();

  if (status.health === "live" && !isNewsSemanticReady(status)) {
    actions.push(
      "Run pnpm run news:embed:remote so semantic recommendations can use the live edition.",
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
  bootstrap: "pnpm run news:bootstrap:remote",
  embed: "pnpm run news:embed:remote",
  health: "pnpm run news:health:remote",
  refresh: "pnpm run news:refresh:remote",
  schema: "pnpm run db:predeploy",
  seedSources: "pnpm run news:seed-sources",
} as const;

const getNewsHealthChecks = ({
  authConfigured,
  embeddingConfigured,
  refreshConfigured,
  schemaReadiness,
  status,
}: {
  authConfigured: boolean;
  embeddingConfigured: boolean;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}) => ({
  auth: authConfigured,
  embeddingProvider: embeddingConfigured,
  freshness: isNewsFreshReady(status),
  refreshSecret: refreshConfigured,
  schema: isNewsSchemaReady({ schemaReadiness, status }),
  semantic: isNewsSemanticReady(status),
  sources: status.activeSources > 0,
  stories: status.health === "live",
});

const areNewsHealthChecksReady = (
  checks: ReturnType<typeof getNewsHealthChecks>,
) =>
  checks.auth &&
  checks.embeddingProvider &&
  checks.freshness &&
  checks.refreshSecret &&
  checks.schema &&
  checks.semantic &&
  checks.sources &&
  checks.stories;

const getNewsHealthNextStep = ({
  authConfigured,
  embeddingConfigured,
  refreshConfigured,
  schemaReadiness,
  status,
}: {
  authConfigured: boolean;
  embeddingConfigured: boolean;
  refreshConfigured: boolean;
  schemaReadiness: NewsSchemaReadiness;
  status: NewsDeskStatus;
}): NewsHealthNextStep => {
  if (!authConfigured) return "configure-auth-secret";
  if (!refreshConfigured) return "configure-refresh-secret";
  if (!isNewsSchemaReady({ schemaReadiness, status })) {
    return "apply-database-schema";
  }
  if (status.health === "empty") return "seed-news-sources";
  if (status.health === "seeded") return "run-news-refresh";
  if (status.health === "error") return "inspect-ingestion-run";
  if (status.health === "live" && !isNewsFreshReady(status)) {
    return "run-news-refresh";
  }
  if (!embeddingConfigured) return "configure-embedding-provider";
  if (!isNewsSemanticReady(status)) return "embed-news-stories";

  return "ready";
};

const getNewsHealthCommandForNextStep = (nextStep: NewsHealthNextStep) => {
  switch (nextStep) {
    case "apply-database-schema":
      return newsHealthCommands.schema;
    case "seed-news-sources":
      return newsHealthCommands.seedSources;
    case "run-news-refresh":
    case "inspect-ingestion-run":
      return newsHealthCommands.refresh;
    case "embed-news-stories":
      return newsHealthCommands.embed;
    case "configure-auth-secret":
    case "configure-embedding-provider":
    case "configure-refresh-secret":
    case "ready":
      return null;
  }
};

export const handleNewsHealthRequest = async ({
  authSecret,
  embeddingApiKey,
  getDeskStatus,
  getSchemaReadiness,
  refreshSecret,
}: HandleNewsHealthRequestInput) => {
  const authConfigured = Boolean(authSecret?.trim());
  const embeddingConfigured = Boolean(embeddingApiKey?.trim());
  const refreshConfigured = Boolean(refreshSecret?.trim());
  const [status, schemaReadinessResult] = await Promise.all([
    getDeskStatus().catch(() => unavailableNewsDeskStatus()),
    getSchemaReadiness
      ? getSchemaReadiness().catch(() => unavailableNewsSchemaReadiness())
      : Promise.resolve(null),
  ]);
  const schemaReadiness =
    schemaReadinessResult ?? getDefaultNewsSchemaReadiness(status);
  const checks = getNewsHealthChecks({
    authConfigured,
    embeddingConfigured,
    refreshConfigured,
    schemaReadiness,
    status,
  });

  return Response.json({
    actionRequired: getNewsHealthActions({
      authConfigured,
      embeddingConfigured,
      refreshConfigured,
      schemaReadiness,
      status,
    }),
    authConfigured,
    checks,
    commands: {
      ...newsHealthCommands,
      next: getNewsHealthCommandForNextStep(
        getNewsHealthNextStep({
          authConfigured,
          embeddingConfigured,
          refreshConfigured,
          schemaReadiness,
          status,
        }),
      ),
    },
    homepage: getNewsHomepageHealth(status),
    news: {
      activeSources: status.activeSources,
      embeddedStories: status.embeddedStories ?? 0,
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
      summary: getNewsDeskStatusSummary(status),
      totalSources: status.totalSources,
      unembeddedStories: status.unembeddedStories ?? status.publishedStories,
    },
    nextStep: getNewsHealthNextStep({
      authConfigured,
      embeddingConfigured,
      refreshConfigured,
      schemaReadiness,
      status,
    }),
    ok: true,
    ready: areNewsHealthChecksReady(checks),
    refreshConfigured,
    schema: schemaReadiness,
    web: "ready",
  });
};
