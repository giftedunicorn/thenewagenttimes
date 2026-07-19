# The New AI Times Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize The New AI Times / `thenewaitimes` across the repository, GitHub, Railway, production URLs, and local checkout.

**Architecture:** Treat `The New AI Times` as the display brand and `thenewaitimes` as the stable technical slug. Preserve database and Railway resource IDs while renaming human-readable resources and host references in one coordinated rollout.

**Tech Stack:** TypeScript, Next.js, Vitest, pnpm workspaces, GitHub CLI, Railway CLI and GraphQL.

---

### Task 1: Rename Repository-Owned Identifiers

**Files:**

- Modify: `package.json`
- Modify: `apps/nextjs/src/auth/server.ts`
- Modify: `apps/nextjs/src/app/_components/news-structured-data.ts`
- Modify: affected tests under `apps/nextjs/src`
- Modify: `packages/ingestion/src/remote-health.test.ts`

- [ ] Replace the root package name with `thenewaitimes`.
- [ ] Replace production fallback hosts with `thenewaitimes.com`.
- [ ] Replace `.test` hosts and Railway fixture hosts with `thenewaitimes`.
- [ ] Run focused Next.js and ingestion tests and expect zero failures.
- [ ] Commit exact changed source and test files as `refactor(brand): rename technical product identifiers`.

### Task 2: Normalize Product Documentation

**Files:**

- Modify: `README.md`
- Modify: affected files under `docs/superpowers/specs`
- Modify: affected files under `docs/superpowers/plans`
- Create: `docs/superpowers/specs/2026-07-19-the-new-ai-times-rename-design.md`
- Create: `docs/superpowers/plans/2026-07-19-the-new-ai-times-rename.md`

- [ ] Replace old product names, repository slugs, and example URLs with the new identity.
- [ ] Preserve opaque Railway IDs and commit hashes unchanged.
- [ ] Run a case-insensitive repository scan and expect no old product names or slugs outside Git internals.
- [ ] Commit exact documentation files as `docs: document The New AI Times identity`.

### Task 3: Verify and Integrate

**Files:**

- Verify all files changed by Tasks 1 and 2.

- [ ] Run `pnpm typecheck` and expect all Turbo tasks to pass.
- [ ] Run `pnpm lint` and expect all Turbo tasks to pass.
- [ ] Run `pnpm run deploy:nextjs` and expect a successful standalone production build.
- [ ] Merge the feature branch into `main`.
- [ ] Push `main` to the current GitHub repository.

### Task 4: Rename GitHub and Railway

**Resources:**

- GitHub owner: `giftedunicorn`
- Railway project ID: `41f2f713-fc37-4c22-8be2-2c76dcc86ca6`
- Railway Web service ID: `950c9857-42ea-4f61-8f38-77a232621716`

- [ ] Rename the GitHub repository to `giftedunicorn/thenewaitimes`.
- [ ] Update local `origin` to `git@github.com:giftedunicorn/thenewaitimes.git`.
- [ ] Rename the Railway project and Web service to `thenewaitimes`.
- [ ] Update Web, Worker, and Cron source repositories to `giftedunicorn/thenewaitimes`.
- [ ] Update Worker and Cron `POSTGRES_URL` reference variables to `${{thenewaitimes.POSTGRES_URL}}`.
- [ ] Redeploy all application services from the synchronized `main` commit.

### Task 5: Cut Over URLs and Local Path

**Resources:**

- Railway Web service ID: `950c9857-42ea-4f61-8f38-77a232621716`
- Local parent directory: `/Users/fengliu/Desktop/tfm`

- [ ] Create or confirm a Railway-generated domain containing `thenewaitimes`.
- [ ] Verify `/api/news/health` returns `ready: true` on the new domain.
- [ ] Remove the old generated domain only after the new domain passes.
- [ ] Confirm all three Railway services use their expected `railway.json`.
- [ ] Remove the feature worktree and merged feature branch.
- [ ] Rename the legacy local checkout directory to `thenewaitimes`.
- [ ] Confirm the renamed checkout is clean and `HEAD` equals `origin/main`.
