# Background Jobs Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy scheduled news refresh and embedding as a PostgreSQL-backed cron/worker pipeline that is independent of Next.js request lifetimes.

**Architecture:** `@acme/cron` inserts idempotent jobs into a typed `background_job` table and exits. `@acme/background-worker` continuously claims jobs with PostgreSQL row locking, renews leases, executes existing `@acme/ingestion` functions, and records retryable or terminal outcomes. Next.js retains only fast authenticated producer endpoints.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, PostgreSQL, Zod, pnpm workspaces, Turbo, Railway Railpack and config-as-code.

---

## File Structure

- Create `packages/db/src/schemas/background-job.ts`: job enums, table, indexes,
  Zod payload schemas, and inferred types.
- Modify `packages/db/src/schema.ts`: re-export the background job schema.
- Create `packages/db/src/background-jobs.ts`: enqueue, claim, lease, completion,
  and retry persistence operations.
- Modify `packages/db/package.json`: export the queue module.
- Create `packages/background-worker/*`: worker package, processors, loop,
  tests, and Railway config.
- Create `packages/cron/*`: one-shot scheduled producer, tests, and Railway
  config.
- Modify Next.js refresh/embed route handlers to enqueue and return `202`.
- Remove obsolete remote bootstrap deployment scripts and environment variables.
- Simplify root and app Railway config to direct service commands.

## Task 1: Add The Background Job Schema

**Files:**

- Create: `packages/db/src/schemas/background-job.ts`
- Create: `packages/db/src/background-job-schema.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing schema test that imports `BackgroundJob`,
      `BackgroundJobTypeSchema`, and `BackgroundJobStatusSchema`, checks the two job
      types/four statuses, and checks the required table columns.
- [ ] Run `pnpm -F @acme/db test -- src/background-job-schema.test.ts` and
      confirm it fails because the exports do not exist.
- [ ] Implement the two PostgreSQL enums, `background_job` table, unique dedupe
      index, due-job indexes, payload/result JSON columns, retry counters, lease
      columns, and inferred TypeScript/Zod types.
- [ ] Re-export the schema from `packages/db/src/schema.ts`.
- [ ] Re-run the focused test and `pnpm -F @acme/db typecheck`.

Do not generate or run a migration.

## Task 2: Implement Queue State Transitions

**Files:**

- Create: `packages/db/src/background-jobs.ts`
- Create: `packages/db/src/background-jobs.test.ts`
- Modify: `packages/db/package.json`

- [ ] Write failing tests against an injected queue-store boundary for
      deterministic enqueue dedupe, retry delays, lease ownership, and terminal
      failure.
- [ ] Run `pnpm -F @acme/db test -- src/background-jobs.test.ts` and confirm the
      missing exports fail.
- [ ] Implement `enqueueBackgroundJob`, `claimNextBackgroundJob`,
      `renewBackgroundJobLease`, `completeBackgroundJob`, and
      `failBackgroundJob`.
- [ ] Use one transaction with `FOR UPDATE SKIP LOCKED` for claims and
      ownership-guarded updates for lease/completion/failure.
- [ ] Export `./background-jobs` from `packages/db/package.json`.
- [ ] Run the focused tests, DB tests, and DB typecheck.

## Task 3: Scaffold And Test The Worker Runtime

**Files:**

- Create: `packages/background-worker/package.json`
- Create: `packages/background-worker/tsconfig.json`
- Create: `packages/background-worker/eslint.config.ts`
- Create: `packages/background-worker/src/config.ts`
- Create: `packages/background-worker/src/config.test.ts`
- Create: `packages/background-worker/src/worker-loop.ts`
- Create: `packages/background-worker/src/worker-loop.test.ts`

- [ ] Write failing config tests for bounded positive integer environment
      values and default polling/concurrency/lease settings.
- [ ] Write failing loop tests proving idle polling, limited concurrency,
      processor errors, and graceful stop behavior through injected queue/sleep
      functions.
- [ ] Run the two focused test files and confirm missing module failures.
- [ ] Add package metadata and configs matching existing compiled packages.
- [ ] Implement the smallest config parser and worker loop that satisfy the
      tests without importing the process entry point.
- [ ] Run `pnpm install --lockfile-only`, focused tests, and worker typecheck.

## Task 4: Implement News Job Processors

**Files:**

- Create: `packages/background-worker/src/processors.ts`
- Create: `packages/background-worker/src/processors.test.ts`

- [ ] Write failing tests proving `news_refresh` calls the injected refresh
      function and enqueues embedding batch zero after success.
- [ ] Add failing tests proving `news_embed` validates payload, runs one batch,
      chains only a full batch, and rejects an unsupported job type.
- [ ] Run the focused processor tests and confirm the expected failures.
- [ ] Implement a discriminated processor dispatcher using schema types and
      injected ingestion/provider dependencies.
- [ ] Run processor tests and worker typecheck.

## Task 5: Add The Worker Process

**Files:**

- Create: `packages/background-worker/src/index.ts`
- Create: `packages/background-worker/railway.json`
- Modify: `turbo.json`

- [ ] Connect the worker loop to the real DB queue operations and existing
      ingestion functions.
- [ ] Add lease heartbeat and prevent stale owners from completing a job.
- [ ] Add `SIGINT`/`SIGTERM` draining and close the Drizzle PostgreSQL client.
- [ ] Add required worker environment variables to Turbo's allowlist.
- [ ] Define direct Railway build/start commands and `ALWAYS` restart policy.
- [ ] Run worker tests, typecheck, lint, and format.

Configuration-only process wiring is verified by package tests and a smoke start
with a deliberately missing `POSTGRES_URL`; it must fail immediately with a
clear configuration error.

## Task 6: Add The One-Shot Cron Producer

**Files:**

- Create: `packages/cron/package.json`
- Create: `packages/cron/tsconfig.json`
- Create: `packages/cron/eslint.config.ts`
- Create: `packages/cron/src/schedule.ts`
- Create: `packages/cron/src/schedule.test.ts`
- Create: `packages/cron/src/index.ts`
- Create: `packages/cron/railway.json`

- [ ] Write failing tests for UTC schedule-window dedupe keys and duplicate
      enqueue as a successful no-op.
- [ ] Run the focused test and confirm the missing module failure.
- [ ] Implement the deterministic schedule key and injected one-shot producer.
- [ ] Connect the process entry point to `enqueueBackgroundJob`, close the DB
      client in `finally`, and set a nonzero exit code on failure.
- [ ] Configure `cronSchedule`, direct build/start commands, and `NEVER` restart
      policy in Railway JSON.
- [ ] Run cron tests, typecheck, lint, and format.

## Task 7: Convert Next.js Operations To Fast Producers

**Files:**

- Modify: `apps/nextjs/src/app/api/news/refresh/handler.ts`
- Modify: `apps/nextjs/src/app/api/news/refresh/handler.test.ts`
- Modify: `apps/nextjs/src/app/api/news/refresh/route.ts`
- Modify: `apps/nextjs/src/app/api/news/embed/handler.ts`
- Modify: `apps/nextjs/src/app/api/news/embed/handler.test.ts`
- Modify: `apps/nextjs/src/app/api/news/embed/route.ts`

- [ ] Replace handler expectations with failing tests for authenticated enqueue,
      `202`, job ID/status output, duplicate output, and no long-task callback.
- [ ] Run both focused route-handler tests and confirm they fail against the old
      synchronous contract.
- [ ] Change handlers to call injected enqueue functions and return immediately.
- [ ] Wire routes to `enqueueBackgroundJob` with unique manual request keys.
- [ ] Run focused tests and Next.js typecheck.

## Task 8: Remove The Obsolete Remote Bootstrap Path

**Files:**

- Modify: `package.json`
- Modify: `packages/ingestion/package.json`
- Delete: `packages/ingestion/src/remote-bootstrap-cli.ts`
- Delete: `packages/ingestion/src/remote-bootstrap.ts`
- Delete: `packages/ingestion/src/remote-bootstrap.test.ts`
- Delete: `packages/ingestion/src/remote-refresh.ts`
- Delete: `packages/ingestion/src/remote-refresh.test.ts`
- Delete: `packages/ingestion/src/remote-embed-cli.ts`
- Delete: `packages/ingestion/src/remote-embed.ts`
- Delete: `packages/ingestion/src/remote-embed.test.ts`
- Delete: `packages/ingestion/src/remote-cli.ts`
- Modify: `packages/ingestion/src/index.ts`
- Modify: `turbo.json`

- [ ] Add a failing package-script test asserting the service-name multiplexer
      and remote bootstrap scripts are absent.
- [ ] Remove root `build:railway`, `predeploy:railway`, and `start:railway`
      branching plus obsolete remote scripts/exports.
- [ ] Remove obsolete `NEWS_BOOTSTRAP_*`, `NEWS_*_URL`, and
      `RAILWAY_PUBLIC_DOMAIN` dependencies from the cron pipeline.
- [ ] Keep the authenticated refresh secret for manual producer endpoints.
- [ ] Run ingestion tests, typecheck, and package-script tests.

## Task 9: Align Railway Config-As-Code

**Files:**

- Modify: `railway.json`
- Modify: `apps/nextjs/railway.json`
- Delete: `packages/api/railway.json`
- Delete: `packages/db/railway.json`
- Modify or delete: `apps/tanstack-start/railway.json`
- Create: `packages/background-worker/railway.test.ts`
- Create: `packages/cron/railway.test.ts`

- [ ] Write failing tests that parse Railway JSON and assert each service has a
      direct build/start command, worker restart policy, and cron schedule.
- [ ] Remove package configs that misleadingly deploy Next.js.
- [ ] Make the root and Next.js configs describe the web service directly.
- [ ] Validate every remaining Railway JSON file against Railway's published
      schema.
- [ ] Run Railway config tests and package typechecks.

## Task 10: Documentation And Full Verification

**Files:**

- Modify: `README.md`
- Modify: relevant deployment documentation found by `rg "news-refresh-cron|NEWS_BOOTSTRAP_URL|start:railway"`.

- [ ] Document the three Railway services, their config file paths, required
      variables, UTC schedule, and one-time Railway service config selection.
- [ ] Document that only the web predeploy command applies the schema.
- [ ] Run focused tests for DB, worker, cron, ingestion, and Next.js handlers.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm format`.
- [ ] Run `pnpm build` without running `@acme/db` migration/predeploy scripts.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff.
- [ ] Confirm no migration file was created and no DB update command was run.

Commits and pushes require separate user authorization under repository rules.
