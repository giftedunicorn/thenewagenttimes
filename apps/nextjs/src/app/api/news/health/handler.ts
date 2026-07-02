import type { NewsDeskStatus } from "../../../_components/news-home-model";
import {
  buildNewsDeskStatus,
  getNewsDeskStatusSummary,
} from "../../../_components/news-home-model";

interface HandleNewsHealthRequestInput {
  getDeskStatus: () => Promise<NewsDeskStatus>;
  refreshSecret: string | undefined;
}

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
  refreshConfigured,
  status,
}: {
  refreshConfigured: boolean;
  status: NewsDeskStatus;
}) => {
  const actions: string[] = [];

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

export const handleNewsHealthRequest = async ({
  getDeskStatus,
  refreshSecret,
}: HandleNewsHealthRequestInput) => {
  const refreshConfigured = Boolean(refreshSecret?.trim());
  const status = await getDeskStatus().catch(() => unavailableNewsDeskStatus());

  return Response.json({
    actionRequired: getNewsHealthActions({ refreshConfigured, status }),
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
    ok: true,
    refreshConfigured,
    web: "ready",
  });
};
