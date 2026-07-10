# Reader-First Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public homepage into a focused AI-news edition and move advanced recommendation transparency into a dedicated noindex Reader Lab.

**Architecture:** Keep the existing reader identity, tRPC queries, local-storage hydration, profile mutations, and pure recommendation models. Reuse the `NewsReaderCenter` controller for both reader surfaces, add a separate lab view, and replace the homepage's multi-thousand-line diagnostic aside with one compact For You rail. Remove diagnostic computations from `NewsHome` after their rendering is removed so the initial response and client work both decrease.

**Tech Stack:** Next.js App Router, React client components, TypeScript, TanStack Query and tRPC, `@acme/ui`, Vitest, React server rendering tests. The repository does not currently have Lingui dependencies or catalog configuration, so this refactor follows its existing English-string convention without regenerating catalogs.

---

## File Structure

- Create `apps/nextjs/src/app/_components/news-recommendation-lab.tsx`: read-only advanced recommendation transparency view that consumes `NewsReaderCenterData`.
- Create `apps/nextjs/src/app/_components/news-recommendation-lab.test.tsx`: model-view coverage for populated and empty lab states.
- Create `apps/nextjs/src/app/reader/lab/page.tsx`: noindex server route that loads current news data and renders the lab surface.
- Modify `apps/nextjs/src/app/_components/news-reader-center.tsx`: reuse the existing hydration and persistence controller for either the center or lab view and link Reader Center to the lab.
- Modify `apps/nextjs/src/app/_components/news-reader-center.test.tsx`: cover the lab link and controller surface selection.
- Modify `apps/nextjs/src/app/_components/news-home.tsx`: retain news modules and replace the current diagnostic aside with a compact For You rail.
- Modify `apps/nextjs/src/app/_components/news-home.test.ts`: lock the public-home content boundary.
- Modify `apps/nextjs/src/app/_components/news-home-model.test.ts`: remove source-order expectations that intentionally require retired homepage diagnostics while preserving pure model tests.

## Task 1: Lock The Public Homepage Contract

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

- [ ] **Step 1: Add a failing source contract test**

Add `readFile` to the test imports and add this test near the existing homepage source tests:

```ts
import { readFile } from "node:fs/promises";

describe("NewsHome public surface", () => {
  it("keeps news and lightweight training while excluding lab diagnostics", async () => {
    const source = await readFile(
      new URL("./news-home.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("For You Control Strip");
    expect(source).toContain("Channel Rail");
    expect(source).toContain("Load more");
    expect(source).toContain('href="/reader"');

    for (const labHeading of [
      "Experiment Allocation",
      "Model Training Batch",
      "Profile Update Proposal",
      "Recommendation Audit",
      "Ranking Pipeline",
      "Reader Cohorts",
    ]) {
      expect(source).not.toContain(`>${labHeading}<`);
    }
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: FAIL because the current homepage still renders the listed diagnostic headings.

- [ ] **Step 3: Leave production code unchanged**

This task establishes the public contract only. Do not weaken the assertions to make the current page pass.

## Task 2: Add The Recommendation Lab View

**Files:**

- Create: `apps/nextjs/src/app/_components/news-recommendation-lab.test.tsx`
- Create: `apps/nextjs/src/app/_components/news-recommendation-lab.tsx`

- [ ] **Step 1: Write failing populated and empty-state tests**

Create the test file with a small `NewsReaderCenterData` fixture produced by `getNewsReaderCenterData`:

```tsx
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NewsHomeItem } from "./news-home-model";
import { getNewsReaderCenterData } from "./news-reader-center";
import { NewsRecommendationLabView } from "./news-recommendation-lab";

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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-recommendation-lab.test.tsx
```

Expected: FAIL because `news-recommendation-lab.tsx` does not exist.

- [ ] **Step 3: Implement the focused lab view**

Create `news-recommendation-lab.tsx` as a client component. Import `Link` and `NewsReaderCenterData`. Render exactly these five sections from existing center data:

```tsx
"use client";

import Link from "next/link";

import { Button } from "@acme/ui/button";

import type { NewsReaderCenterData } from "./news-reader-center";

export function NewsRecommendationLabView({
  center,
}: {
  center: NewsReaderCenterData;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5ef] text-[#161616] transition-colors dark:bg-[#101010] dark:text-[#f4f1ea]">
      <header className="border-b border-[#161616] dark:border-[#f4f1ea]">
        <div className="container grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <Link
              className="font-mono text-xs uppercase hover:underline"
              href="/"
            >
              The New AI Times
            </Link>
            <h1 className="mt-4 text-4xl leading-none font-black sm:text-6xl">
              Recommendation Lab
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4a4a4a] dark:text-[#c8c4ba]">
              Inspect the ranking inputs and reader signals shaping the current
              edition.
            </p>
          </div>
          <Button asChild className="rounded-none" variant="outline">
            <Link href="/reader">Open Reader Center</Link>
          </Button>
        </div>
      </header>

      <div className="container grid gap-8 py-6 lg:grid-cols-2">
        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Ranking Inputs</h2>
          <div className="mt-4 grid gap-3">
            {center.rankingInputs.map((input) => (
              <article
                className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                key={input.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{input.label}</h3>
                  <span className="font-mono text-xs">
                    {input.statusLabel} / {input.weightLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {input.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Training Signals</h2>
          <div className="mt-4 grid gap-3">
            {center.trainingSignals.map((signal) => (
              <article
                className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                key={`${signal.label}-${signal.tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{signal.label}</h3>
                  <span className="font-mono text-xs">
                    {signal.tone} / {signal.weightLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {signal.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Profile Impact</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {center.profileImpact.summary}
          </p>
          <div className="mt-4 grid gap-3">
            {center.profileImpact.stories.map((story) => (
              <article
                className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                key={story.href}
              >
                <Link
                  className="font-semibold hover:underline"
                  href={story.href}
                >
                  {story.title}
                </Link>
                <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                  {story.sourceName} / {story.reason}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Recommendation Audit</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
            {center.recommendationAudit.summary}
          </p>
          <div className="mt-4 grid gap-3">
            {center.recommendationAudit.stories.length > 0 ? (
              center.recommendationAudit.stories.map((story) => (
                <article
                  className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                  key={story.href}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      className="font-semibold hover:underline"
                      href={story.href}
                    >
                      {story.title}
                    </Link>
                    <span className="font-mono text-xs">
                      {story.signalCountLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
                    {story.sourceName} / {story.summary}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {story.signals.map((signal) => (
                      <div
                        className="border-t border-[#161616]/15 pt-2 text-sm dark:border-[#f4f1ea]/10"
                        key={`${story.href}-${signal.label}`}
                      >
                        <span className="font-semibold">{signal.label}</span>
                        <p className="mt-1 leading-5 text-[#5b5750] dark:text-[#bbb4aa]">
                          {signal.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="border-t border-[#161616]/20 pt-3 text-sm leading-6 text-[#5b5750] dark:border-[#f4f1ea]/15 dark:text-[#bbb4aa]">
                No current stories are available for audit.
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-[#161616] pt-4 lg:col-span-2 dark:border-[#f4f1ea]">
          <h2 className="text-2xl font-black">Recent Signals</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {center.recentSignals.map((signal) => (
              <article
                className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15"
                key={`${signal.label}-${signal.href}`}
              >
                <span className="font-mono text-xs">{signal.label}</span>
                <Link
                  className="mt-1 block font-semibold hover:underline"
                  href={signal.href}
                >
                  {signal.title}
                </Link>
                <p className="mt-1 text-sm text-[#5b5750] dark:text-[#bbb4aa]">
                  {signal.sourceName}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
```

Keep the page read-only; all profile mutation controls remain in Reader Center.

- [ ] **Step 4: Run the lab tests and verify GREEN**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-recommendation-lab.test.tsx
```

Expected: PASS for both lab view tests.

- [ ] **Step 5: Request commit permission for the lab view batch**

After permission, stage only:

```bash
git add apps/nextjs/src/app/_components/news-recommendation-lab.tsx apps/nextjs/src/app/_components/news-recommendation-lab.test.tsx
git commit -m "feat(news): add recommendation lab view"
```

## Task 3: Reuse Reader Center Hydration For The Lab Route

**Files:**

- Create: `apps/nextjs/src/app/reader/lab/page.tsx`
- Modify: `apps/nextjs/src/app/_components/news-reader-center.tsx`
- Modify: `apps/nextjs/src/app/_components/news-reader-center.test.tsx`

- [ ] **Step 1: Add failing controller and navigation tests**

Add source assertions to `news-reader-center.test.tsx`:

```ts
describe("NewsReaderCenter lab surface", () => {
  it("selects the recommendation lab without duplicating hydration", async () => {
    const source = await readFile(
      new URL("./news-reader-center.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('surface = "center"');
    expect(source).toContain('surface === "lab"');
    expect(source).toContain("<NewsRecommendationLabView center={center} />");
    expect(source).toContain('href="/reader/lab"');
  });
});
```

Create a route source test beside the lab view test or in `news-reader-center.test.tsx`:

```ts
const routeSource = await readFile(
  new URL("../reader/lab/page.tsx", import.meta.url),
  "utf8",
);

expect(routeSource).toContain('surface="lab"');
expect(routeSource).toContain("index: false");
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-reader-center.test.tsx src/app/_components/news-recommendation-lab.test.tsx
```

Expected: FAIL because the surface prop, link, and route do not exist.

- [ ] **Step 3: Add the controller surface prop**

Import `NewsRecommendationLabView` and change the `NewsReaderCenter` signature:

```tsx
export function NewsReaderCenter({
  items = emptyNewsReaderCenterItems,
  status = "ready",
  surface = "center",
}: {
  items?: readonly NewsHomeItem[];
  status?: NewsHomeStatus;
  surface?: "center" | "lab";
}) {
  // The current query, hydration, mutation, and handler declarations stay above this return branch.
  return surface === "lab" ? (
    <NewsRecommendationLabView center={center} />
  ) : (
    <NewsReaderCenterView
      center={center}
      exportHref={getNewsReaderCenterExportHref(center)}
      onForYouObjectiveSelect={(objective) => {
        writeStoredNewsForYouObjective(objective);
        setCenter(readCurrentCenter());
      }}
      onImportProfile={canEditReaderCenterProfile ? importProfile : undefined}
      onProfileDraftSave={
        canEditReaderCenterProfile ? saveProfileDraft : undefined
      }
      onQuickStartApply={
        canEditReaderCenterProfile ? applyQuickStart : undefined
      }
      onMemoryTrainingSuggestionApply={
        canEditReaderCenterProfile ? applyMemoryTrainingSuggestion : undefined
      }
      onSearchIntentPromotionApply={
        canEditReaderCenterProfile ? applySearchIntentPromotion : undefined
      }
      onSearchMemoryRemove={removeSearchMemoryItem}
      onReset={canEditReaderCenterProfile ? resetReaderCenter : undefined}
    />
  );
}
```

Add one `@acme/ui` button link to `/reader/lab` in the Reader Center action group with the label `Recommendation Lab`.

- [ ] **Step 4: Add the noindex lab route**

Create `apps/nextjs/src/app/reader/lab/page.tsx`:

```tsx
import type { Metadata } from "next";

import { NewsReaderCenter } from "../../_components/news-reader-center";
import { getNewsHomeData } from "../../_data/news";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Inspect the recommendation inputs shaping The New AI Times on this device.",
  robots: { follow: false, index: false },
  title: "Recommendation Lab | The New AI Times",
};

export default async function NewsRecommendationLabPage() {
  const data = await getNewsHomeData();

  return (
    <NewsReaderCenter items={data.items} status={data.status} surface="lab" />
  );
}
```

- [ ] **Step 5: Run the focused tests and typecheck**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-reader-center.test.tsx src/app/_components/news-recommendation-lab.test.tsx
pnpm -F @acme/nextjs typecheck
```

Expected: PASS. No duplicate tRPC or local-storage controller is introduced.

- [ ] **Step 6: Request commit permission for the route batch**

After permission, stage only:

```bash
git add apps/nextjs/src/app/reader/lab/page.tsx apps/nextjs/src/app/_components/news-reader-center.tsx apps/nextjs/src/app/_components/news-reader-center.test.tsx
git commit -m "feat(news): route advanced recommendation diagnostics"
```

## Task 4: Replace The Homepage Diagnostic Aside

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home-model.test.ts`

- [ ] **Step 1: Re-run the public contract and confirm RED**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: FAIL on the forbidden diagnostic headings.

- [ ] **Step 2: Replace the entire current homepage `<aside>`**

Delete the current aside beginning immediately after the ranked stream's Load more control and ending before the closing two-column container. Replace it with this compact rail:

```tsx
<aside className="grid content-start gap-6">
  <section className="border border-[#161616] bg-[#fffdf7] p-5 dark:border-[#f4f1ea] dark:bg-[#181818]">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-black">For You</h2>
        <p className="mt-2 text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
          {readerSignalSummary.detail}
        </p>
      </div>
      <span className="shrink-0 border border-[#161616] px-2 py-1 font-mono text-sm dark:border-[#f4f1ea]">
        {leadStory?.personalizedScore ?? 0}
      </span>
    </div>

    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
        <dt>Saved</dt>
        <dd className="mt-1 font-mono text-lg">{savedItems.length}</dd>
      </div>
      <div className="border-t border-[#161616]/20 pt-3 dark:border-[#f4f1ea]/15">
        <dt>Less</dt>
        <dd className="mt-1 font-mono text-lg">{guardrailItems.length}</dd>
      </div>
    </dl>

    <div className="mt-4 grid gap-3">
      {rankedItems.slice(0, 3).map((story, index) => (
        <article
          className="grid gap-2 border-t border-[#161616]/20 pt-3 text-sm dark:border-[#f4f1ea]/15"
          key={story.id}
        >
          <Link
            className="leading-5 font-semibold hover:underline"
            href={`/news/${story.id}`}
          >
            {story.title}
          </Link>
          <p className="text-xs text-[#5b5750] dark:text-[#bbb4aa]">
            {story.sourceName} /{" "}
            {story.matchedSignals.join(", ") || "edition signal"}
          </p>
          <StoryAction
            item={story}
            guardrailItem={selectGuardrailItemForStory(story)}
            isPreview={isPreview}
            rankSlot={index + 1}
            savedItem={selectSavedItemForStory(story)}
            onAction={recordStoryAction}
            onRemoveSaved={removeSavedItem}
            onRestoreGuardrail={restoreGuardrailItem}
          />
        </article>
      ))}
    </div>

    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Button asChild className="rounded-none" variant="outline">
        <Link href="/reader">Reader Center</Link>
      </Button>
      <Button asChild className="rounded-none" variant="outline">
        <Link href="/reader/library">Library</Link>
      </Button>
    </div>
  </section>
</aside>
```

Do not add a homepage link to `/reader/lab`.

- [ ] **Step 3: Remove retired homepage source tests**

In `news-home-model.test.ts`, delete only source assertions whose purpose is to require a retired diagnostic section inside `news-home.tsx`. Keep every pure helper test. Add an assertion that the new lab source contains `Recommendation Audit` before removing any equivalent homepage source assertion.

- [ ] **Step 4: Run the public contract and verify GREEN**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts src/app/_components/news-home-model.test.ts
```

Expected: PASS. The homepage still contains the control strip, channel rail, story stream, and Reader Center link; lab headings are absent.

- [ ] **Step 5: Request commit permission for the public-surface batch**

After permission, stage only:

```bash
git add apps/nextjs/src/app/_components/news-home.tsx apps/nextjs/src/app/_components/news-home.test.ts apps/nextjs/src/app/_components/news-home-model.test.ts
git commit -m "refactor(news): focus the homepage on reading"
```

## Task 5: Remove Retired Homepage Computation

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.tsx`

- [ ] **Step 1: Run typecheck to enumerate dead declarations**

Run:

```bash
pnpm -F @acme/nextjs typecheck
```

Expected: FAIL with TS6133 for diagnostic-only values, event handlers, and imports that lost their only consumer when the aside was replaced.

- [ ] **Step 2: Remove dead code in dependency order**

Delete only declarations and imports reported unused. Work from the bottom of each dependency chain:

1. Removed JSX event handlers such as experiment, queue, audit, saturation, and tuning actions.
2. Their diagnostic view models such as experiment allocation, training batch, profile proposals, ranking pipeline, cohorts, queues, saturation, fatigue, and audit summaries.
3. Imports used only by those removed declarations.

Keep all code used by the lead story, search, control strip, channel rail, editorial packages, story stream, compact For You rail, Save, Less, profile persistence, infinite loading, and story actions. Do not alter `news-home-model.ts` in this task.

- [ ] **Step 3: Re-run typecheck after each cleanup group**

Run:

```bash
pnpm -F @acme/nextjs typecheck
```

Expected: the TS6133 list shrinks after each group and ends with exit 0. If a non-TS6133 error appears, stop and restore the required declaration rather than changing behavior.

- [ ] **Step 4: Verify the focused suites**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts src/app/_components/news-home-model.test.ts src/app/_components/news-reader-center.test.tsx src/app/_components/news-recommendation-lab.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Request commit permission for dead-code removal**

After permission, stage only:

```bash
git add apps/nextjs/src/app/_components/news-home.tsx
git commit -m "refactor(news): remove homepage lab computation"
```

## Task 6: Full Verification And Runtime Measurement

**Files:**

- Verify all files from Tasks 1-5.

- [ ] **Step 1: Run the Next.js test suite**

Run:

```bash
pnpm -F @acme/nextjs test
```

Expected: all tests pass.

- [ ] **Step 2: Run static verification**

Run:

```bash
pnpm -F @acme/nextjs typecheck
pnpm -F @acme/nextjs lint
git diff --check
```

Expected: all commands exit 0. The repository has no Lingui setup, so no catalog extraction is involved.

- [ ] **Step 3: Run the production build path**

Run:

```bash
pnpm run build:nextjs
```

Expected: build and standalone asset sync complete successfully. Do not run any DB build or migration command.

- [ ] **Step 4: Measure the new homepage response**

Start a clean local server on an unused port and request `/`:

```bash
PORT=3101 pnpm -F @acme/nextjs dev
curl -sS --max-time 60 http://127.0.0.1:3101/ -o /tmp/thenewagenttimes-home-after.html -w 'status=%{http_code} bytes=%{size_download} total=%{time_total}\n'
rg -o '<(a|button)(\\s|>)' /tmp/thenewagenttimes-home-after.html | sort | uniq -c
```

Expected: HTTP 200, response size materially below the 1,086,629-byte baseline, and button count materially below the 734-button baseline.

- [ ] **Step 5: Verify route content**

Request `/reader` and `/reader/lab`:

```bash
curl -sS --max-time 60 http://127.0.0.1:3101/reader | rg "Reader Center|Recommendation Lab"
curl -sS --max-time 60 http://127.0.0.1:3101/reader/lab | rg "Recommendation Lab|Ranking Inputs|Recommendation Audit"
```

Expected: Reader Center links to the lab, and the lab renders advanced transparency headings.

- [ ] **Step 6: Browser-check desktop, mobile, light, and dark modes**

Use the in-app Browser when available. Verify `/`, `/reader`, and `/reader/lab` at desktop and mobile widths. Check that navigation remains one line or horizontally scrollable, buttons do not wrap on desktop, mobile sections collapse to one column, both themes have readable contrast, and the console has no errors.

Expected: no overlap, clipped labels, horizontal page overflow, blank sections, or console errors. If the in-app Browser remains unavailable, report visual verification as not completed rather than substituting source inspection.

- [ ] **Step 7: Inspect exact repository state**

Run:

```bash
git status --short --branch
git diff --stat
```

Expected: only intended task files plus pre-existing unrelated work remain changed. Do not stage broad paths.
