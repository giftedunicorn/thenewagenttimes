import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { getNewsReaderCenterData } from "./news-reader-center";
import { NewsRecommendationLabView } from "./news-recommendation-lab";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const story: NewsHomeItem = {
  canonicalUrl: "https://example.com/agent",
  category: "agent_product",
  entities: ["OpenAI"],
  id: "agent-story",
  imageUrl: null,
  publishedAt: "2026-07-10T08:00:00.000Z",
  sourceName: "Agent Desk",
  sourceScore: 90,
  sourceSlug: "agent-desk",
  sourceType: "manual",
  summary: "A current agent story.",
  tags: ["agents"],
  title: "Agent systems move into production",
  trendScore: 84,
};

const createLabData = (items: readonly NewsHomeItem[] = []) =>
  getNewsReaderCenterData({
    guardrailItems: [],
    historyItems: [],
    homeExposureItems: [],
    items,
    positiveFeedbackItems: [],
    profile: {
      noveltyBias: 1,
      preferredCategories: ["agent_product"],
      preferredEntities: ["OpenAI"],
      preferredSources: ["agent-desk"],
      recencyBias: 1,
    },
    restoredGuardrailItems: [],
    savedItems: [],
    searchItems: [],
  });

describe("NewsRecommendationLabView", () => {
  it("renders advanced ranking transparency without profile controls", () => {
    const markup = renderToStaticMarkup(
      <NewsRecommendationLabView center={createLabData([story])} />,
    );

    expect(markup).toContain("Recommendation Lab");
    expect(markup).toContain("Ranking Inputs");
    expect(markup).toContain("Recommendation Audit");
    expect(markup).toContain("Training Signals");
    expect(markup).toContain("Profile Impact");
    expect(markup).not.toContain("Reset local signals");
    expect(markup).not.toContain("Import profile");
  });

  it("renders waiting guidance when no current story can be audited", () => {
    const markup = renderToStaticMarkup(
      <NewsRecommendationLabView center={createLabData()} />,
    );

    expect(markup).toContain("No current stories are available for audit");
    expect(markup).toContain("Open Reader Center");
  });
});
