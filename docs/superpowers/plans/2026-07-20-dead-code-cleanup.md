# Dead Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused Expo and TanStack Start applications, the abandoned Better Auth and Lingui integrations, and database/API contracts that have no remaining production consumer.

**Architecture:** Keep the active Next.js website, admin dashboard, Firebase identity mapping, news ingestion, recommendation, queue, worker, and cron paths intact. Delete legacy applications first, then collapse auth to its Firebase-only contract, remove the English-only Lingui wrapper, and finally remove schemas and API procedures whose only consumer was the deleted Expo app.

**Tech Stack:** pnpm workspaces, Turborepo, Next.js 16, Firebase Auth, tRPC, Drizzle ORM, Vitest, TypeScript.

---

## File Map

- Delete `apps/expo/**`: unused mobile application and assets.
- Delete `apps/tanstack-start/**`: unused experimental web application.
- Modify `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example`, `README.md`, and `pnpm-lock.yaml`: remove legacy applications, dependencies, scripts, environment variables, and documentation.
- Modify `AGENTS.md`: record that the current product is English-only and must not add i18n infrastructure unless explicitly requested.
- Modify `apps/nextjs/src/railway-config.test.ts`: remove tests that protected deleted applications and assert the active application boundary.
- Modify `packages/auth/package.json` and `packages/auth/src/index.ts`; delete Better Auth-only source, tests, env, and CLI files.
- Modify `apps/nextjs/src/env.ts`, `apps/nextjs/src/app/api/news/health/{handler.ts,handler.test.ts,route.ts}`; delete `apps/nextjs/src/auth/client.ts`: remove Better Auth health/configuration paths.
- Modify `apps/nextjs/package.json`, `apps/nextjs/src/providers/app-providers.tsx`, and three auth UI components; delete Lingui provider/config/Babel files.
- Modify `apps/nextjs/src/app/_components/news-home.test.ts`: replace Lingui assertions with English-only surface assertions.
- Modify `packages/db/src/auth-schema.ts` and `packages/db/src/schema.ts`: remove unused Better Auth tables/columns, unused Drizzle relation declarations and validation helpers, and the unconsumed `news_signal` table.
- Modify `packages/api/src/root.ts`, `packages/api/src/root.test.ts`, `packages/api/src/router/news.ts`, and `packages/api/src/router/news.test.ts`; delete `packages/api/src/router/auth.ts`: remove unconsumed routers and procedures.
- Modify `packages/api/src/router/news.test.ts`: pin the clock in two retention-window tests so the baseline remains stable.

### Task 1: Stabilize the Existing Search-Memory Tests

**Files:**

- Modify: `packages/api/src/router/news.test.ts`

- [ ] **Step 1: Pin the clock in the two failing tests**

Wrap each affected test body with the same fake-time pattern already used by the adjacent future-date test:

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-07-09T12:00:00.000Z"));

try {
  // existing assertion
} finally {
  vi.useRealTimers();
}
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
pnpm -F @acme/api test -- src/router/news.test.ts
```

Expected: all API tests pass, including the two retention-window cases that failed on the real 2026-07-20 clock.

### Task 2: Remove the Legacy Applications and Workspace Surface

**Files:**

- Delete: `apps/expo/**`
- Delete: `apps/tanstack-start/**`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `apps/nextjs/src/railway-config.test.ts`

- [ ] **Step 1: Update the repository-boundary test**

In `apps/nextjs/src/railway-config.test.ts`, remove all TanStack and Expo behavior tests. Replace the root build expectation with:

```ts
expect(rootPackage.scripts?.build).toBe("turbo run build");
expect(rootPackage.scripts).not.toHaveProperty("android");
expect(rootPackage.scripts).not.toHaveProperty("ios");
```

Add a test that reads `apps/` and proves only the active applications remain:

```ts
test("workspace contains only active web applications", async () => {
  const appDirectories = await readdir(path.join(repoRoot, "apps"));

  expect(appDirectories.sort()).toEqual(["admin", "nextjs"]);
});
```

Remove the fallback favicon comparison; the Next.js icon and manifest assertions remain authoritative.

- [ ] **Step 2: Delete both legacy applications**

Delete every tracked file beneath:

```text
apps/expo
apps/tanstack-start
```

- [ ] **Step 3: Remove workspace scripts and catalogs used only by deleted apps**

Set the root build script to:

```json
"build": "turbo run build"
```

Delete the root `android` and `ios` scripts. Remove these now-unused catalog entries:

```text
@better-auth/cli
@better-auth/expo
@tailwindcss/vite
@tanstack/react-form
@vitejs/plugin-react
better-auth
vite
```

Do not remove `vitest`, React Query, tRPC, or Firebase dependencies.

- [ ] **Step 4: Remove obsolete ignore and README entries**

Remove Expo, Nitro, and TanStack-only ignore blocks. Update the repository structure and required web variables so they describe only `apps/admin`, `apps/nextjs`, Firebase variables, Postgres, and the two scheduler secrets.

- [ ] **Step 5: Run the repository config test**

Run:

```bash
pnpm -F @acme/nextjs test -- src/railway-config.test.ts
```

Expected: the active app boundary, Railway config, and Next.js branding tests pass without reading deleted paths.

### Task 3: Collapse Authentication to the Active Firebase Contract

**Files:**

- Modify: `packages/auth/package.json`
- Modify: `packages/auth/src/index.ts`
- Delete: `packages/auth/env.ts`
- Delete: `packages/auth/env.test.ts`
- Delete: `packages/auth/src/providers.ts`
- Delete: `packages/auth/src/providers.test.ts`
- Delete: `packages/auth/script/auth-cli.ts`
- Delete: `apps/nextjs/src/auth/client.ts`
- Modify: `apps/nextjs/src/env.ts`
- Modify: `apps/nextjs/src/app/api/news/health/handler.ts`
- Modify: `apps/nextjs/src/app/api/news/health/handler.test.ts`
- Modify: `apps/nextjs/src/app/api/news/health/route.ts`
- Modify: `turbo.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Reduce `@acme/auth` to Firebase sessions**

Replace `packages/auth/src/index.ts` with:

```ts
export type { AppSession, SessionReader } from "./session";
```

Remove Better Auth dependencies, its generator script, invalid unused exports, and the env export from `packages/auth/package.json`. Keep `@acme/db`, `firebase-admin`, the Firebase session export, and test tooling.

- [ ] **Step 2: Delete the abandoned Better Auth implementation**

Delete the Better Auth env schema/tests, Discord provider/tests, CLI config, and unused Next.js Better Auth client. Remove the Better Auth and Discord variables from `turbo.json`, `.env.example`, and `README.md`.

- [ ] **Step 3: Make Next.js validate only its active environment**

Remove `authEnv()` from `apps/nextjs/src/env.ts` so the extension is:

```ts
extends: [vercel()],
```

Keep Firebase client variables and the active server variables unchanged.

- [ ] **Step 4: Remove Better Auth from news health**

Remove `authSecret`, `authConfigured`, `checks.auth`, the `configure-auth-secret` next step, and the Better Auth action text from the handler. The readiness predicate becomes:

```ts
checks.freshness &&
  checks.refreshSecret &&
  checks.schema &&
  checks.semantic &&
  checks.sourceCatalog &&
  checks.sources &&
  checks.stories;
```

Update the route to pass only desk status, schema readiness, and `CRON_SECRET`. Update tests so missing configuration reports only the refresh secret and schema problems.

- [ ] **Step 5: Run focused auth and health tests**

Run:

```bash
pnpm -F @acme/auth test
pnpm -F @acme/nextjs test -- src/app/api/news/health/handler.test.ts
```

Expected: Firebase session tests and news health tests pass without Better Auth configuration.

### Task 4: Remove the Premature Lingui Integration

**Files:**

- Modify: `AGENTS.md`
- Modify: `apps/nextjs/package.json`
- Delete: `apps/nextjs/.babelrc.json`
- Delete: `apps/nextjs/lingui.config.ts`
- Delete: `apps/nextjs/src/providers/lingui-client-provider.tsx`
- Modify: `apps/nextjs/src/providers/app-providers.tsx`
- Modify: `apps/nextjs/src/app/_components/LoginModal.tsx`
- Modify: `apps/nextjs/src/app/_components/auth-menu.tsx`
- Modify: `apps/nextjs/src/app/auth/callback/email-callback.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

- [ ] **Step 1: Record the active English-only rule**

Remove Lingui-specific extraction and macro rules from `AGENTS.md`. Replace the i18n requirement with:

```md
- The product is currently English-only. Do not add an i18n runtime, catalogs,
  locale routing, or translation macros unless the user explicitly requests
  internationalization.
```

- [ ] **Step 2: Remove the provider and build configuration**

Delete the Lingui provider, config, and Babel file. Render the active providers directly:

```tsx
<TRPCReactProvider>
  <AuthProvider>
    <NiceModal.Provider>{children}</NiceModal.Provider>
  </AuthProvider>
</TRPCReactProvider>
```

Remove all five Lingui dependencies from the Next.js package.

- [ ] **Step 3: Convert the three auth surfaces to plain English strings**

Remove `Trans` and `useLingui`. Use string literals for toast text, labels, placeholders, headings, and button content, for example:

```tsx
toast.error("Google sign-in failed", {
  description: "Please try again.",
});
```

Do not alter layout, styling, responsive behavior, dark mode, auth behavior, or shared UI components.

- [ ] **Step 4: Update source regression coverage**

Replace the Lingui source test with assertions that the three files contain no `@lingui`, `<Trans>`, or `useLingui`, while retaining the expected English auth labels.

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: the English-only auth surface and existing homepage source contracts pass.

### Task 5: Remove Unconsumed API and Database Contracts

**Files:**

- Delete: `packages/api/src/router/auth.ts`
- Modify: `packages/api/src/root.ts`
- Modify: `packages/api/src/root.test.ts`
- Modify: `packages/api/src/router/news.ts`
- Modify: `packages/api/src/router/news.test.ts`
- Modify: `packages/db/src/auth-schema.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Remove routers with no active client**

Remove `authRouter` and expose only:

```ts
export const appRouter = createTRPCRouter({
  news: newsRouter,
});
```

Delete `news.byId`, whose only client was Expo. Update the root router and cluster-key flow tests to expect only active procedures.

- [ ] **Step 2: Remove Better Auth-only schema fields**

Keep the active `user` and `account` Firebase mapping tables. Remove the `session` and `verification` tables. Reduce `account` to fields used by `createDrizzleFirebaseUserStore`:

```ts
id;
accountId;
providerId;
userId;
createdAt;
updatedAt;
```

Do not run Drizzle push, database update, migration generation, or migration scripts.

- [ ] **Step 3: Remove the now-unconsumed news signal schema**

After deleting `news.byId`, remove:

```text
newsSignalTypeValues
NewsSignalType
NewsSignal
CreateNewsSignalSchema
```

Remove the unused `relations` import and all relation declarations because the repository never calls Drizzle relational query APIs. Remove `CreateIngestionRunSchema`, which has no consumer while the active `IngestionRun` table remains.

- [ ] **Step 4: Add schema absence coverage**

In `packages/db/src/schema.test.ts`, read `auth-schema.ts` and `schema.ts` and assert that active identity/news tables remain while `session`, `verification`, and `NewsSignal` declarations are absent.

- [ ] **Step 5: Run focused API and DB tests**

Run:

```bash
pnpm -F @acme/db test
pnpm -F @acme/api test
```

Expected: schema contracts and the remaining news router pass without deleted procedures or tables.

### Task 6: Regenerate Dependencies and Verify the Whole Repository

**Files:**

- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Regenerate the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: the lockfile no longer contains workspace importers for Expo/TanStack or direct Lingui/Better Auth dependencies.

- [ ] **Step 2: Audit for stale references**

Run:

```bash
rg -n "apps/expo|tanstack-start|@acme/expo|@acme/tanstack-start|@lingui|better-auth|@better-auth|BETTER_AUTH_SECRET|AUTH_DISCORD|AUTH_SECRET" \
  AGENTS.md README.md .env.example package.json pnpm-workspace.yaml turbo.json apps packages tooling .github
```

Expected: no live code/config references. Historical design documents under `docs/` are allowed to describe past states.

- [ ] **Step 3: Verify workspace consistency**

Run:

```bash
pnpm lint:ws
pnpm format
pnpm lint
pnpm typecheck
pnpm -r --if-present test
pnpm run build
git diff --check
```

Expected: every command passes. The root build covers all remaining active workspaces without an exclusion filter.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- package.json pnpm-workspace.yaml turbo.json packages/db/src/schema.ts packages/db/src/auth-schema.ts
```

Expected: only files within this plan are modified or deleted, no migration files exist, and no generated build/cache artifacts are tracked.
