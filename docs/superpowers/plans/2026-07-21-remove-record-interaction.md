# Remove Record Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `news.recordInteraction` and the homepage exposure feedback loop while preserving local reader controls.

**Architecture:** Delete the per-item mutation at every client call site and from the tRPC router. Keep browser-state UX and explicit profile settings, but remove automatic exposure collection from the active recommendation request so passive rendering cannot trigger network writes or feed refreshes.

**Tech Stack:** Next.js 16, React 19, tRPC, TanStack Query, TypeScript, Vitest

---

### Task 1: Remove client interaction transport

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home-model.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-edition-page.test.tsx`
- Modify: `apps/nextjs/src/app/_components/news-threads-page.test.tsx`
- Modify: `apps/nextjs/src/app/news/_components/news-article.test.tsx`
- Modify: `apps/nextjs/src/app/news/_components/news-article-model.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home-model.ts`
- Modify: `apps/nextjs/src/app/_components/news-edition-story-actions.tsx`
- Modify: `apps/nextjs/src/app/_components/news-threads-page.tsx`
- Modify: `apps/nextjs/src/app/news/_components/news-article.tsx`

- [ ] **Step 1: Write failing client-removal tests**

Assert that the relevant component sources do not contain
`trpc.news.recordInteraction`, `recordHomeExposure`, or the homepage exposure
storage/effect symbols. Assert that the local storage/state update blocks for
Save and Less remain.

- [ ] **Step 2: Verify the client tests fail**

```bash
pnpm -F @acme/nextjs exec vitest run \
  src/app/_components/news-home.test.ts \
  src/app/_components/news-edition-page.test.tsx \
  src/app/_components/news-threads-page.test.tsx \
  src/app/news/_components/news-article.test.tsx
```

Expected: assertions report the existing mutation and exposure symbols.

- [ ] **Step 3: Remove the client mutation and exposure loop**

Delete all `recordInteraction` mutation declarations and calls. Delete the
homepage automatic exposure effect, exposure hydration, exposure storage
subscription, and API exposure-memory feedback. Build recommendation exposure
context from local article history only.

- [ ] **Step 4: Remove the unused exposure selector**

Delete `NewsHomeExposureRecord`, `selectNewsHomeExposureRecords`, and their
dedicated tests after confirming no production caller remains.

- [ ] **Step 5: Verify the client tests pass**

Run the command from Step 2, then:

```bash
pnpm -F @acme/nextjs typecheck
```

Expected: tests and type checking pass with no `recordInteraction` client
reference.

### Task 2: Remove the server procedure

**Files:**

- Modify: `packages/api/src/router/news.test.ts`
- Modify: `packages/api/src/router/news.ts`

- [ ] **Step 1: Write a failing router-removal test**

Read `news.ts` and assert it does not contain
`recordInteraction: publicProcedure` or `NewsRecordInteractionInputSchema`.

- [ ] **Step 2: Verify the API test fails**

```bash
pnpm -F @acme/api exec vitest run src/router/news.test.ts
```

Expected: the router-removal assertion reports the existing procedure and
schema.

- [ ] **Step 3: Delete the procedure and write-only helpers**

Delete the procedure, its input schema, and helpers used only to validate,
deduplicate, reconcile, or insert new interaction requests. Preserve helpers
used for historical interaction reads, profile replay, saved/history queries,
or removal operations.

- [ ] **Step 4: Remove obsolete API tests and imports**

Delete tests dedicated only to the removed input schema, procedure source
block, home-exposure dedupe, durable-feedback write dedupe, and write conflict
cleanup. Keep tests for historical reads and removal behavior.

- [ ] **Step 5: Verify the API tests pass**

```bash
pnpm -F @acme/api test
pnpm -F @acme/api typecheck
```

Expected: all API tests and type checking pass with no procedure reference.

### Task 3: Verify the deletion end to end

**Files:**

- Verify all files changed in Tasks 1 and 2
- Verify: `docs/superpowers/specs/2026-07-21-remove-record-interaction-design.md`
- Verify: `docs/superpowers/plans/2026-07-21-remove-record-interaction.md`

- [ ] **Step 1: Prove the symbol is gone**

```bash
rg -n "recordInteraction|recordHomeExposure" apps/nextjs/src packages/api/src
```

Expected: no output.

- [ ] **Step 2: Run formatting, type checking, and linting**

```bash
pnpm -F @acme/nextjs format
pnpm -F @acme/nextjs typecheck
pnpm -F @acme/nextjs lint
pnpm -F @acme/api format
pnpm -F @acme/api typecheck
pnpm -F @acme/api lint
```

Expected: all commands pass.

- [ ] **Step 3: Run complete tests**

```bash
pnpm -F @acme/nextjs test
pnpm -F @acme/api test
```

Expected: all test files pass.

- [ ] **Step 4: Run the production build**

```bash
cd apps/nextjs
pnpm exec dotenv -e /Users/fengliu/Desktop/tfm/thenewaitimes/.env -- next build
```

Expected: the production build completes successfully.

- [ ] **Step 5: Audit the final diff**

```bash
git diff --check
git status --short
git diff --stat
```

Expected: only scoped client, API, tests, and design documents changed.
