import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { formatNewsEditionDate, formatNewsTime } from "./news-home-model";

describe("formatNewsEditionDate", () => {
  it("uses a stable UTC edition date across server and browser time zones", () => {
    expect(formatNewsEditionDate("2026-07-04T18:06:42.000Z")).toBe(
      "Saturday, July 4, 2026",
    );
  });
});

describe("formatNewsTime", () => {
  it("uses a stable UTC story time across server and browser time zones", () => {
    expect(formatNewsTime("2026-07-04T17:13:00.000Z")).toBe("5:13 PM");
  });
});

describe("public news homepage", () => {
  it("uses a publication structure and excludes internal analysis sections", async () => {
    const homeSource = await readFile(
      new URL("./news-home.tsx", import.meta.url),
      "utf8",
    );
    const viewSource = await readFile(
      new URL("./news-public-front-page.tsx", import.meta.url),
      "utf8",
    );
    const source = `${homeSource}\n${viewSource}`;

    expect(source).toContain("Latest");
    expect(source).toContain("Most Read");
    expect(source).toContain("Editor's Picks");
    expect(source).toContain("Latest News");
    expect(source).toContain("For You");

    expect(source).not.toContain(">Front Page Layout<");
    expect(source).not.toContain(">Slot Mix<");
    expect(source).not.toContain(">Source Clusters<");
    expect(source).not.toContain(">Claim Tracker<");
    expect(source).not.toContain(">Story Timeline<");
    expect(source).not.toContain(">Multi-source clusters<");
    expect(source).not.toContain(">Consensus Board<");
  });

  it("prioritizes lead art and lazy-loads secondary story art", async () => {
    const source = await readFile(
      new URL("./news-public-front-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('import Image from "next/image"');
    expect(source).toContain("priority = false");
    expect(source).toContain("alt={`Visual for ${item.title}`}");
    expect(source).toContain('loading={priority ? "eager" : "lazy"}');
    expect(source).toContain('fetchPriority={priority ? "high" : "auto"}');
    expect(source).toContain(
      "<StoryImage formatCategory={formatCategory} item={lead} priority",
    );
    expect(source).not.toContain("backgroundImage:");
  });
});

describe("edition landing routes", () => {
  it("routes topics and sources through the shared edition page", async () => {
    const topicRoute = await readFile(
      new URL("../topics/[category]/page.tsx", import.meta.url),
      "utf8",
    );
    const sourceRoute = await readFile(
      new URL("../sources/[slug]/page.tsx", import.meta.url),
      "utf8",
    );
    const editionPage = await readFile(
      new URL("./news-edition-page.tsx", import.meta.url),
      "utf8",
    );

    expect(topicRoute).toContain("getNewsEditionPageData({");
    expect(topicRoute).toContain('kind: "topic"');
    expect(topicRoute).toContain("<NewsEditionPage");
    expect(sourceRoute).toContain("getNewsEditionPageData({");
    expect(sourceRoute).toContain('kind: "source"');
    expect(sourceRoute).toContain("<NewsEditionPage");
    expect(editionPage).toContain("The New AI Times");
    expect(editionPage).toContain("<NewsEditionReaderLens");
    expect(editionPage).toContain("filter={edition.filter}");
    expect(editionPage).toContain("riverItems.map");
    expect(editionPage).toContain("No matching stories");
  });
});

describe("NewsHome discovery navigation", () => {
  it("exposes briefing, directory, reader memory, and RSS discovery links from the front page", async () => {
    const source = await readFile(
      new URL("./news-public-front-page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('href="/briefing"');
    expect(source).toContain('href="/topics"');
    expect(source).toContain('href="/entities"');
    expect(source).toContain('href="/sources"');
    expect(source).toContain('href="/reader/library"');
    expect(source).toContain('href="/rss.xml"');
  });

  it("records homepage inline search intent before it steers recommendations", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const recordSearchIntentStart = source.indexOf(
      "const recordHomeSearchIntent = useCallback(",
    );
    const recordSearchIntentEnd = source.indexOf(
      "  const applyForYouApiExposureMemory = useCallback(",
      recordSearchIntentStart,
    );
    const recordSearchIntentBlock = source.slice(
      recordSearchIntentStart,
      recordSearchIntentEnd,
    );

    expect(source).toContain("recordStoredNewsSearchMemoryItem");
    expect(source).toContain("recordHomeSearchIntent");
    expect(source).toContain("setSearchMemoryItems(readStoredSearchItems())");
    expect(source).toContain("trpc.news.recordSearchMemory.mutationOptions");
    expect(recordSearchIntentStart).toBeGreaterThanOrEqual(0);
    expect(recordSearchIntentEnd).toBeGreaterThan(recordSearchIntentStart);
    expect(recordSearchIntentBlock).toContain(
      "if (!canPersistProfile) return;",
    );
    expect(recordSearchIntentBlock).toContain("if (!visitorKey) return;");
    expect(recordSearchIntentBlock).toContain("recordSearchMemory({");
    expect(recordSearchIntentBlock).toContain("visitorKey,");
    expect(source).toMatch(
      /recordHomeSearchIntent\(\{\s*query: trimmedSearchDraft,\s*resultCount: items\.length/,
    );
  });

  it("keeps homepage search in-page so server search memory can persist", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const applyExploreSearchStart = source.indexOf(
      "const applyExploreSearch = (event: FormEvent<HTMLFormElement>) => {",
    );
    const applyExploreSearchEnd = source.indexOf(
      "  const clearExploreFilters = () => {",
      applyExploreSearchStart,
    );
    const applyExploreSearchBlock = source.slice(
      applyExploreSearchStart,
      applyExploreSearchEnd,
    );

    expect(applyExploreSearchStart).toBeGreaterThanOrEqual(0);
    expect(applyExploreSearchEnd).toBeGreaterThan(applyExploreSearchStart);
    expect(applyExploreSearchBlock).toMatch(
      /event\.preventDefault\(\);\s*const trimmedSearchDraft = searchDraft\.trim\(\);/,
    );
    expect(applyExploreSearchBlock).toMatch(
      /if \(!trimmedSearchDraft\) return;/,
    );
    expect(applyExploreSearchBlock).toContain(
      "setSearchQuery(trimmedSearchDraft);",
    );
    expect(applyExploreSearchBlock).toContain("query: trimmedSearchDraft,");
  });

  it("persists home exposure memory locally before cooldown guidance runs", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("homeExposureStorageKey");
    expect(source).toContain("readStoredHomeExposureItems");
    expect(source).toContain("setLocalHomeExposureItems");
    expect(source).toContain("toLocalHomeExposureMemoryItem");
    expect(source).toContain("writeStoredMemoryItems(homeExposureStorageKey");
    expect(source).toMatch(
      /recordedItems: mergeNewsReaderMemoryItems\(\{[\s\S]*?localItems: localHomeExposureItems,[\s\S]*?serverItems: recordedHomeExposureItemsRef\.current,[\s\S]*?\}\)/,
    );
  });

  it("clears local saved and positive anchors when Less is recorded", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const recordStoryActionStart = source.indexOf(
      "  const recordStoryAction = (",
    );
    const recordStoryActionEnd = source.indexOf(
      "  const restoreGuardrailItem = (",
      recordStoryActionStart,
    );
    const recordStoryActionBlock = source.slice(
      recordStoryActionStart,
      recordStoryActionEnd,
    );
    const hideActionStart = recordStoryActionBlock.indexOf(
      '    if (action === "hide") {',
    );
    const hideActionEnd = recordStoryActionBlock.indexOf(
      '    if (action === "click_source" || action === "save" || action === "share")',
      hideActionStart,
    );
    const hideActionBlock = recordStoryActionBlock.slice(
      hideActionStart,
      hideActionEnd,
    );

    expect(recordStoryActionStart).toBeGreaterThanOrEqual(0);
    expect(recordStoryActionEnd).toBeGreaterThan(recordStoryActionStart);
    expect(hideActionStart).toBeGreaterThanOrEqual(0);
    expect(hideActionEnd).toBeGreaterThan(hideActionStart);
    expect(hideActionBlock).toContain("setLocalSavedItems((current) => {");
    expect(hideActionBlock).toMatch(
      /removeNewsReaderMemoryItem\({[\s\S]*?item,[\s\S]*?itemId: item\.id,[\s\S]*?items: current,[\s\S]*?}\)/,
    );
    expect(hideActionBlock).toContain(
      "writeStoredMemoryItems(savedStorageKey, nextItems);",
    );
    expect(hideActionBlock).toContain(
      "setPositiveFeedbackItems((current) => {",
    );
    expect(hideActionBlock).toContain("removeNewsHomePositiveFeedbackItem({");
    expect(hideActionBlock).toContain(
      'removeNewsHomePositiveFeedbackActionItem({\n          action: "share",',
    );
    expect(hideActionBlock).toContain(
      'removeNewsHomePositiveFeedbackActionItem({\n          action: "click_source",',
    );
    expect(hideActionBlock).toContain(
      "writeStoredPositiveFeedbackItems(nextItems);",
    );
  });

  it("loads only feed data and revalidates the public homepage", async () => {
    const route = await readFile(
      new URL("../page.tsx", import.meta.url),
      "utf8",
    );
    const home = await readFile(
      new URL("./news-home.tsx", import.meta.url),
      "utf8",
    );

    expect(route).toContain("getNewsHomeFeedData()");
    expect(route).toContain("export const revalidate = 60;");
    expect(route).not.toContain('dynamic = "force-dynamic"');
    expect(route).not.toContain("env.");
    expect(route).not.toContain("deskStatus=");
    expect(route).not.toContain("authConfigured=");
    expect(route).not.toContain("refreshConfigured=");
    expect(home).not.toContain("deskStatus: NewsDeskStatus");
    expect(home).not.toContain("authConfigured: boolean");
    expect(home).not.toContain("refreshConfigured: boolean");
  });

  it("preserves story cluster keys across local home reader memory", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const savedHelperStart = source.indexOf("const toLocalSavedMemoryItem = (");
    const savedHelperEnd = source.indexOf(
      "const toLocalGuardrailMemoryItem = (",
      savedHelperStart,
    );
    const helperStart = source.indexOf(
      "const toLocalHomeExposureMemoryItem = (",
    );
    const helperEnd = source.indexOf(
      "const readNewsForYouApiExposureItems = (",
      helperStart,
    );
    const savedHelperBlock = source.slice(savedHelperStart, savedHelperEnd);
    const helperBlock = source.slice(helperStart, helperEnd);
    const guardrailHelperStart = savedHelperEnd;
    const guardrailHelperEnd = helperStart;
    const guardrailHelperBlock = source.slice(
      guardrailHelperStart,
      guardrailHelperEnd,
    );

    expect(savedHelperStart).toBeGreaterThanOrEqual(0);
    expect(savedHelperEnd).toBeGreaterThan(savedHelperStart);
    expect(savedHelperBlock).toContain(
      "...(item.clusterKey ? { clusterKey: item.clusterKey } : {})",
    );
    expect(guardrailHelperStart).toBeGreaterThanOrEqual(0);
    expect(guardrailHelperEnd).toBeGreaterThan(guardrailHelperStart);
    expect(guardrailHelperBlock).toContain(
      "...(item.clusterKey ? { clusterKey: item.clusterKey } : {})",
    );
    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helperBlock).toContain(
      "...(item.clusterKey ? { clusterKey: item.clusterKey } : {})",
    );
  });

  it("preserves API exposure cluster keys when hydrating local For You memory", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const readExposureStart = source.indexOf(
      "const readNewsForYouApiExposureItems = (",
    );
    const readExposureEnd = source.indexOf(
      "const readStoredHistoryItems =",
      readExposureStart,
    );
    const readExposureBlock = source.slice(readExposureStart, readExposureEnd);

    expect(readExposureStart).toBeGreaterThanOrEqual(0);
    expect(readExposureEnd).toBeGreaterThan(readExposureStart);
    expect(readExposureBlock).toContain('typeof item.clusterKey === "string"');
    expect(readExposureBlock).toContain("clusterKey: item.clusterKey");
  });

  it("posts local reader memory to the For You API when loading more stories", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("buildNewsHomeForYouApiRequestBody");
    expect(source).toContain('fetch("/api/news/for-you"');
    expect(source).toContain("negativeFeedbackItems");
    expect(source).toContain("positiveFeedbackItems");
    expect(source).toContain("searchMemoryItems");
  });

  it("posts selected positive feedback memory and separate reading history to the For You API", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const primaryRequestStart = source.indexOf(
      "const forYouApiRequestBody = useMemo",
    );
    const primaryRequestEnd = source.indexOf(
      "const forYouApiQuery = useQuery",
      primaryRequestStart,
    );
    const primaryRequestBlock = source.slice(
      primaryRequestStart,
      primaryRequestEnd,
    );
    const loadMoreRequestStart = source.indexOf(
      "buildNewsHomeForYouApiRequestBody({",
      source.indexOf('if (loadMoreRoute === "forYou")'),
    );
    const loadMoreRequestEnd = source.indexOf("}),", loadMoreRequestStart);
    const loadMoreRequestBlock = source.slice(
      loadMoreRequestStart,
      loadMoreRequestEnd,
    );
    const loadMoreCollaborativeSignalsStart = source.indexOf(
      "const collaborativeRankingSignals = useMemo",
    );
    const loadMoreCollaborativeSignalsEnd = source.indexOf(
      "const loadMoreStories = useCallback",
      loadMoreCollaborativeSignalsStart,
    );
    const loadMoreCollaborativeSignalsBlock = source.slice(
      loadMoreCollaborativeSignalsStart,
      loadMoreCollaborativeSignalsEnd,
    );

    expect(source).toMatch(
      /const positiveFeedbackAnchors = useMemo\([\s\S]*?selectNewsHomePositiveFeedbackAnchors\(\{[\s\S]*?explicitFeedbackItems: positiveFeedbackItems,[\s\S]*?historyItems,[\s\S]*?savedItems,[\s\S]*?\}\)/,
    );
    expect(source).toMatch(
      /const positiveFeedbackMemoryItems = useMemo\([\s\S]*?selectNewsHomePositiveFeedbackMemoryItems\(\{[\s\S]*?historyItems,[\s\S]*?positiveFeedbackItems,[\s\S]*?savedItems,[\s\S]*?serverPositiveFeedbackItems,[\s\S]*?\}\)/,
    );
    expect(source).toMatch(
      /getNewsHomeCollaborativeRankingSignals\(\{[\s\S]*?historyItems,[\s\S]*?positiveFeedbackItems: positiveFeedbackMemoryItems,[\s\S]*?savedItems,[\s\S]*?\}\)/,
    );
    expect(primaryRequestBlock).toContain(
      "positiveFeedbackItems: positiveFeedbackMemoryItems",
    );
    expect(loadMoreCollaborativeSignalsBlock).toContain(
      "positiveFeedbackItems: positiveFeedbackMemoryItems",
    );
    expect(loadMoreRequestBlock).toContain(
      "positiveFeedbackItems: positiveFeedbackMemoryItems",
    );
    expect(primaryRequestBlock).toContain("readingHistoryItems: historyItems");
    expect(loadMoreRequestBlock).toContain("readingHistoryItems: historyItems");
  });

  it("keeps passive reading history out of inline positive feedback memory", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const positiveFeedbackMemoryStart = source.indexOf(
      "const positiveFeedbackMemoryItems = useMemo(() => {",
    );
    const positiveFeedbackMemoryEnd = source.indexOf(
      "  const positiveFeedbackAnchors = useMemo(",
      positiveFeedbackMemoryStart,
    );
    const positiveFeedbackMemoryBlock = source.slice(
      positiveFeedbackMemoryStart,
      positiveFeedbackMemoryEnd,
    );

    expect(positiveFeedbackMemoryStart).toBeGreaterThanOrEqual(0);
    expect(positiveFeedbackMemoryEnd).toBeGreaterThan(
      positiveFeedbackMemoryStart,
    );
    expect(positiveFeedbackMemoryBlock).toContain(
      "selectNewsHomePositiveFeedbackMemoryItems({",
    );
    expect(positiveFeedbackMemoryBlock).not.toContain("historyItems.flatMap");
    expect(positiveFeedbackMemoryBlock).not.toContain(
      "getLatestNewsReaderMemoryTimestamp",
    );
  });

  it("posts merged reading exposure memory to the For You API", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const primaryRequestStart = source.indexOf(
      "const forYouApiRequestBody = useMemo",
    );
    const primaryRequestEnd = source.indexOf(
      "const forYouApiQuery = useQuery",
      primaryRequestStart,
    );
    const primaryRequestBlock = source.slice(
      primaryRequestStart,
      primaryRequestEnd,
    );
    const loadMoreRequestStart = source.indexOf(
      "buildNewsHomeForYouApiRequestBody({",
      source.indexOf('if (loadMoreRoute === "forYou")'),
    );
    const loadMoreRequestEnd = source.indexOf("}),", loadMoreRequestStart);
    const loadMoreRequestBlock = source.slice(
      loadMoreRequestStart,
      loadMoreRequestEnd,
    );

    expect(source).toMatch(
      /const recentExposureMemoryItems = useMemo\([\s\S]*?mergeNewsReaderMemoryItems\(\{[\s\S]*?limit: 80,[\s\S]*?localItems: localHomeExposureItems,[\s\S]*?serverItems: historyItems\.map\(\(item\) => \(\{[\s\S]*?surface: "article"[\s\S]*?\}\)\),[\s\S]*?\}\)/,
    );
    expect(primaryRequestBlock).toContain(
      "recentExposureItems: recentExposureMemoryItems",
    );
    expect(loadMoreRequestBlock).toContain(
      "recentExposureItems: recentExposureMemoryItems",
    );
  });

  it("stores For You API next exposure memory before later pages are requested", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const primaryForYouEffectStart = source.indexOf(
      'if (primaryFeedRoute !== "forYou" || !forYouApiQuery.data) return;',
    );
    const primaryForYouEffectEnd = source.indexOf(
      "const serverRecommendedItems",
      primaryForYouEffectStart,
    );
    const primaryForYouEffectBlock = source.slice(
      primaryForYouEffectStart,
      primaryForYouEffectEnd,
    );

    expect(source).toContain("NewsHomeForYouApiNextRequest");
    expect(source).toContain("fetchNewsHomeForYouApiPayload");
    expect(source).toContain("readNewsForYouApiExposureItems");
    expect(source).toContain("readPercent: item.readPercent");
    expect(source).toContain("applyForYouApiExposureMemory");
    expect(source).toContain("unseenExposureItems");
    expect(primaryForYouEffectStart).toBeGreaterThanOrEqual(0);
    expect(primaryForYouEffectEnd).toBeGreaterThan(primaryForYouEffectStart);
    expect(source).toMatch(
      /selectActiveNewsReaderMemoryItem\(\{[\s\S]*?memoryItems: recordedHomeExposureItemsRef\.current/,
    );
    expect(primaryForYouEffectBlock).toMatch(
      /applyForYouApiExposureMemory\(\s*forYouApiQuery\.data\.nextRequest\?\.recentExposureItems,\s*\)/,
    );
    expect(primaryForYouEffectBlock).toContain(
      "setHasMoreItems(forYouApiQuery.data.hasMore)",
    );
    expect(source).toMatch(
      /const forYouApiPayload =\s*await fetchNewsHomeForYouApiPayload/,
    );
    expect(source).toMatch(
      /applyForYouApiExposureMemory\(\s*forYouApiPayload\.nextRequest\?\.recentExposureItems,\s*\)/,
    );
    expect(source).toContain("nextItems = forYouApiPayload.items");
    expect(source).toContain("nextHasMoreItems = forYouApiPayload.hasMore");
  });

  it("replays For You API nextRequest semantic and collaborative memory when loading more", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const loadMoreForYouStart = source.indexOf(
      'if (loadMoreRoute === "forYou")',
    );
    const loadMoreForYouEnd = source.indexOf("} else {", loadMoreForYouStart);
    const loadMoreForYouBlock = source.slice(
      loadMoreForYouStart,
      loadMoreForYouEnd,
    );

    expect(source).toContain("NewsHomeForYouApiNextRequest | null");
    expect(source).toContain(
      "collaborativeSignals?: readonly NewsCollaborativeSignal[];",
    );
    expect(source).toContain(
      "semanticSimilarityMatches?: readonly NewsSemanticSimilarityMatch[];",
    );
    expect(source).toContain(
      "setForYouApiNextRequest(forYouApiQuery.data.nextRequest ?? null);",
    );
    expect(loadMoreForYouStart).toBeGreaterThanOrEqual(0);
    expect(loadMoreForYouEnd).toBeGreaterThan(loadMoreForYouStart);
    expect(loadMoreForYouBlock).toMatch(
      /collaborativeSignals:\s*forYouApiNextRequest\?\.collaborativeSignals \?\?\s*collaborativeRankingSignals/,
    );
    expect(loadMoreForYouBlock).toMatch(
      /semanticSimilarityMatches:\s*forYouApiNextRequest\?\.semanticSimilarityMatches \?\? \[\]/,
    );
    expect(loadMoreForYouBlock).toContain(
      "setForYouApiNextRequest(forYouApiPayload.nextRequest ?? null);",
    );
  });

  it("clears stale For You API nextRequest memory when the first-page request changes", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("getNewsHomeForYouApiNextRequestResetKey");
    expect(source).toMatch(
      /const forYouApiRequestKey = useMemo\(\s*\(\) =>\s*getNewsHomeForYouApiNextRequestResetKey\(forYouApiRequestBody\),\s*\[forYouApiRequestBody\],\s*\);/,
    );
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*setForYouApiNextRequest\(null\);\s*}, \[forYouApiRequestKey\]\);/,
    );
    expect(source).not.toMatch(
      /useEffect\(\(\) => \{\s*setForYouApiNextRequest\(null\);\s*}, \[forYouApiRequestBody\]\);/,
    );
  });

  it("uses the memory-aware For You API for the first personalized page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const fetchPayloadStart = source.indexOf(
      "const fetchNewsHomeForYouApiPayload = async",
    );
    const fetchPayloadEnd = source.indexOf(
      "export function NewsHome",
      fetchPayloadStart,
    );
    const fetchPayloadBlock = source.slice(fetchPayloadStart, fetchPayloadEnd);

    expect(source).toContain("const forYouApiQuery = useQuery({");
    expect(source).toContain("const forYouApiRequestKey = useMemo(");
    expect(source).toContain(
      'queryKey: ["news", "for-you-api", forYouApiRequestKey]',
    );
    expect(source).not.toContain(
      'queryKey: ["news", "for-you-api", forYouApiRequestBody]',
    );
    expect(source).toContain(
      "queryFn: () => fetchNewsHomeForYouApiPayload(forYouApiRequestBody)",
    );
    expect(source).toContain(
      "const { mutate: recordHomeExposure } = useMutation(",
    );
    expect(source).toContain(
      "records.forEach((record) => recordHomeExposure(record));",
    );
    expect(source).toContain("readerStateHydrated");
    expect(source).toContain("forYouApiQuery.data?.items ?? []");
    expect(fetchPayloadStart).toBeGreaterThanOrEqual(0);
    expect(fetchPayloadEnd).toBeGreaterThan(fetchPayloadStart);
    expect(fetchPayloadBlock).toContain('typeof payload.hasMore === "boolean"');
    expect(fetchPayloadBlock).toContain("? payload.hasMore : false");
  });

  it("waits for server reader memory before the first personalized API page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const forYouQueryStart = source.indexOf(
      "const forYouApiQuery = useQuery({",
    );
    const forYouQueryEnd = source.indexOf("});", forYouQueryStart);
    const forYouQueryBlock = source.slice(forYouQueryStart, forYouQueryEnd);

    expect(source).toMatch(
      /const serverReaderMemoryReady =\s*!canPersistProfile \|\|\s*!visitorKey \|\|\s*!\(\s*profileQuery\.isPending \|\|\s*savedQuery\.isPending \|\|\s*historyQuery\.isPending \|\|\s*positiveFeedbackQuery\.isPending \|\|\s*guardrailsQuery\.isPending \|\|\s*searchMemoryQuery\.isPending\s*\);/,
    );
    expect(forYouQueryBlock).toContain("serverReaderMemoryReady");
  });

  it("hydrates server explicit positive feedback before the first personalized API page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const positiveFeedbackHydrationEffectStart = source.indexOf(
      "useEffect(() => {\n    if (!positiveFeedbackQuery.data",
    );
    const positiveFeedbackHydrationEffectEnd = source.indexOf(
      "  }, [positiveFeedbackQuery.data]);",
      positiveFeedbackHydrationEffectStart,
    );
    const positiveFeedbackHydrationEffectBlock = source.slice(
      positiveFeedbackHydrationEffectStart,
      positiveFeedbackHydrationEffectEnd,
    );

    expect(source).toContain("const positiveFeedbackQuery = useQuery(");
    expect(source).toContain("trpc.news.positiveFeedback.queryOptions(");
    expect(positiveFeedbackHydrationEffectStart).toBeGreaterThanOrEqual(0);
    expect(positiveFeedbackHydrationEffectEnd).toBeGreaterThan(
      positiveFeedbackHydrationEffectStart,
    );
    expect(positiveFeedbackHydrationEffectBlock).toContain(
      "readStoredPositiveFeedbackItems()",
    );
    expect(positiveFeedbackHydrationEffectBlock).toContain(
      "mergeNewsHomePositiveFeedbackItems({",
    );
    expect(positiveFeedbackHydrationEffectBlock).toContain("currentItems");
    expect(positiveFeedbackHydrationEffectBlock).toContain("nextItem");
    expect(positiveFeedbackHydrationEffectBlock).toContain(
      "writeStoredPositiveFeedbackItems(nextPositiveFeedbackItems);",
    );
    expect(positiveFeedbackHydrationEffectBlock).toContain(
      "setPositiveFeedbackItems(nextPositiveFeedbackItems);",
    );
  });

  it("hydrates server search memory before the first personalized API page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const searchMemoryHydrationEffectStart = source.indexOf(
      "useEffect(() => {\n    if (!searchMemoryQuery.data",
    );
    const searchMemoryHydrationEffectEnd = source.indexOf(
      "  }, [searchMemoryQuery.data]);",
      searchMemoryHydrationEffectStart,
    );
    const searchMemoryHydrationEffectBlock = source.slice(
      searchMemoryHydrationEffectStart,
      searchMemoryHydrationEffectEnd,
    );

    expect(source).toContain("const searchMemoryQuery = useQuery(");
    expect(source).toContain("trpc.news.searchMemory.queryOptions(");
    expect(source).toMatch(
      /const serverReaderMemoryReady =\s*!canPersistProfile \|\|\s*!visitorKey \|\|\s*!\(\s*profileQuery\.isPending \|\|\s*savedQuery\.isPending \|\|\s*historyQuery\.isPending \|\|\s*positiveFeedbackQuery\.isPending \|\|\s*guardrailsQuery\.isPending \|\|\s*searchMemoryQuery\.isPending\s*\);/,
    );
    expect(searchMemoryHydrationEffectStart).toBeGreaterThanOrEqual(0);
    expect(searchMemoryHydrationEffectEnd).toBeGreaterThan(
      searchMemoryHydrationEffectStart,
    );
    expect(searchMemoryHydrationEffectBlock).toContain(
      "readStoredSearchItems()",
    );
    expect(searchMemoryHydrationEffectBlock).toContain(
      "writeStoredSearchItems(nextSearchMemoryItems);",
    );
    expect(searchMemoryHydrationEffectBlock).toContain(
      "setSearchMemoryItems(nextSearchMemoryItems);",
    );
  });

  it("keeps For You load-more behind server reader memory", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const loadMoreForYouStart = source.indexOf(
      'if (loadMoreRoute === "forYou")',
    );
    const loadMoreForYouEnd = source.indexOf("} else {", loadMoreForYouStart);
    const loadMoreForYouBlock = source.slice(
      loadMoreForYouStart,
      loadMoreForYouEnd,
    );

    expect(loadMoreForYouBlock).toMatch(
      /if \(!serverReaderMemoryReady\) \{\s*pendingForYouLoadMoreRetryRef\.current = true;\s*return;\s*\}/,
    );
    expect(source).toMatch(
      /serverReaderMemoryReady,[\s\S]*?scopedItems,[\s\S]*?searchQuery/,
    );
  });

  it("retries a blocked For You load-more after server reader memory becomes ready", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const loadMoreForYouStart = source.indexOf(
      'if (loadMoreRoute === "forYou")',
    );
    const loadMoreForYouEnd = source.indexOf("} else {", loadMoreForYouStart);
    const loadMoreForYouBlock = source.slice(
      loadMoreForYouStart,
      loadMoreForYouEnd,
    );
    const retryEffectStart = source.indexOf(
      "useEffect(() => {\n    if (!serverReaderMemoryReady) return;",
    );
    const retryEffectEnd = source.indexOf("  }, [", retryEffectStart);
    const retryEffectBlock = source.slice(retryEffectStart, retryEffectEnd);

    expect(source).toContain(
      "const pendingForYouLoadMoreRetryRef = useRef(false)",
    );
    expect(loadMoreForYouBlock).toMatch(
      /if \(!serverReaderMemoryReady\) \{\s*pendingForYouLoadMoreRetryRef\.current = true;\s*return;\s*\}/,
    );
    expect(retryEffectStart).toBeGreaterThanOrEqual(0);
    expect(retryEffectBlock).toContain("if (!serverReaderMemoryReady) return;");
    expect(retryEffectBlock).toContain(
      'getNewsHomeLoadMoreQueryRoute({ feedMode }) !== "forYou"',
    );
    expect(retryEffectBlock).toContain(
      "pendingForYouLoadMoreRetryRef.current = false;",
    );
    expect(retryEffectBlock).toContain("void loadMoreStories();");
  });

  it("syncs a local trained profile into the server profile on the first visitor session", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("serverProfileSyncSnapshotRef");
    expect(source).toContain("getNewsPreferenceProfileStorageValue(profile)");
    expect(source).toMatch(
      /if \(!profileQuery\.data \|\| profileQuery\.data\.persisted\) return;/,
    );
    expect(source).toMatch(
      /areNewsPreferenceProfilesEqual\(\s*profile,\s*createDefaultNewsPreferenceProfile\(\),\s*\)/,
    );
    expect(source).toMatch(
      /updateProfile\.mutate\(\{\s*visitorKey,\s*profile: toServerProfile\(profile\),\s*\}\)/,
    );
  });

  it("does not issue the legacy tRPC For You query beside the memory-aware API", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).not.toContain(
      "trpc.news.forYou.queryOptions(primaryFeedInput",
    );
    expect(source).toContain("forYouApiQuery.data?.items ?? []");
  });

  it("refreshes all local reader memory when storage changes", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /return subscribeToNewsReaderMemoryStorage\(\(\) => \{[\s\S]*?const storedGuardrails = readStoredGuardrailItems\(\);[\s\S]*?const storedHomeExposureItems = readStoredHomeExposureItems\(\);[\s\S]*?const storedRestoredGuardrailItemIds =[\s\S]*?readStoredRestoredGuardrailItemIds\(\);[\s\S]*?setLocalHomeExposureItems\(storedHomeExposureItems\);[\s\S]*?setLocalHistoryItems\(readStoredHistoryItems\(\)\);[\s\S]*?setLocalSavedItems\(readStoredSavedItems\(\)\);[\s\S]*?setLocalGuardrailItems\(storedGuardrails\);[\s\S]*?setPositiveFeedbackItems\(readStoredPositiveFeedbackItems\(\)\);[\s\S]*?setSearchMemoryItems\(readStoredSearchItems\(\)\);[\s\S]*?setRestoredGuardrailItemIds\(storedRestoredGuardrailItemIds\);[\s\S]*?setHiddenItemIds\(/,
    );
  });
});

describe("Firebase reader authentication", () => {
  it("exposes Lingui login, account, and email callback surfaces", async () => {
    const readSource = (url: URL) => readFile(url, "utf8").catch(() => "");
    const [callback, menu, modal, providers, view] = await Promise.all([
      readSource(
        new URL("../auth/callback/email-callback.tsx", import.meta.url),
      ),
      readSource(new URL("./auth-menu.tsx", import.meta.url)),
      readSource(new URL("./LoginModal.tsx", import.meta.url)),
      readSource(new URL("../../providers/app-providers.tsx", import.meta.url)),
      readSource(new URL("./news-public-front-page.tsx", import.meta.url)),
    ]);

    expect(view).toContain("<AuthMenu");
    expect(providers).toContain("<LinguiClientProvider>");
    expect(providers).toContain("<AuthProvider>");
    expect(providers).toContain("<NiceModal.Provider>");
    expect(modal).toContain("NiceModal.create");
    expect(modal).toContain("@acme/ui/dialog");
    expect(modal).toContain("<Trans>");
    expect(modal).toContain("signInWithGoogle");
    expect(menu).toContain("Modals.LoginModal");
    expect(menu).toContain("signOut");
    expect(callback).toContain("isSignInWithEmailLink");
    expect(callback).toContain("emailForSignInKey");
    expect(callback).toContain('type="email"');
    expect(callback).toContain("<Trans>");
  });
});
