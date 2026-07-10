# TechCrunch-Style News Homepage Implementation Plan

> Execute in the `techcrunch-homepage` worktree. Do not commit or push without a new explicit user request.

**Goal:** Replace the public homepage's internal-dashboard presentation with a compact technology-news publication layout while preserving the existing feed, personalization, memory, and pagination behavior.

**Architecture:** Keep `NewsHomeContent` as the stateful controller. Add a pure selector for mutually exclusive lead/latest/most-read/editor-pick groups and a bounded public view component for layout. Retain the existing query and action callbacks, and delete public-only diagnostic computations that no longer render.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Vitest, `@acme/ui`.

## Task 1: Lock The Public Contract

**Files:**
- Create: `apps/nextjs/src/app/_components/news-public-front-page-model.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

1. Add failing selector tests for chronology, ranking, and no duplicate IDs across first-viewport groups.
2. Add failing source-contract tests requiring Latest, Most Read, Editor's Picks, Latest News, and For You access.
3. Require removal of Front Page Layout, Slot Mix, Source Clusters, Claim Tracker, Story Timeline, Multi-source clusters, and Consensus Board from the public view.
4. Run only the new and changed tests and confirm the expected failures.

## Task 2: Implement Editorial Selection

**Files:**
- Create: `apps/nextjs/src/app/_components/news-public-front-page-model.ts`
- Test: `apps/nextjs/src/app/_components/news-public-front-page-model.test.ts`

1. Implement a pure `selectNewsPublicFrontPage` function using existing `RankedNewsItem<NewsHomeItem>` data.
2. Select A1 first, Latest by publication time, Most Read by existing trend/rank signals, and Editor's Picks by source trust plus category/source diversity.
3. Share one exclusion set across all featured groups and expose the remaining chronological stream.
4. Run the focused selector tests until green.

## Task 3: Build The Publication View

**Files:**
- Create: `apps/nextjs/src/app/_components/news-public-front-page.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

1. Add the compact masthead and horizontally usable channel navigation.
2. Build the responsive first-viewport layout: lead, Latest, and numbered Most Read, with mobile ordering lead-first.
3. Add Editor's Picks and the 15-to-20-item Latest News stream.
4. Reuse existing story links and callbacks for Save, Less, Share, Latest / For You, search, and Load More.
5. Use semantic markup, stable image ratios, deliberate missing-image fallbacks, and accessible labels/tooltips.
6. Run focused component/source tests until green.

## Task 4: Remove Retired Public Computation

**Files:**
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: affected source-contract tests only where they describe the old homepage

1. Remove markup and memoized computations used only by retired analysis sections.
2. Remove imports, local types, state, and handlers made unreachable by that deletion without changing shared model APIs used by other routes.
3. Keep recommendation diagnostics available on Reader and Lab routes.
4. Run Next.js typecheck and focused tests, then fix only regressions caused by the homepage change.

## Task 5: Verify The Experience

**Files:**
- Modify if needed: `.gitignore`

1. Run the full Next.js test suite, typecheck, lint, production build, and `git diff --check`.
2. Start the local Next.js server and verify desktop and mobile layouts with browser screenshots.
3. Check light/dark rendering, navigation overflow, missing-image fallback, actions, feed mode, and Load More.
4. Confirm the public homepage contains no retired analysis headings and report all verification results.
