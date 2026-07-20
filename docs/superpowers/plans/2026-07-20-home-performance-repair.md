# Homepage Performance Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the homepage personalization request loop and reduce initial server, hydration, and image-loading work without changing the UI.

**Architecture:** Keep the complete For You request body for the network call, but identify the React Query entry with the existing stable request key that excludes passive exposure hydration. Split feed-only homepage data from desk health, cache anonymous homepage HTML for 60 seconds, and render prioritized/lazy story images with the existing aspect-ratio layout.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack React Query, tRPC, Vitest, TypeScript, Tailwind CSS.

---

## File Map

- Modify `apps/nextjs/src/app/_components/news-home.test.ts`: add source-level regression coverage for the stable query key, feed-only route, removed props, ISR, stable exposure mutation, and image loading.
- Modify `apps/nextjs/src/app/_components/news-home.tsx`: use the stable request key, destructure the exposure mutation function, and remove unused homepage props.
- Modify `apps/nextjs/src/app/_data/news.test.ts`: cover feed-only live, empty, and unavailable data.
- Modify `apps/nextjs/src/app/_data/news.ts`: add `getNewsHomeFeedData` and compose it with desk health in `getNewsHomeData`.
- Modify `apps/nextjs/src/app/page.tsx`: load feed-only data and export 60-second revalidation.
- Modify `apps/nextjs/src/app/_components/news-public-front-page.tsx`: replace CSS story backgrounds with prioritized/lazy `next/image` elements.

### Task 1: Stop Passive Exposure From Requerying the Primary Feed

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`

- [ ] **Step 1: Write the failing component-source regression test**

Replace the full-body query-key expectation in
`uses the memory-aware For You API for the first personalized page` and add the
mutation-function assertions:

```ts
expect(source).toContain(
  "const forYouApiRequestKey = useMemo(",
);
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
expect(source).toContain("records.forEach(recordHomeExposure);");
```

Keep the existing pure
`getNewsHomeForYouApiNextRequestResetKey` tests. They already prove that recent
exposure changes preserve the key while objective, collaborative signals,
semantic signals, and reading history change it.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: FAIL because the query key still contains
`forYouApiRequestBody` and the mutation result is not destructured.

- [ ] **Step 3: Implement the stable primary query identity**

In `news-home.tsx`, destructure the exposure mutation:

```ts
const { mutate: recordHomeExposure } = useMutation(
  trpc.news.recordInteraction.mutationOptions(),
);
```

Create the stable key before `forYouApiQuery`, use it for both React Query and
the existing next-request reset, and leave the full body in `queryFn`:

```ts
const forYouApiRequestKey = useMemo(
  () => getNewsHomeForYouApiNextRequestResetKey(forYouApiRequestBody),
  [forYouApiRequestBody],
);
const forYouApiQuery = useQuery({
  enabled:
    primaryFeedEnabled &&
    primaryFeedRoute === "forYou" &&
    readerStateHydrated &&
    serverReaderMemoryReady,
  queryFn: () => fetchNewsHomeForYouApiPayload(forYouApiRequestBody),
  queryKey: ["news", "for-you-api", forYouApiRequestKey],
});
useEffect(() => {
  setForYouApiNextRequest(null);
}, [forYouApiRequestKey]);
```

Remove `forYouApiNextRequestResetKey`. Change exposure persistence to:

```ts
if (canPersistProfile) {
  records.forEach(recordHomeExposure);
}
```

Keep `recordHomeExposure` in the effect dependency list.

- [ ] **Step 4: Run focused model and component tests and verify GREEN**

Run:

```bash
pnpm -F @acme/nextjs test -- \
  src/app/_components/news-home.test.ts \
  src/app/_components/news-home-model.test.ts
```

Expected: both files PASS with no query-key regression.

### Task 2: Remove Desk Aggregates From the Public Homepage

**Files:**

- Modify: `apps/nextjs/src/app/_data/news.test.ts`
- Modify: `apps/nextjs/src/app/_data/news.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: `apps/nextjs/src/app/page.tsx`

- [ ] **Step 1: Write failing feed-data and route tests**

Import `getNewsHomeFeedData` in `_data/news.test.ts` and add:

```ts
describe("getNewsHomeFeedData", () => {
  it("returns live stories without requesting desk status", async () => {
    newsDbMock.reset();
    newsDbMock.queueResults({ resolve: [liveNewsRow] });

    const data = await getNewsHomeFeedData();

    expect(data.status).toBe("ready");
    expect(data.items[0]?.id).toBe(liveNewsRow.id);
    expect(newsDbMock.select).toHaveBeenCalledTimes(1);
  });

  it("returns the unavailable preview when the feed query fails", async () => {
    newsDbMock.reset();

    const data = await getNewsHomeFeedData();

    expect(data.status).toBe("unavailable");
    expect(data.items[0]?.id).toBe("preview-model-shift");
    expect(newsDbMock.select).toHaveBeenCalledTimes(1);
  });
});
```

Call `newsDbMock.select.mockClear()` inside `newsDbMock.reset()` so call-count
assertions are isolated.

Replace the obsolete auth-readiness test in `news-home.test.ts` with:

```ts
it("loads only feed data and revalidates the public homepage", async () => {
  const route = await readFile(new URL("../page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("./news-home.tsx", import.meta.url), "utf8");

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
```

- [ ] **Step 2: Run the data and route tests and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- \
  src/app/_data/news.test.ts \
  src/app/_components/news-home.test.ts
```

Expected: FAIL because `getNewsHomeFeedData` and `revalidate` do not exist and
the route still passes unused props.

- [ ] **Step 3: Extract feed-only data**

In `_data/news.ts`, introduce:

```ts
interface NewsHomeFeedData {
  items: NewsHomeItem[];
  status: NewsHomeStatus;
}

export const getNewsHomeFeedData = async (): Promise<NewsHomeFeedData> => {
  try {
    const rows = await db
      .select({
        id: NewsItem.id,
        title: NewsItem.title,
        summary: NewsItem.summary,
        canonicalUrl: NewsItem.canonicalUrl,
        clusterKey: NewsItem.clusterKey,
        imageUrl: NewsItem.imageUrl,
        originalUrl: NewsItem.originalUrl,
        publishedAt: NewsItem.publishedAt,
        category: NewsItem.category,
        tags: NewsItem.tags,
        entities: NewsItem.entities,
        sourceScore: NewsItem.sourceScore,
        trendScore: NewsItem.trendScore,
        sourceName: NewsSource.name,
        sourceSlug: NewsSource.slug,
        sourceType: NewsSource.sourceType,
      })
      .from(NewsItem)
      .innerJoin(NewsSource, eq(NewsItem.sourceId, NewsSource.id))
      .where(eq(NewsItem.status, "published"))
      .orderBy(...buildNewsHomeCandidateOrderByExpressions())
      .limit(90);
    const liveItems = selectInitialNewsHomeItems({
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt.toISOString(),
      })),
      limit: 30,
    });

    return {
      items: liveItems.length > 0 ? liveItems : getPreviewNewsHomeItems(),
      status: liveItems.length > 0 ? "ready" : "empty",
    };
  } catch {
    return {
      items: getPreviewNewsHomeItems(),
      status: "unavailable",
    };
  }
};
```

Replace `getNewsHomeData` with composition that keeps desk consumers working:

```ts
export const getNewsHomeData = async (): Promise<NewsHomeData> => {
  const [feed, deskStatus] = await Promise.all([
    getNewsHomeFeedData(),
    getNewsDeskStatus().catch(() => getUnavailableNewsDeskStatus()),
  ]);

  return { ...feed, deskStatus };
};
```

- [ ] **Step 4: Simplify the route and client props**

In `page.tsx`, remove the environment import and use:

```tsx
import { NewsHome } from "./_components/news-home";
import { getNewsHomeFeedData } from "./_data/news";

export const revalidate = 60;

export default async function HomePage() {
  const data = await getNewsHomeFeedData();

  return (
    <NewsHome
      generatedAt={new Date().toISOString()}
      initialItems={data.items}
      status={data.status}
    />
  );
}
```

In `news-home.tsx`, remove the `NewsDeskStatus` type import and reduce props to:

```ts
interface NewsHomeProps {
  generatedAt: string;
  initialItems: NewsHomeItem[];
  status: NewsHomeStatus;
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm -F @acme/nextjs test -- \
  src/app/_data/news.test.ts \
  src/app/_components/news-home.test.ts \
  src/app/_components/news-directory-page.test.tsx
```

Expected: all three files PASS; directory routes still receive desk status.

### Task 3: Prioritize the Lead Image and Lazy-Load Secondary Images

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-public-front-page.tsx`

- [ ] **Step 1: Write the failing image-loading source test**

Add to `public news homepage`:

```ts
it("prioritizes lead art and lazy-loads secondary story art", async () => {
  const source = await readFile(
    new URL("./news-public-front-page.tsx", import.meta.url),
    "utf8",
  );

  expect(source).toContain('import Image from "next/image"');
  expect(source).toContain("priority = false");
  expect(source).toContain("alt={`Visual for ${item.title}`}");
  expect(source).toContain('loading={priority ? "eager" : "lazy"}');
  expect(source).toContain(
    'fetchPriority={priority ? "high" : "auto"}',
  );
  expect(source).toContain(
    "<StoryImage formatCategory={formatCategory} item={lead} priority",
  );
  expect(source).not.toContain("backgroundImage:");
});
```

- [ ] **Step 2: Run the homepage test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: FAIL because `StoryImage` still uses a CSS background.

- [ ] **Step 3: Implement responsive image loading without changing layout**

Import `Image` and add a pass-through loader:

```ts
import Image from "next/image";

const passThroughNewsImageLoader = ({ src }: { src: string }) => src;
```

Add `priority?: boolean` to `StoryImage`, default it to `false`, remove the
background style and render:

```tsx
<div
  className={`${aspect === "wide" ? "aspect-video" : "aspect-[4/3]"} relative flex w-full items-end overflow-hidden border border-[#171717]/20 bg-[#e9e4da] p-4 dark:border-white/20 dark:bg-[#23211e]`}
>
  {item.imageUrl ? (
    <Image
      alt={`Visual for ${item.title}`}
      className="object-cover"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      fill
      loader={passThroughNewsImageLoader}
      loading={priority ? "eager" : "lazy"}
      sizes={
        aspect === "wide"
          ? "(min-width: 1024px) 50vw, 100vw"
          : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
      }
      src={item.imageUrl}
      unoptimized
    />
  ) : (
    <div className="flex w-full items-end justify-between gap-4">
      <span className="max-w-[70%] font-serif text-xl leading-tight font-bold sm:text-2xl">
        {formatCategory(item.category)}
      </span>
      <span className="font-mono text-sm font-bold text-[#8b1e18] dark:text-[#ff8378]">
        {item.sourceName}
      </span>
    </div>
  )}
</div>
```

Pass `priority` only to the A1 lead call. Leave editor and stream calls
unchanged so they remain lazy.

- [ ] **Step 4: Run the homepage test and verify GREEN**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: PASS with the existing publication structure and auth-menu tests.

### Task 4: Full Verification and Runtime Regression

**Files:**

- Verify all modified files.

- [ ] **Step 1: Run the complete Next.js test suite**

```bash
pnpm -F @acme/nextjs test
```

Expected: all Vitest files PASS with zero failures.

- [ ] **Step 2: Run static verification**

```bash
pnpm -F @acme/nextjs typecheck
pnpm -F @acme/nextjs lint
pnpm -F @acme/nextjs format
git diff --check
```

Expected: all commands exit 0 with no TypeScript, ESLint, formatting, or
whitespace errors.

- [ ] **Step 3: Run the production build**

```bash
pnpm -F @acme/nextjs build
```

Expected: Next.js production build exits 0 and reports `/` as a revalidated
route rather than a forced-dynamic route.

- [ ] **Step 4: Verify the original symptom in a browser**

Start the built app or development app using the repository's existing env:

```bash
pnpm -F @acme/nextjs dev
```

Open `/` in a clean browser session, wait ten seconds, and inspect the network
log. Acceptance:

- exactly one initial `POST /api/news/for-you`;
- zero automatic follow-up For You requests after exposure hydration;
- no repeated `news.recordInteraction` storm;
- lead art loads immediately;
- editor and stream art outside the viewport remain unloaded until scrolled;
- desktop/mobile and light/dark layouts remain visually unchanged;
- no browser console errors.

- [ ] **Step 5: Review the final diff and request commit permission**

```bash
git status --short
git diff --stat
git diff -- \
  apps/nextjs/src/app/_components/news-home.test.ts \
  apps/nextjs/src/app/_components/news-home.tsx \
  apps/nextjs/src/app/_components/news-public-front-page.tsx \
  apps/nextjs/src/app/_data/news.test.ts \
  apps/nextjs/src/app/_data/news.ts \
  apps/nextjs/src/app/page.tsx
```

Confirm only the planned files changed. Do not commit implementation changes
until the user explicitly authorizes a commit.
