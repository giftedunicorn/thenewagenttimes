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
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain('href="/briefing"');
    expect(source).toContain('href="/topics"');
    expect(source).toContain('href="/entities"');
    expect(source).toContain('href="/sources"');
    expect(source).toContain('href="/reader/library"');
    expect(source).toContain('href="/rss.xml"');
  });

  it("links front-page briefing entities into entity editions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("editionBriefing.entities.map");
    expect(source).toContain(
      "href={`/entities/${encodeURIComponent(entity.entity)}`}",
    );
  });

  it("links story timeline entities into entity editions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("storyTimeline.events.map");
    expect(source).toContain("href={`/entities/${encodeURIComponent(entity)}`}");
  });

  it("puts the A1 lead story before recommendation training controls", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const leadStoryIndex = source.indexOf("A1 Lead Story");
    const searchTrendsIndex = source.indexOf("Search Trends");
    const trainingControlsIndex = source.indexOf("For You Control Strip");

    expect(leadStoryIndex).toBeGreaterThanOrEqual(0);
    expect(searchTrendsIndex).toBeGreaterThan(leadStoryIndex);
    expect(trainingControlsIndex).toBeGreaterThan(leadStoryIndex);
  });

  it("labels story visuals and reserves a stable image frame", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain('role="img"');
    expect(source).toContain("aria-label={`Visual for ${item.title}`}");
    expect(source).toContain("aspect-[16/10]");
    expect(source).toContain("w-full max-w-full");
    expect(source).toContain(
      "aspect-[16/10] min-h-52 w-full max-w-full self-start",
    );
    expect(source).toMatch(
      /className="[^"]*grid[^"]*min-h-\[420px\][^"]*grid-cols-\[minmax\(0,1fr\)\][^"]*"/,
    );
    expect(source).toMatch(
      /className="[^"]*grid[^"]*grid-cols-\[minmax\(0,1fr\)\][^"]*gap-3[^"]*border/,
    );
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
    expect(recordSearchIntentBlock).toContain("if (!visitorKey) return;");
    expect(recordSearchIntentBlock).toContain("recordSearchMemory({");
    expect(recordSearchIntentBlock).toContain("visitorKey,");
    expect(source).toMatch(
      /recordHomeSearchIntent\(\{\s*query: lead\.query,\s*resultCount:/,
    );
    expect(source).toMatch(
      /recordHomeSearchIntent\(\{\s*query: trend\.query,\s*resultCount:/,
    );
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

  it("surfaces the next personalized page queue beside the home feed", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("getNewsForYouNextQueue");
    expect(source).toContain("const nextForYouQueue = getNewsForYouNextQueue");
    expect(source).toContain("Next For You Queue");
    expect(source).toContain("nextForYouQueue.nextRequest.excludeNewsItemIds");
    expect(source).toContain("nextForYouQueue.notices.map");
    expect(source).toContain("getNewsForYouNextQueueTrainingAction");
    expect(source).toContain("applyForYouNextQueueAction");
  });

  it("lets live wire notices train real-time recommendation preferences", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("getNewsLiveWire");
    expect(source).toContain("Live Wire");
    expect(source).toContain("liveWire.notices.map");
    expect(source).toContain("getNewsLiveWireTrainingAction");
    expect(source).toContain("applyLiveWireAction");
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

  it("posts merged explicit, saved, and history memory to the For You API", async () => {
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
      source.indexOf("if (loadMoreRoute === \"forYou\")"),
    );
    const loadMoreRequestEnd = source.indexOf(
      "}),",
      loadMoreRequestStart,
    );
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
      /const positiveFeedbackMemoryItems = useMemo\([\s\S]*?mergeNewsHomePositiveFeedbackItems\(\{[\s\S]*?currentItems,[\s\S]*?nextItem,[\s\S]*?\}\)/,
    );
    expect(source).toMatch(
      /const positiveFeedbackMemoryItems = useMemo\([\s\S]*?\.\.\.positiveFeedbackItems,[\s\S]*?\.\.\.serverPositiveFeedbackItems,[\s\S]*?\.\.\.savedItems\.flatMap/,
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
      source.indexOf("if (loadMoreRoute === \"forYou\")"),
    );
    const loadMoreRequestEnd = source.indexOf(
      "}),",
      loadMoreRequestStart,
    );
    const loadMoreRequestBlock = source.slice(
      loadMoreRequestStart,
      loadMoreRequestEnd,
    );

    expect(source).toMatch(
      /const recentExposureMemoryItems = useMemo\([\s\S]*?mergeNewsReaderMemoryItems\(\{[\s\S]*?limit: 80,[\s\S]*?localItems: localHomeExposureItems,[\s\S]*?serverItems: historyItems,[\s\S]*?\}\)/,
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

    expect(source).toContain("NewsHomeForYouApiNextRequest");
    expect(source).toContain("fetchNewsHomeForYouApiPayload");
    expect(source).toContain("readNewsForYouApiExposureItems");
    expect(source).toContain("applyForYouApiExposureMemory");
    expect(source).toContain("unseenExposureItems");
    expect(source).toMatch(
      /selectActiveNewsReaderMemoryItem\(\{[\s\S]*?memoryItems: recordedHomeExposureItemsRef\.current/,
    );
    expect(source).toMatch(
      /applyForYouApiExposureMemory\(\s*forYouApiQuery\.data\.nextRequest\?\.recentExposureItems,\s*\)/,
    );
    expect(source).toMatch(
      /const forYouApiPayload =\s*await fetchNewsHomeForYouApiPayload/,
    );
    expect(source).toMatch(
      /applyForYouApiExposureMemory\(\s*forYouApiPayload\.nextRequest\?\.recentExposureItems,\s*\)/,
    );
    expect(source).toContain("nextItems = forYouApiPayload.items");
  });

  it("passes the reader key into live search candidates for personalized ranking", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const searchCandidatesStart = source.indexOf(
      "trpc.news.searchCandidates.queryOptions",
    );
    const searchCandidatesEnd = source.indexOf(
      "},\n      { enabled: shouldFetchLiveSearchCandidates }",
      searchCandidatesStart,
    );
    const searchCandidatesBlock = source.slice(
      searchCandidatesStart,
      searchCandidatesEnd,
    );

    expect(searchCandidatesStart).toBeGreaterThanOrEqual(0);
    expect(searchCandidatesEnd).toBeGreaterThan(searchCandidatesStart);
    expect(searchCandidatesBlock).toContain(
      "profile: toServerProfile(profile)",
    );
    expect(searchCandidatesBlock).toContain("visitorKey");
  });

  it("renders live search recommendation reasons beside candidate leads", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("lead.reasonLabel");
    expect(source).toContain("{lead.reasonLabel} / {lead.topicLabel}");
  });

  it("wires live search leads into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /searchCandidateRail\.leads\.map\(\(lead, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(lead\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("uses the memory-aware For You API for the first personalized page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("const forYouApiQuery = useQuery({");
    expect(source).toContain(
      'queryKey: ["news", "for-you-api", forYouApiRequestBody]',
    );
    expect(source).toContain(
      "queryFn: () => fetchNewsHomeForYouApiPayload(forYouApiRequestBody)",
    );
    expect(source).toContain("readerStateHydrated");
    expect(source).toContain("forYouApiQuery.data?.items ?? []");
  });

  it("waits for server reader memory before the first personalized API page", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const forYouQueryStart = source.indexOf("const forYouApiQuery = useQuery({");
    const forYouQueryEnd = source.indexOf(
      "});",
      forYouQueryStart,
    );
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

  it("surfaces the live For You API context beside the training controls", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("const forYouApiContext = forYouApiQuery.data?.context");
    expect(source).toContain("const forYouApiContextMemory");
    expect(source).toContain("Live API context");
    expect(source).toContain("forYouApiContextMemory.map");
    expect(source).toContain("forYouApiContext.profileSignalCount");
    expect(source).toContain("forYouApiContext.memory.collaborativeSignals");
    expect(source).toContain("forYouApiContext.memory.semanticSimilarity");
  });

  it("uses angle-aware active checks for front-page preference angle controls", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const anglesControlStart = source.indexOf('<PreferenceGroup title="Angles">');
    const anglesControlEnd = source.indexOf(
      '<PreferenceGroup title="Entities">',
      anglesControlStart,
    );
    const anglesControlBlock = source.slice(
      anglesControlStart,
      anglesControlEnd,
    );

    expect(anglesControlStart).toBeGreaterThanOrEqual(0);
    expect(anglesControlEnd).toBeGreaterThan(anglesControlStart);
    expect(source).toContain("const hasAngleValue =");
    expect(anglesControlBlock).toMatch(
      /const active = hasAngleValue\(\s*profile\.preferredEntities,\s*angle\.signal,\s*\);/,
    );
    expect(anglesControlBlock).not.toContain(
      "entity.toLowerCase() === angle.signal.toLowerCase()",
    );
  });

  it("uses case-insensitive entity checks for front-page preference entity controls and toggles", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });
    const entitiesControlStart = source.indexOf(
      '<PreferenceGroup title="Entities">',
    );
    const entitiesControlEnd = source.indexOf(
      "</PreferenceGroup>",
      entitiesControlStart,
    );
    const entitiesControlBlock = source.slice(
      entitiesControlStart,
      entitiesControlEnd,
    );

    expect(entitiesControlStart).toBeGreaterThanOrEqual(0);
    expect(entitiesControlEnd).toBeGreaterThan(entitiesControlStart);
    expect(source).toContain("const hasEntityValue =");
    expect(source).toContain("const addEntityValue =");
    expect(source).toContain("const removeEntityValue =");
    expect(entitiesControlBlock).toMatch(
      /const active = hasEntityValue\(\s*profile\.preferredEntities,\s*entity,?\s*\);/,
    );
    expect(entitiesControlBlock).not.toContain(
      "profile.preferredEntities.includes(entity)",
    );
    expect(source).toMatch(
      /removeEntityValue\(\s*currentProfile\.preferredEntities,\s*signal\.signal,\s*\)/,
    );
    expect(source).toMatch(
      /addEntityValue\(\s*currentProfile\.preferredEntities,\s*signal\.signal,\s*\)/,
    );
    expect(source).toMatch(
      /removeEntityValue\(\s*beforeProfile\.preferredEntities,\s*suggestion\.signal,\s*\)/,
    );
    expect(source).toMatch(
      /addEntityValue\(\s*beforeProfile\.preferredEntities,\s*suggestion\.signal,\s*\)/,
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

  it("wires front-page briefing recommendations into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("const rankedItemsById = useMemo(");
    expect(source).toMatch(
      /briefingPack\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /frontPageLayout\.sections\.map\(\(section, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(section\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /frontPageSlotMix\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires evidence and timeline recommendations into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /sourceClusters\.clusters\.map\(\(cluster, index\) => \{[\s\S]*?const leadItem = cluster\.lead\s*\? rankedItemsById\.get\(cluster\.lead\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /claimTracker\.claims\.map\(\(claim, index\) => \{[\s\S]*?const leadItem = claim\.lead\s*\? rankedItemsById\.get\(claim\.lead\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /storyTimeline\.events\.map\(\(event, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(event\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires coverage thread recommendations into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /coverageThreads\.threads\.map\(\(thread, index\) => \{[\s\S]*?const leadItem = thread\.lead\s*\? rankedItemsById\.get\(thread\.lead\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /consensusBoard\.threads\.map\(\(thread, index\) => \{[\s\S]*?const leadStory = thread\.stories\[0\];[\s\S]*?const leadItem = leadStory\s*\? rankedItemsById\.get\(leadStory\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires sidebar reader queues into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /exposureCooldownQueue\.cooldowns\.map\(\(story, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerRetentionPlan\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /recommendationDiversityRepairQueue\.repairs\.map\(\s*\(repair, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(repair\.candidate\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /recommendationRotationQueue\.entries\.map\(\(entry, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(entry\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerJourneyMap\.steps\.map\(\(step, index\) => \{[\s\S]*?const item = step\.id\s*\? rankedItemsById\.get\(step\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerScorecards\.scorecards\.map\(\(scorecard, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(scorecard\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerDaypartPlan\.lanes\.map\(\(lane, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(lane\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerDigest\.nextReads\.map\(\(story, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readerWatchlist\.entries\.map\(\(entry, index\) => \{[\s\S]*?const item = entry\.topStory\s*\? rankedItemsById\.get\(entry\.topStory\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires growth and editorial story lanes into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /suggestion\.impactStories\.map\(\s*\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /lane\.proposals\.map\(\(proposal, proposalIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(proposal\.storyId\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{proposalIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /discoveryLadder\.rungs\.map\(\(rung, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(rung\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /guardrailRecoveryPlan\.candidates\.map\(\(candidate, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(candidate\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /breakingEscalationQueue\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
  });

  it("wires distribution and learning story lanes into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /personalizedPushQueue\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /newsletterPlan\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /membershipMeter\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /modelTrainingBatch\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
  });

  it("wires operations story lanes into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /distributionQueue\.queues\.map\(\(queue\) =>[\s\S]*?queue\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /nextRefreshPlan\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /aggregationIntake\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
    expect(source).toMatch(
      /alertRouting\.lanes\.map\(\(lane\) =>[\s\S]*?lane\.stories\.map\(\(story, storyIndex\) => \{[\s\S]*?const item = rankedItemsById\.get\(story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{storyIndex \+ 1\}/,
    );
  });

  it("wires next personalized page candidates into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /nextForYouQueue\.candidates\.map\(\(candidate, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(candidate\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires continuation follow-up recommendations into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /continuationRail\.followUps\.map\(\(followUp, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(followUp\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires session intent lead candidates into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /sessionIntent\.intents\.map\(\(intent, index\) => \{[\s\S]*?const leadItem = intent\.leadStory\s*\? rankedItemsById\.get\(intent\.leadStory\.id\)\s*: undefined;[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("wires signal board top-ranked stories into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /rankedItems\.slice\(0, 5\)\.map\(\(story, index\) => \{[\s\S]*?<StoryAction[\s\S]*?item=\{story\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });

  it("surfaces edition freshness inside the desk status panel", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toContain("getNewsDeskFreshnessStatus");
    expect(source).toContain("const deskFreshnessStatus");
    expect(source).toMatch(
      /<StatusLine[\s\S]*?label="Freshness"[\s\S]*?value=\{deskFreshnessStatus\.label\}/,
    );
    expect(source).toContain("{deskFreshnessStatus.detail}");
  });

  it("wires right-rail recommendation queues into reader story actions", async () => {
    const source = await readFile(new URL("./news-home.tsx", import.meta.url), {
      encoding: "utf8",
    });

    expect(source).toMatch(
      /missedCoverage\.stories\.map\(\(item, index\) => \{[\s\S]*?const story = rankedItemsById\.get\(item\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{story\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /liveWire\.updates\.map\(\(update, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(update\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /editionSchedule\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /readingQueue\.slots\.map\(\(slot, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(slot\.story\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /hotBoard\.entries\.map\(\(entry, index\) => \{[\s\S]*?const item = rankedItemsById\.get\(entry\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{item\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /channelComparison\.channels\.map\(\(channel, index\) => \{[\s\S]*?const leadItem = rankedItemsById\.get\(channel\.lead\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{leadItem\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /historyItems\.map\(\(item, index\) => \{[\s\S]*?const story = rankedItemsById\.get\(item\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{story\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
    expect(source).toMatch(
      /savedItems\.map\(\(item, index\) => \{[\s\S]*?const story = rankedItemsById\.get\(item\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{story\}[\s\S]*?rankSlot=\{index \+ 1\}[\s\S]*?savedItem=\{selectSavedItemForStory\(story\)\}/,
    );
    expect(source).toMatch(
      /guardrailShelf\.items\.map\(\(item, index\) => \{[\s\S]*?const story = rankedItemsById\.get\(item\.id\);[\s\S]*?<StoryAction[\s\S]*?item=\{story\}[\s\S]*?guardrailItem=\{selectGuardrailItemForStory\(story\)\}[\s\S]*?rankSlot=\{index \+ 1\}/,
    );
  });
});
