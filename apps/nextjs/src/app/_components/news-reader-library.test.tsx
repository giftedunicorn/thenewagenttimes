import { readFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  NewsHomeItem,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
import type { NewsSearchMemoryItem } from "./news-reader-memory-storage";
import { TRPCReactProvider } from "~/trpc/react";
import {
  NewsReaderLibraryView,
  selectNewsReaderLibrary,
} from "./news-reader-library";

const globalWithReact = globalThis as typeof globalThis & {
  React: typeof React;
};

globalWithReact.React = React;

const createMemoryItem = ({
  category = "agent_product",
  entities = ["OpenAI"],
  hiddenAt,
  id,
  savedAt,
  sourceName = "Agent Desk",
  sourceSlug = "agent-desk",
  tags = ["agents"],
  title,
  viewedAt,
}: {
  category?: string;
  entities?: string[];
  hiddenAt?: string;
  id: string;
  savedAt?: string;
  sourceName?: string;
  sourceSlug?: string;
  tags?: string[];
  title: string;
  viewedAt?: string;
}): NewsReaderMemoryItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category,
  entities,
  hiddenAt,
  id,
  originalUrl: `https://source.example/${id}`,
  savedAt,
  sourceName,
  sourceSlug,
  tags,
  title,
  viewedAt,
});

const createStory = ({
  id,
  title,
  ...overrides
}: Partial<NewsHomeItem> &
  Pick<NewsHomeItem, "id" | "title">): NewsHomeItem => ({
  canonicalUrl: `https://example.com/${id}`,
  category: "agent_product",
  entities: ["OpenAI"],
  id,
  imageUrl: null,
  publishedAt: "2026-07-06T12:00:00.000Z",
  sourceName: "Agent Desk",
  sourceScore: 88,
  sourceSlug: "agent-desk",
  sourceType: "manual",
  summary: "Library recall story",
  tags: ["agents"],
  title,
  trendScore: 82,
  ...overrides,
});

const searchItems: NewsSearchMemoryItem[] = [
  {
    query: "browser agents",
    resultCount: 3,
    searchedAt: "2026-07-06T11:00:00.000Z",
  },
];

const createPositiveFeedbackItem = ({
  action = "share",
  id,
  occurredAt,
  title,
}: {
  action?: "click_source" | "save" | "share";
  id: string;
  occurredAt: string;
  title: string;
}): NewsPositiveFeedbackMemoryItem => ({
  ...createMemoryItem({ id, title }),
  action,
  occurredAt,
});

const renderLibraryViewMarkup = (
  props: React.ComponentProps<typeof NewsReaderLibraryView>,
) =>
  renderToStaticMarkup(
    React.createElement(
      TRPCReactProvider,
      null,
      React.createElement(NewsReaderLibraryView, props),
    ),
  );

describe("selectNewsReaderLibrary", () => {
  it("builds a local reader library from saved, positive, read, hidden, and search memory", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [
        createMemoryItem({
          category: "hot_take",
          entities: ["Noise"],
          hiddenAt: "2026-07-06T10:00:00.000Z",
          id: "hidden-story",
          sourceName: "Noise Desk",
          sourceSlug: "noise-desk",
          tags: ["noise"],
          title: "Hidden noisy story",
        }),
      ],
      historyItems: [
        createMemoryItem({
          id: "read-old-story",
          title: "Older read story",
          viewedAt: "2026-07-06T08:00:00.000Z",
        }),
        createMemoryItem({
          id: "read-new-story",
          title: "Newer read story",
          viewedAt: "2026-07-06T12:00:00.000Z",
        }),
      ],
      savedItems: [
        createMemoryItem({
          id: "saved-story",
          savedAt: "2026-07-06T09:00:00.000Z",
          title: "Saved story",
        }),
      ],
      positiveFeedbackItems: [
        createPositiveFeedbackItem({
          id: "shared-story",
          occurredAt: "2026-07-06T09:30:00.000Z",
          title: "Shared story",
        }),
        createPositiveFeedbackItem({
          action: "save",
          id: "saved-story",
          occurredAt: "2026-07-06T09:00:00.000Z",
          title: "Saved story",
        }),
      ],
      searchItems,
    });

    expect(library.metrics).toEqual([
      { label: "Saved", value: "1" },
      { label: "Read", value: "2" },
      { label: "Positive", value: "1" },
      { label: "Hidden", value: "1" },
      { label: "Searches", value: "1" },
      { label: "Recall", value: "0" },
    ]);
    expect(library.sections.map((section) => section.label)).toEqual([
      "Saved Stories",
      "Read History",
      "Positive Feedback",
      "Less Feedback",
      "Searches",
    ]);
    expect(library.sections[1]?.entries.map((entry) => entry.title)).toEqual([
      "Newer read story",
      "Older read story",
    ]);
    expect(library.sections[2]?.entries.map((entry) => entry.title)).toEqual([
      "Shared story",
    ]);
    expect(library.summary).toBe(
      "6 local reader signals are available on this device.",
    );
  });

  it("recalls current stories from saved, read, and search memory", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [
        createMemoryItem({
          category: "hot_take",
          entities: ["Rumor"],
          hiddenAt: "2026-07-06T10:00:00.000Z",
          id: "hidden-rumor",
          sourceName: "Rumor Feed",
          sourceSlug: "rumor-feed",
          tags: ["rumor"],
          title: "Hidden rumor",
        }),
      ],
      historyItems: [
        createMemoryItem({
          category: "model_release",
          entities: ["Anthropic"],
          id: "read-model",
          sourceName: "Model Desk",
          sourceSlug: "model-desk",
          tags: ["models"],
          title: "Read model story",
          viewedAt: "2026-07-06T09:00:00.000Z",
        }),
      ],
      items: [
        createStory({
          id: "saved-agent-follow-up",
          title: "Saved agent follow-up ships",
        }),
        createStory({
          category: "policy",
          entities: ["Browser Agents"],
          id: "search-browser-agents",
          sourceName: "Policy Desk",
          sourceSlug: "policy-desk",
          tags: ["deployment"],
          title: "Browser agents deployment evidence expands",
          trendScore: 90,
        }),
        createStory({
          category: "hot_take",
          entities: ["Rumor"],
          id: "hidden-rumor-follow-up",
          sourceName: "Rumor Feed",
          sourceSlug: "rumor-feed",
          tags: ["rumor"],
          title: "Rumor feed claims agent leak",
          trendScore: 99,
        }),
      ],
      savedItems: [
        createMemoryItem({
          id: "saved-agent",
          savedAt: "2026-07-06T09:00:00.000Z",
          title: "Saved agent story",
        }),
      ],
      searchItems,
    });

    expect(library.recallFeed).toMatchObject({
      stories: [
        {
          href: "/news/saved-agent-follow-up",
          matchLabel: "4 signals",
          reason: "Matches saved stories.",
          sourceName: "Agent Desk",
          title: "Saved agent follow-up ships",
        },
        {
          href: "/news/search-browser-agents",
          matchLabel: "1 signal",
          reason: "Matches recent search intent.",
          sourceName: "Policy Desk",
          title: "Browser agents deployment evidence expands",
        },
      ],
      summary:
        "2 current stories are recalled from saved, read, or search memory.",
    });
    expect(library.metrics).toContainEqual({ label: "Recall", value: "2" });
  });
});

describe("NewsReaderLibraryView", () => {
  it("renders a dense local reader library surface", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [
        createMemoryItem({
          category: "hot_take",
          entities: ["Noise"],
          hiddenAt: "2026-07-06T10:00:00.000Z",
          id: "hidden-story",
          sourceName: "Noise Desk",
          sourceSlug: "noise-desk",
          tags: ["noise"],
          title: "Hidden noisy story",
        }),
      ],
      historyItems: [],
      items: [
        createStory({
          id: "saved-agent-follow-up",
          title: "Saved agent follow-up ships",
        }),
      ],
      savedItems: [
        createMemoryItem({
          id: "saved-story",
          savedAt: "2026-07-06T09:00:00.000Z",
          title: "Saved story",
        }),
      ],
      positiveFeedbackItems: [
        createPositiveFeedbackItem({
          action: "click_source",
          id: "source-clicked-story",
          occurredAt: "2026-07-06T09:30:00.000Z",
          title: "Source clicked story",
        }),
      ],
      searchItems,
    });
    const markup = renderLibraryViewMarkup({ library });

    expect(markup).toContain("Reader Library");
    expect(markup).toContain("Library Recall");
    expect(markup).toContain("Saved agent follow-up ships");
    expect(markup).toContain(
      'aria-label="Reader actions: Saved agent follow-up ships"',
    );
    expect(markup).toContain("Save");
    expect(markup).toContain("Less");
    expect(markup).toContain("Source");
    expect(markup).toContain("Saved Stories");
    expect(markup).toContain("Positive Feedback");
    expect(markup).toContain("Less Feedback");
    expect(markup).toContain("Searches");
    expect(markup).toContain("Saved story");
    expect(markup).toContain("Source clicked story");
    expect(markup).toContain("Hidden noisy story");
    expect(markup).toContain('href="/search?q=browser%20agents"');
    expect(markup).toContain('href="/reader"');
  });

  it("shows a search memory clear control when searches can steer recommendations", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [],
      historyItems: [],
      savedItems: [],
      searchItems,
    });
    const markup = renderLibraryViewMarkup({
      library,
      onClearSearches: () => undefined,
    });

    expect(markup).toContain("Clear searches");
    expect(markup).toContain("Tune For You");
    expect(markup).toContain('href="/reader#promote-search-intent"');
    expect(markup).toContain("Recent search intent");
  });

  it("shows a Less restore control for hidden stories", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [
        createMemoryItem({
          hiddenAt: "2026-07-06T10:00:00.000Z",
          id: "hidden-story",
          title: "Hidden noisy story",
        }),
      ],
      historyItems: [],
      savedItems: [],
      searchItems: [],
    });
    const markup = renderLibraryViewMarkup({
      library,
      onRestoreGuardrail: () => undefined,
    });

    expect(markup).toContain("Less Feedback");
    expect(markup).toContain("Hidden noisy story");
    expect(markup).toContain("Restore");
  });

  it("shows a saved-story removal control", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [],
      historyItems: [],
      savedItems: [
        createMemoryItem({
          id: "saved-story",
          savedAt: "2026-07-06T09:00:00.000Z",
          title: "Saved story",
        }),
      ],
      searchItems: [],
    });
    const markup = renderLibraryViewMarkup({
      library,
      onRemoveSaved: () => undefined,
    });

    expect(markup).toContain("Saved Stories");
    expect(markup).toContain("Saved story");
    expect(markup).toContain("Remove saved");
  });

  it("shows a read-history removal control", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [],
      historyItems: [
        createMemoryItem({
          id: "read-story",
          title: "Read story",
          viewedAt: "2026-07-06T09:30:00.000Z",
        }),
      ],
      savedItems: [],
      searchItems: [],
    });
    const markup = renderLibraryViewMarkup({
      library,
      onRemoveHistory: () => undefined,
    });

    expect(markup).toContain("Read History");
    expect(markup).toContain("Read story");
    expect(markup).toContain("Remove read");
  });

  it("shows an explicit positive-feedback removal control", () => {
    const library = selectNewsReaderLibrary({
      guardrailItems: [],
      historyItems: [],
      positiveFeedbackItems: [
        createPositiveFeedbackItem({
          action: "click_source",
          id: "source-clicked-story",
          occurredAt: "2026-07-06T09:30:00.000Z",
          title: "Source clicked story",
        }),
      ],
      savedItems: [],
      searchItems: [],
    });
    const markup = renderLibraryViewMarkup({
      library,
      onRemovePositiveFeedback: () => undefined,
    });

    expect(markup).toContain("Positive Feedback");
    expect(markup).toContain("Source clicked story");
    expect(markup).toContain("Source clicked");
    expect(markup).toContain("Remove feedback");
  });

  it("wires the reader library route and Reader Center navigation", async () => {
    const [routeSource, centerSource] = await Promise.all([
      readFile(new URL("../reader/library/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./news-reader-center.tsx", import.meta.url), "utf8"),
    ]);

    expect(routeSource).toContain("<NewsReaderLibrary");
    expect(routeSource).toContain("getNewsHomeData()");
    expect(routeSource).toContain("items={data.items}");
    expect(routeSource).toContain("status={data.status}");
    expect(routeSource).toContain('dynamic = "force-dynamic"');
    expect(routeSource).toContain("robots");
    expect(centerSource).toContain('href="/reader/library"');
    expect(centerSource).toContain("Reader Library");
  });

  it("wires search memory clearing through local recommendation storage", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("writeStoredNewsSearchMemoryItems");
    expect(source).toContain("const clearSearches = () =>");
    expect(source).toContain("writeStoredNewsSearchMemoryItems([])");
    expect(source).toContain("setLocalMemory(readNewsReaderLibraryMemory())");
    expect(source).toContain("onClearSearches={clearSearches}");
  });

  it("hydrates and clears persisted search memory through server reader memory", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.searchMemory.queryOptions");
    expect(source).toContain("trpc.news.removeSearchMemory.mutationOptions");
    expect(source).toContain("trpc.news.searchMemory.pathFilter()");
    expect(source).toContain("removedSearchQueryKeys");
    expect(source).toContain("selectStoredNewsSearchMemoryItems([");
    expect(source).toMatch(
      /searchItems:\s*selectStoredNewsSearchMemoryItems\(\[[\s\S]*?\.\.\.\(searchMemoryQuery\.data \?\? \[\]\),[\s\S]*?\.\.\.localMemory\.searchItems,[\s\S]*?\]\)\.filter/,
    );
    expect(source).toMatch(
      /if \(!searchMemoryQuery\.data \|\| searchMemoryQuery\.data\.length === 0\) return;[\s\S]*?writeStoredNewsSearchMemoryItems\([\s\S]*?selectStoredNewsSearchMemoryItems\(\[[\s\S]*?\.\.\.searchMemoryQuery\.data,[\s\S]*?\.\.\.readStoredNewsSearchMemoryItems\(\),[\s\S]*?\]\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /for \(const item of searchItemsToClear\) \{[\s\S]*?removeSearchMemory\.mutate\(\{[\s\S]*?query: item\.query,[\s\S]*?visitorKey,[\s\S]*?}\);[\s\S]*?}/,
    );
  });

  it("wires Less restore through local and server recommendation storage", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );
    const restoreGuardrailBlock =
      source
        .split("const restoreGuardrail = useMutation(")[1]
        ?.split("const removeHistory =")[0] ?? "";

    expect(source).toContain("useMutation");
    expect(source).toContain("useQueryClient");
    expect(source).toContain("trpc.news.restoreGuardrail");
    expect(source).toContain("removeNewsReaderMemoryItem");
    expect(source).toContain("const restoreGuardrailItem =");
    expect(source).toContain("writeStoredNewsReaderMemoryItems(");
    expect(source).toContain("newsGuardrailStorageKey");
    expect(source).toContain("setLocalMemory(readNewsReaderLibraryMemory())");
    expect(source).toContain("onRestoreGuardrail={restoreGuardrailItem}");
    expect(source).toContain("trpc.news.forYou.pathFilter()");
    expect(source).toContain("trpc.news.profile.pathFilter()");
    expect(source).toContain("trpc.news.guardrails.pathFilter()");
    expect(restoreGuardrailBlock).toContain(
      "trpc.news.positiveFeedback.pathFilter()",
    );
  });

  it("wires saved removal through local and server recommendation storage", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.removeSaved");
    expect(source).toContain("const removeSavedItem =");
    expect(source).toContain("removedSavedItemIds");
    expect(source).toContain('isPreview={status !== "ready"}');
    expect(source).toContain("removeNewsReaderMemoryItem");
    expect(source).toContain("removeNewsHomePositiveFeedbackItem");
    expect(source).toContain("newsSavedStorageKey");
    expect(source).toContain("readStoredNewsPositiveFeedbackItems");
    expect(source).toContain("writeStoredNewsPositiveFeedbackItems");
    expect(source).toContain("onRemoveSaved={removeSavedItem}");
    expect(source).toContain("trpc.news.saved.pathFilter()");
  });

  it("wires read-history removal through local and server recommendation storage", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.removeHistory");
    expect(source).toContain("const removeHistoryItem =");
    expect(source).toContain("removedHistoryItemIds");
    expect(source).toContain("removeNewsReaderMemoryItem");
    expect(source).toContain("newsHistoryStorageKey");
    expect(source).toContain("onRemoveHistory={removeHistoryItem}");
    expect(source).toContain("trpc.news.history.pathFilter()");
  });

  it("wires explicit positive-feedback removal through local and server recommendation storage", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trpc.news.removePositiveFeedback");
    expect(source).toContain("const removePositiveFeedbackItem =");
    expect(source).toContain("removedPositiveFeedbackItemIds");
    expect(source).toContain("removeNewsHomePositiveFeedbackActionItem");
    expect(source).toContain("readStoredNewsPositiveFeedbackItems");
    expect(source).toContain("writeStoredNewsPositiveFeedbackItems");
    expect(source).toContain(
      "onRemovePositiveFeedback={removePositiveFeedbackItem}",
    );
    expect(source).toContain("trpc.news.forYou.pathFilter()");
    expect(source).toContain("trpc.news.profile.pathFilter()");
  });

  it("hydrates saved, read, and Less sections from server reader memory", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useTRPC");
    expect(source).toContain("useQuery");
    expect(source).toContain("readOrCreateNewsVisitorKey");
    expect(source).toContain("trpc.news.saved.queryOptions");
    expect(source).toContain("trpc.news.history.queryOptions");
    expect(source).toContain("trpc.news.guardrails.queryOptions");
    expect(source).toContain("NewsHomeStatus");
    expect(source).toContain('status = "ready"');
    expect(source).toContain("canUseServerReaderMemory");
    expect(source).toContain("{ enabled: canUseServerReaderMemory }");
    expect(source).not.toContain("{ enabled: Boolean(visitorKey) }");
    expect(source).toContain("mergeNewsReaderMemoryItems");
    expect(source).toContain("writeStoredNewsReaderMemoryItems");
    expect(source).toMatch(
      /savedItems: mergeNewsReaderMemoryItems\({[\s\S]*?localItems: localMemory\.savedItems,[\s\S]*?serverItems: savedQuery\.data \?\? \[\]/,
    );
    expect(source).toMatch(
      /historyItems: mergeNewsReaderMemoryItems\({[\s\S]*?localItems: localMemory\.historyItems,[\s\S]*?serverItems: historyQuery\.data \?\? \[\]/,
    );
    expect(source).toMatch(
      /guardrailItems: mergeNewsReaderMemoryItems\({[\s\S]*?localItems: localMemory\.guardrailItems,[\s\S]*?serverItems: guardrailsQuery\.data \?\? \[\]/,
    );
    expect(source).toMatch(
      /if \(savedQuery\.data && savedQuery\.data\.length > 0\) \{[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsSavedStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsSavedStorageKey\),[\s\S]*?serverItems: savedQuery\.data,[\s\S]*?}\),[\s\S]*?\);[\s\S]*?}/,
    );
    expect(source).toMatch(
      /if \(historyQuery\.data && historyQuery\.data\.length > 0\) \{[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsHistoryStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsHistoryStorageKey\),[\s\S]*?serverItems: historyQuery\.data,[\s\S]*?}\),[\s\S]*?\);[\s\S]*?}/,
    );
    expect(source).toMatch(
      /if \(guardrailsQuery\.data && guardrailsQuery\.data\.length > 0\) \{[\s\S]*?writeStoredNewsReaderMemoryItems\([\s\S]*?newsGuardrailStorageKey,[\s\S]*?mergeNewsReaderMemoryItems\({[\s\S]*?localItems: readStoredNewsReaderMemoryItems\(newsGuardrailStorageKey\),[\s\S]*?serverItems: guardrailsQuery\.data,[\s\S]*?}\),[\s\S]*?\);[\s\S]*?}/,
    );
  });

  it("hydrates explicit positive-feedback sections from server reader memory", async () => {
    const source = await readFile(
      new URL("./news-reader-library.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("mergeNewsHomePositiveFeedbackItems");
    expect(source).toContain("trpc.news.positiveFeedback.queryOptions");
    expect(source).toContain("trpc.news.positiveFeedback.pathFilter()");
    expect(source).toMatch(
      /const positiveFeedbackQuery = useQuery\([\s\S]*?trpc\.news\.positiveFeedback\.queryOptions\([\s\S]*?\{ limit: 30, visitorKey: visitorKey \?\? undefined \},[\s\S]*?\{ enabled: canUseServerReaderMemory \},[\s\S]*?\),[\s\S]*?\);/,
    );
    expect(source).toMatch(
      /positiveFeedbackItems:\s*\(positiveFeedbackQuery\.data \?\? \[\]\)\s*\.reduce<NewsPositiveFeedbackMemoryItem\[]>\([\s\S]*?mergeNewsHomePositiveFeedbackItems\({[\s\S]*?currentItems,[\s\S]*?nextItem,[\s\S]*?}\),[\s\S]*?localMemory\.positiveFeedbackItems,[\s\S]*?\)\s*\.filter/,
    );
    expect(source).toMatch(
      /if \(!positiveFeedbackQuery\.data \|\| positiveFeedbackQuery\.data\.length === 0\)\s*return;[\s\S]*?writeStoredNewsPositiveFeedbackItems\([\s\S]*?positiveFeedbackQuery\.data\.reduce<NewsPositiveFeedbackMemoryItem\[]>\([\s\S]*?mergeNewsHomePositiveFeedbackItems\({[\s\S]*?currentItems,[\s\S]*?nextItem,[\s\S]*?}\),[\s\S]*?readStoredNewsPositiveFeedbackItems\(\),[\s\S]*?\)[\s\S]*?\);/,
    );
  });
});
