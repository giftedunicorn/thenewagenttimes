# News Image Preservation and Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent refreshes from deleting known article images and provide a safe command that backfills missing images from publisher metadata while skipping articles that still have no usable image.

**Architecture:** Canonical-URL matches from a different source are corroborating signals, not permission to replace the first publisher record, so the repository will leave those records unchanged. Same-source refreshes will atomically retain the database's current image when an incoming feed temporarily omits it. A separate keyset-paginated backfill pipeline will pin validated public DNS addresses, extract stable `og:image` or `twitter:image` metadata, and conditionally update only rows whose image is still missing.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Vitest, Node.js fetch and DNS APIs.

---

### Task 1: Preserve publisher records and known images

**Files:**

- Modify: `packages/ingestion/src/repository.ts`
- Test: `packages/ingestion/src/repository.test.ts`

- [x] **Step 1: Write failing repository-policy tests**

Add tests for a pure refresh decision that rejects cross-source canonical matches, accepts same-source matches, and resolves an incoming missing image to the existing non-empty image.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm -F @acme/ingestion test -- repository.test.ts`

Expected: FAIL because the refresh-policy helpers do not exist.

- [x] **Step 3: Implement the minimal refresh policy**

Select `sourceId` with the existing record, return `duplicate` for a different source, and use the existing image as the effective update value when a same-source refresh has no image.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm -F @acme/ingestion test -- repository.test.ts`

Expected: PASS.

### Task 2: Extract safe page images

**Files:**

- Create: `packages/ingestion/src/news-image.ts`
- Create: `packages/ingestion/src/news-image.test.ts`

- [x] **Step 1: Write failing metadata and URL-safety tests**

Cover Open Graph metadata, Twitter fallback, relative URLs, HTML entities, unsupported protocols, localhost, private IP literals, and pages without metadata.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm -F @acme/ingestion test -- news-image.test.ts`

Expected: FAIL because the image module does not exist.

- [x] **Step 3: Implement metadata extraction and public-host validation**

Parse `<meta>` attributes without depending on attribute order, resolve relative URLs against the article URL, allow only HTTP(S), and reject loopback/private/link-local hostnames and IP literals before any request.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm -F @acme/ingestion test -- news-image.test.ts`

Expected: PASS.

### Task 3: Add the database backfill pipeline and CLI

**Files:**

- Create: `packages/ingestion/src/image-backfill.ts`
- Create: `packages/ingestion/src/image-backfill.test.ts`
- Modify: `packages/ingestion/src/repository.ts`
- Modify: `packages/ingestion/src/cli.ts`
- Modify: `packages/ingestion/src/index.ts`
- Modify: `packages/ingestion/package.json`
- Modify: `package.json`

- [x] **Step 1: Write failing backfill behavior tests**

Use an in-memory repository to prove the pipeline updates valid metadata images, skips no-image and unsafe URLs, counts fetch failures, and never asks the repository to overwrite an existing image.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm -F @acme/ingestion test -- image-backfill.test.ts`

Expected: FAIL because the backfill pipeline does not exist.

- [x] **Step 3: Implement the pipeline and conditional database operations**

Add repository methods that keyset-scan every published row with a null/blank image and update by `id` only while the image remains null/blank. Fetch pages with a timeout and identify as `TheNewAITimes image backfill`; skip pages without usable metadata.

- [x] **Step 4: Add the CLI commands**

Expose `pnpm news:backfill-images [batchSize]`, scanning the current missing-image corpus in bounded pages and printing `seen`, `updated`, `skipped`, and `failed` counts plus row-level failure diagnostics.

- [x] **Step 5: Run the focused test and verify GREEN**

Run: `pnpm -F @acme/ingestion test -- image-backfill.test.ts`

Expected: PASS.

### Task 4: Verify the complete change

**Files:**

- Verify all files above.

- [x] **Step 1: Run ingestion tests**

Run: `pnpm -F @acme/ingestion test`

Expected: all tests pass.

- [x] **Step 2: Run ingestion typecheck and lint**

Run: `pnpm -F @acme/ingestion typecheck`

Run: `pnpm -F @acme/ingestion lint`

Expected: both commands exit 0.

- [x] **Step 3: Check formatting and the exact diff**

Run: `pnpm exec prettier --check packages/ingestion/src/repository.ts packages/ingestion/src/repository.test.ts packages/ingestion/src/news-image.ts packages/ingestion/src/news-image.test.ts packages/ingestion/src/image-backfill.ts packages/ingestion/src/image-backfill.test.ts packages/ingestion/src/cli.ts packages/ingestion/src/index.ts packages/ingestion/package.json package.json docs/superpowers/plans/2026-07-20-news-image-preservation-backfill.md`

Run: `git status --short && git diff --check`

Expected: formatting passes and `git diff --check` reports no whitespace errors.

No commit, push, deployment, or production backfill is part of this plan unless explicitly requested.
