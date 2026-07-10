# Edition Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable topic and source landing pages so The New AI Times is no longer only a single front page.

**Architecture:** Reuse the existing server-side news data layer and preview fallback. Add a focused edition data helper, a reusable server-rendered edition page component, and two Next.js dynamic routes for `/topics/[category]` and `/sources/[slug]`. Keep recommendation and persistence systems unchanged.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind utilities, Vitest, existing `@acme/ui` components.

---

### Task 1: Edition Data Model

**Files:**

- Modify: `apps/nextjs/src/app/_data/news.test.ts`
- Modify: `apps/nextjs/src/app/_data/news.ts`

- [x] **Step 1: Write failing tests** for `getNewsEditionPageData`, proving topic/source filtering, preview fallback, and empty live results.
- [x] **Step 2: Run** `pnpm -F @acme/nextjs test -- src/app/_data/news.test.ts` and confirm the helper is missing.
- [x] **Step 3: Implement** `getNewsEditionPageData({ kind, value })` with exact category/source filtering and preview fallback.
- [x] **Step 4: Re-run** the focused test until it passes.

### Task 2: Edition Routes And Component

**Files:**

- Create: `apps/nextjs/src/app/_components/news-edition-page.tsx`
- Create: `apps/nextjs/src/app/topics/[category]/page.tsx`
- Create: `apps/nextjs/src/app/sources/[slug]/page.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

- [x] **Step 1: Write failing source contract tests** that require the topic/source routes and the reusable edition page component.
- [x] **Step 2: Run** `pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts` and confirm the files/imports are missing.
- [x] **Step 3: Implement** the routes as force-dynamic server pages that call `getNewsEditionPageData`.
- [x] **Step 4: Implement** the edition component with a newspaper-style lead, story grid, metrics, and empty state.
- [x] **Step 5: Re-run** the focused component contract test.

### Task 3: Homepage Navigation Links

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home-model.test.ts`

- [x] **Step 1: Write failing source contract tests** requiring topic/source chips to expose `/topics/` and `/sources/` links.
- [x] **Step 2: Run** `pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts -t "edition landing"`.
- [x] **Step 3: Wrap the existing chips with `Link` while preserving the existing filtering buttons.**
- [x] **Step 4: Re-run** the focused test.

### Task 4: Verification

**Files:**

- Verify all files above.

- [x] **Step 1: Run** `pnpm -F @acme/nextjs test -- src/app/_data/news.test.ts src/app/_components/news-home.test.ts src/app/_components/news-home-model.test.ts`.
- [x] **Step 2: Run** `pnpm -F @acme/nextjs typecheck`.
- [x] **Step 3: Run** `pnpm -F @acme/nextjs lint`.
- [x] **Step 4: Run** `pnpm -F @acme/nextjs format`.
- [x] **Step 5: Run** `pnpm run build:nextjs`.
- [x] **Step 6: Browser check** `/topics/agent-product` and `/sources/techcrunch-ai` locally.
- [x] **Step 7: Run** `git diff --check` and confirm no generated artifacts are left.
