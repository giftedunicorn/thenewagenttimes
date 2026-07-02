import type { NewsDeskStatus } from "../../../_components/news-home-model";
import {
  buildNewsDeskStatus,
  getNewsDeskStatusSummary,
} from "../../../_components/news-home-model";

interface HandleNewsHealthRequestInput {
  authSecret?: string | undefined;
  getDeskStatus: () => Promise<NewsDeskStatus>;
  refreshSecret: string | undefined;
}

type NewsHealthNextStep =
  | "apply-database-schema"
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

const getNewsHealthActions = ({
  authConfigured,
  refreshConfigured,
  status,
}: {
  authConfigured: boolean;
  refreshConfigured: boolean;
  status: NewsDeskStatus;
}) => {
  const actions: string[] = [];

  if (!authConfigured) {
    actions.push(
      "Set BETTER_AUTH_SECRET or AUTH_SECRET in the Railway service environment.",
    );
  }

  if (!refreshConfigured) {
    actions.push("Set NEWS_REFRESH_SECRET in the Railway service environment.");
  }

  if (status.health === "unavailable") {
    actions.push("Apply the database schema to the target database.");
    actions.push("Seed sources and run pnpm run news:refresh.");
    return actions;
  }

  if (status.health === "empty") {
    actions.push("Seed sources and run pnpm run news:refresh.");
    return actions;
  }

  if (status.health === "seeded") {
    actions.push("Run pnpm run news:refresh against the target database.");
    return actions;
  }

  if (status.health === "error") {
    actions.push(
      "Inspect the latest ingestion run and rerun pnpm run news:refresh.",
    );
  }

  return actions;
};

const getNewsHealthChecks = ({
  authConfigured,
  refreshConfigured,
  status,
}: {
  authConfigured: boolean;
  refreshConfigured: boolean;
  status: NewsDeskStatus;
}) => ({
  auth: authConfigured,
  refreshSecret: refreshConfigured,
  schema: status.health !== "unavailable",
  sources: status.activeSources > 0,
  stories: status.health === "live",
});

const areNewsHealthChecksReady = (
  checks: ReturnType<typeof getNewsHealthChecks>,
) =>
  checks.auth &&
  checks.refreshSecret &&
  checks.schema &&
  checks.sources &&
  checks.stories;

const getNewsHealthNextStep = ({
  authConfigured,
  refreshConfigured,
  status,
}: {
  authConfigured: boolean;
  refreshConfigured: boolean;
  status: NewsDeskStatus;
}): NewsHealthNextStep => {
  if (!authConfigured) return "configure-auth-secret";
  if (!refreshConfigured) return "configure-refresh-secret";
  if (status.health === "unavailable") return "apply-database-schema";
  if (status.health === "empty") return "seed-news-sources";
  if (status.health === "seeded") return "run-news-refresh";
  if (status.health === "error") return "inspect-ingestion-run";

  return "ready";
};

export const handleNewsHealthRequest = async ({
  authSecret,
  getDeskStatus,
  refreshSecret,
}: HandleNewsHealthRequestInput) => {
  const authConfigured = Boolean(authSecret?.trim());
  const refreshConfigured = Boolean(refreshSecret?.trim());
  const status = await getDeskStatus().catch(() => unavailableNewsDeskStatus());
  const checks = getNewsHealthChecks({
    authConfigured,
    refreshConfigured,
    status,
  });

  return Response.json({
    actionRequired: getNewsHealthActions({
      authConfigured,
      refreshConfigured,
      status,
    }),
    authConfigured,
    checks,
    news: {
      activeSources: status.activeSources,
      health: status.health,
      latestPublishedAt: status.latestPublishedAt,
      latestRun: status.latestRun,
      publishedStories: status.publishedStories,
      ready: status.health === "live",
      summary: getNewsDeskStatusSummary(status),
      totalSources: status.totalSources,
    },
    nextStep: getNewsHealthNextStep({
      authConfigured,
      refreshConfigured,
      status,
    }),
    ok: true,
    ready: areNewsHealthChecksReady(checks),
    refreshConfigured,
    web: "ready",
  });
};
