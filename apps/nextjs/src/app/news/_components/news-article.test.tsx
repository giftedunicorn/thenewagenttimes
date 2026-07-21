import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsArticleItem, NewsHomeItem } from "../../_data/news";
import { TRPCReactProvider } from "~/trpc/react";
import { NewsArticle } from "./news-article";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const article: NewsArticleItem = {
  authorName: "News Desk",
  bodyText:
    "OpenAI ships a new agent platform.\n\nThe article body gives the reader enough context to unlock related recommendations.",
  canonicalUrl: "https://example.com/openai-agents",
  category: "model_release",
  collectedAt: "2026-07-01T08:02:00.000Z",
  entities: ["OpenAI", "Agents"],
  id: "article-openai-agents",
  imageUrl: null,
  originalUrl: "https://source.example/openai-agents",
  publishedAt: "2026-07-01T08:00:00.000Z",
  sourceName: "OpenAI News",
  sourceScore: 92,
  sourceSlug: "openai-news",
  sourceType: "rss",
  summary: "OpenAI ships a new agent platform for enterprise teams.",
  tags: ["model", "agent"],
  title: "OpenAI releases a new agent stack",
  trendScore: 90,
};

const related: NewsHomeItem[] = [
  {
    canonicalUrl: "https://example.com/related-openai",
    category: "agent_product",
    clusterKey: "openai-agent-workflows",
    entities: ["OpenAI", "Agents"],
    id: "related-openai-workflow",
    imageUrl: null,
    originalUrl: "https://source.example/related-openai",
    publishedAt: "2026-07-01T09:00:00.000Z",
    sourceName: "Agent Desk",
    sourceScore: 80,
    sourceSlug: "agent-desk",
    sourceType: "rss",
    summary: "More teams are adopting OpenAI agent workflows.",
    tags: ["agent", "workflow"],
    title: "OpenAI agent workflows reach more developers",
    trendScore: 88,
  },
];

const renderArticleMarkup = () =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsArticle, { article, related }),
    ),
  );

const countOccurrences = (value: string, search: string) =>
  value.split(search).length - 1;

describe("NewsArticle", () => {
  it("links fast-brief entities into entity editions and tags into search", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain('href="/entities/OpenAI"');
    expect(markup).toContain('href="/entities/Agents"');
    expect(markup).toContain('href="/search?q=model"');
    expect(markup).toContain('href="/search?q=agent"');
  });

  it("links article metadata into topic and source editions", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain('href="/topics/model-release"');
    expect(markup).toContain('href="/sources/openai-news"');
  });

  it("renders direct reader actions for next-read recommendations", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain('href="/news/related-openai-workflow"');
    expect(markup).toContain(
      'aria-label="Reader actions: OpenAI agent workflows reach more developers"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
  });

  it("renders direct reader actions for reading-path recommendations", () => {
    const markup = renderArticleMarkup();

    expect(
      countOccurrences(
        markup,
        'aria-label="Reader actions: OpenAI agent workflows reach more developers"',
      ),
    ).toBeGreaterThanOrEqual(2);
  });

  it("renders direct reader actions for the reader-fit next step", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain("Continue Thread");
    expect(
      countOccurrences(
        markup,
        'aria-label="Reader actions: OpenAI agent workflows reach more developers"',
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it("renders direct reader actions for learning-impact next recommendations", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain("Next Recommendation");
    expect(
      countOccurrences(
        markup,
        'aria-label="Reader actions: OpenAI agent workflows reach more developers"',
      ),
    ).toBeGreaterThanOrEqual(4);
  });

  it("renders direct reader actions for article corroboration sources", () => {
    const markup = renderArticleMarkup();

    expect(markup).toContain("Article Corroboration");
    expect(
      countOccurrences(
        markup,
        'aria-label="Reader actions: OpenAI agent workflows reach more developers"',
      ),
    ).toBeGreaterThanOrEqual(5);
  });

  it("syncs a local trained profile into an empty server profile", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      {
        encoding: "utf8",
      },
    );

    expect(source).toContain("serverProfileSyncSnapshotRef");
    expect(source).toContain("getNewsPreferenceProfileStorageValue(profile)");
    expect(source).toMatch(
      /if \(!profileQuery\.data \|\| profileQuery\.data\.persisted\) return;/,
    );
    expect(source).toMatch(
      /areNewsPreferenceProfilesEqual\(\s*profile,\s*createDefaultNewsPreferenceProfile\(\),\s*\)/,
    );
    expect(source).toMatch(
      /updateProfile\.mutate\(\{\s*visitorKey,\s*profile: toNewsServerPreferenceProfileInput\(profile\),\s*\}\)/,
    );
  });

  it("hydrates server reading history into local article memory", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      {
        encoding: "utf8",
      },
    );

    expect(source).toMatch(
      /const historyQuery = useQuery\([\s\S]*?trpc\.news\.history\.queryOptions\([\s\S]*?\{ limit: 6, visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canPersistReaderSignals && Boolean\(visitorKey\) \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /if \(!historyQuery\.data \|\| historyQuery\.data\.length === 0\) return;/,
    );
    expect(source).toMatch(
      /const nextHistoryItems = mergeNewsReaderMemoryItems\(\{[\s\S]*?localItems: readStoredMemoryItems\(historyStorageKey\),[\s\S]*?serverItems: historyQuery\.data,[\s\S]*?\}\);/,
    );
    expect(source).toMatch(
      /writeStoredMemoryItems\(\{[\s\S]*?items: nextHistoryItems,[\s\S]*?storageKey: historyStorageKey,[\s\S]*?\}\);/,
    );
  });

  it("hydrates server explicit positive feedback into local article memory", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      {
        encoding: "utf8",
      },
    );
    const hydrationEffectStart = source.indexOf(
      "useEffect(() => {\n    if (!positiveFeedbackQuery.data",
    );
    const hydrationEffectEnd = source.indexOf(
      "  }, [positiveFeedbackQuery.data]);",
      hydrationEffectStart,
    );
    const hydrationEffectBlock = source.slice(
      hydrationEffectStart,
      hydrationEffectEnd,
    );

    expect(source).toMatch(
      /const positiveFeedbackQuery = useQuery\([\s\S]*?trpc\.news\.positiveFeedback\.queryOptions\([\s\S]*?\{ limit: 6, visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canPersistReaderSignals && Boolean\(visitorKey\) \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(hydrationEffectStart).toBeGreaterThanOrEqual(0);
    expect(hydrationEffectEnd).toBeGreaterThan(hydrationEffectStart);
    expect(hydrationEffectBlock).toContain("readStoredPositiveFeedbackItems()");
    expect(hydrationEffectBlock).toContain(
      "mergeNewsHomePositiveFeedbackItems({",
    );
    expect(hydrationEffectBlock).toContain("currentItems");
    expect(hydrationEffectBlock).toContain("nextItem");
    expect(hydrationEffectBlock).toContain(
      "writeStoredPositiveFeedbackItems(nextPositiveFeedbackItems);",
    );
  });

  it("hydrates server search memory into the article reader lens", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      {
        encoding: "utf8",
      },
    );

    expect(source).toMatch(
      /const searchMemoryQuery = useQuery\([\s\S]*?trpc\.news\.searchMemory\.queryOptions\([\s\S]*?\{ limit: 20, visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canPersistReaderSignals && Boolean\(visitorKey\) \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /if \(!searchMemoryQuery\.data \|\| searchMemoryQuery\.data\.length === 0\) return;/,
    );
    expect(source).toMatch(
      /const nextSearchMemoryItems = selectStoredNewsSearchMemoryItems\(\[[\s\S]*?\.\.\.searchMemoryQuery\.data,[\s\S]*?\.\.\.readStoredSearchMemoryItems\(\),[\s\S]*?\]\);/,
    );
    expect(source).toContain(
      "writeStoredNewsSearchMemoryItems(nextSearchMemoryItems);",
    );
    expect(source).toContain("setSearchMemoryItems(nextSearchMemoryItems);");
  });

  it("refreshes article search memory after article reader actions persist", async () => {
    const source = await readFile(
      new URL("./news-article.tsx", import.meta.url),
      {
        encoding: "utf8",
      },
    );
    const invalidationStart = source.indexOf(
      "const invalidateReaderSignalQueries = async () => {",
    );
    const invalidationEnd = source.indexOf(
      "  const updateProfile = useMutation(",
      invalidationStart,
    );
    const invalidationBlock = source.slice(invalidationStart, invalidationEnd);

    expect(invalidationStart).toBeGreaterThanOrEqual(0);
    expect(invalidationEnd).toBeGreaterThan(invalidationStart);
    expect(invalidationBlock).toContain('case "searchMemory":');
    expect(invalidationBlock).toContain("trpc.news.searchMemory.pathFilter()");
  });
});
