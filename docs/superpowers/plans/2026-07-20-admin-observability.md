# Admin Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a separately deployable, Firebase-protected admin dashboard for monitoring The New AI Times' ingestion, jobs, content, sources, users, and overall operational health.

**Architecture:** `apps/admin` mirrors VibeCom admin's Google Firebase ID-token exchange and 14-day HTTP-only session-cookie flow, while `packages/admin-api` enforces a normalized `ADMIN_EMAILS` allowlist on every tRPC procedure. Six read-only pages query the existing PostgreSQL schema; missing dashboard primitives are added to `packages/ui`, and no database schema or Lingui work is required.

**Tech Stack:** Next.js 16, React 19, Firebase Auth/Admin, tRPC 11, TanStack Query, Drizzle ORM, PostgreSQL, Zod 4, Tailwind 4, Radix UI, Vitest, Railway.

---

## Constraints And Existing Work

- Preserve the current uncommitted Firebase login changes in `packages/auth`,
  `packages/api`, `apps/nextjs`, and `pnpm-lock.yaml`. Reuse their concepts but
  do not reset or overwrite them.
- Do not edit `packages/db/src/auth-schema.ts`, add a role column, generate a
  migration, or run a database update/push/predeploy command.
- Admin uses concise English UI copy. Do not add Lingui, catalogs, locale
  routing, or extraction commands.
- All shared controls come from `packages/ui`; do not add application-local
  Button, Input, Table, Select, Sheet, Card, Badge, or Skeleton primitives.
- Do not commit or push until the user explicitly authorizes it in a later
  turn. The commit commands below identify intended boundaries but remain gated.

## File Structure

### Admin API package

- `packages/admin-api/package.json`: workspace metadata, exports, and scripts.
- `packages/admin-api/tsconfig.json`: compiled-package TypeScript config.
- `packages/admin-api/eslint.config.ts`: base package lint config.
- `packages/admin-api/src/index.ts`: public router/context/type exports.
- `packages/admin-api/src/root.ts`: six-router composition.
- `packages/admin-api/src/trpc.ts`: context, error sanitization, and
  `adminProcedure`.
- `packages/admin-api/src/admin-auth.ts`: `ADMIN_EMAILS` parser and identity
  contracts.
- `packages/admin-api/src/admin-auth.test.ts`: authorization contract tests.
- `packages/admin-api/src/overview.ts`: overview query plus health derivation.
- `packages/admin-api/src/overview.test.ts`: health threshold tests.
- `packages/admin-api/src/ingestion.ts`: ingestion list/detail query and safe
  metadata parsing.
- `packages/admin-api/src/ingestion.test.ts`: metadata and input tests.
- `packages/admin-api/src/jobs.ts`: background-job list/detail query and timing
  derivation.
- `packages/admin-api/src/jobs.test.ts`: job state/timing tests.
- `packages/admin-api/src/content.ts`: news item filtering and detail query.
- `packages/admin-api/src/content.test.ts`: bounded input tests.
- `packages/admin-api/src/sources.ts`: source aggregates and derived source
  status.
- `packages/admin-api/src/sources.test.ts`: source status tests.
- `packages/admin-api/src/users.ts`: user/Firebase-link/reader aggregates.
- `packages/admin-api/src/users.test.ts`: user input/shape tests.

### Shared UI

- `packages/ui/src/badge.tsx`: semantic badge variants.
- `packages/ui/src/card.tsx`: card structure.
- `packages/ui/src/select.tsx`: Radix Select.
- `packages/ui/src/skeleton.tsx`: loading placeholder.
- `packages/ui/src/table.tsx`: accessible table primitives.
- `packages/ui/src/sheet.tsx`: mobile navigation sheet.
- `packages/ui/package.json`: explicit component exports.

### Admin application

- `apps/admin/package.json`: Next.js/Firebase/tRPC dependencies and scripts.
- `apps/admin/tsconfig.json`, `eslint.config.ts`, `postcss.config.js`,
  `vitest.config.ts`, `next.config.js`: application tooling.
- `apps/admin/src/env.ts`: Firebase, admin allowlist, PostgreSQL, and Railway
  environment validation.
- `apps/admin/src/app/styles.css`: Tailwind sources and theme setup.
- `apps/admin/src/auth/firebase-client.ts`: named Firebase browser app/Auth.
- `apps/admin/src/auth/firebase-admin.ts`: server Firebase Admin initialization
  from a Railway secret and cookie verification.
- `apps/admin/src/auth/admin-session.ts`: request cookie to verified admin
  identity.
- `apps/admin/src/auth/session-handler.ts`: testable ID-token exchange/logout
  handler.
- `apps/admin/src/auth/session-handler.test.ts`: login authorization/cookie
  tests.
- `apps/admin/src/app/api/auth/session/route.ts`: real Firebase session route.
- `apps/admin/src/app/api/trpc/[trpc]/route.ts`: admin tRPC adapter.
- `apps/admin/src/proxy.ts`: anonymous page redirect based on cookie presence.
- `apps/admin/src/providers/auth-provider.tsx`: Firebase client identity/logout.
- `apps/admin/src/providers/providers.tsx`: theme, auth, tRPC, and toast
  composition.
- `apps/admin/src/trpc/query-client.ts`, `react.tsx`: TanStack/tRPC client.
- `apps/admin/src/app/layout.tsx`: root metadata and providers.
- `apps/admin/src/app/login/page.tsx`,
  `login/login-client.tsx`: VibeCom-style Google login.
- `apps/admin/src/app/(dashboard)/layout.tsx`: protected admin shell.
- `apps/admin/src/app/_components/admin-shell.tsx`: responsive shell.
- `apps/admin/src/app/_components/sidebar.tsx`: desktop navigation.
- `apps/admin/src/app/_components/mobile-navigation.tsx`: sheet navigation.
- `apps/admin/src/app/_components/page-state.tsx`: common loading/error/empty
  states.
- `apps/admin/src/app/_components/status-badge.tsx`: operational state badge.
- `apps/admin/src/app/_components/pagination.tsx`: bounded offset pagination.
- `apps/admin/src/app/_components/admin-shell.test.tsx`: shell/state markup
  tests.
- `apps/admin/src/app/(dashboard)/page.tsx`: Overview.
- `apps/admin/src/app/(dashboard)/ingestion/page.tsx`: Ingestion.
- `apps/admin/src/app/(dashboard)/jobs/page.tsx`: Jobs.
- `apps/admin/src/app/(dashboard)/content/page.tsx`: Content.
- `apps/admin/src/app/(dashboard)/sources/page.tsx`: Sources.
- `apps/admin/src/app/(dashboard)/users/page.tsx`: Users.
- One `*.test.tsx` beside each page for loading, empty, error, and representative
  data rendering.
- `apps/admin/scripts/sync-standalone-assets.mjs`: standalone static/public
  synchronization.
- `apps/admin/railway.json`: independent Railway service config.
- `apps/admin/src/railway-config.test.ts`: config and root-script contract.

### Root configuration

- `package.json`: `build:admin`, `deploy:admin`, `start:admin`, and standalone
  sync scripts.
- `turbo.json`: admin/Firebase environment allowlist.
- `pnpm-lock.yaml`: dependency graph update, preserving existing Firebase work.

## Task 1: Scaffold The Admin API And Enforce Authorization

**Files:**

- Create: `packages/admin-api/package.json`
- Create: `packages/admin-api/tsconfig.json`
- Create: `packages/admin-api/eslint.config.ts`
- Create: `packages/admin-api/src/admin-auth.ts`
- Create: `packages/admin-api/src/admin-auth.test.ts`
- Create: `packages/admin-api/src/trpc.ts`
- Create: `packages/admin-api/src/root.ts`
- Create: `packages/admin-api/src/index.ts`

- [ ] **Step 1: Write the failing authorization tests**

Create tests for normalized parsing, missing sessions, denied email, and allowed
email. The caller contract is:

```ts
const session = {
  email: "admin@example.com",
  image: null,
  name: "Admin",
  uid: "firebase-admin",
};

expect(parseAdminEmails(" Admin@Example.com,ops@example.com ")).toEqual(
  new Set(["admin@example.com", "ops@example.com"]),
);
expect(() => parseAdminEmails(" , ")).toThrow("ADMIN_EMAILS");
```

Use a test router whose protected procedure returns
`ctx.admin.email`. Anonymous calls must reject with `UNAUTHORIZED`, a
non-allowlisted session with `FORBIDDEN`, and the sample session must resolve to
`admin@example.com`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/admin-api test -- src/admin-auth.test.ts
```

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Add package metadata and the auth contract**

Define:

```ts
export interface AdminIdentity {
  email: string;
  image: string | null;
  name: string;
  uid: string;
}

export type AdminSessionReader = (
  headers: Headers,
) => Promise<AdminIdentity | null>;

export const parseAdminEmails = (value: string) => {
  const emails = new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (emails.size === 0) throw new Error("ADMIN_EMAILS must not be empty");
  return emails;
};
```

`createTRPCContext` accepts `{ headers, getSession, adminEmails }`, lazily loads
`@acme/db/client`, and returns `{ session, adminEmails, db }`.
`adminProcedure` verifies the session and allowlist and narrows
`ctx.admin` to `AdminIdentity`. Use a generic production error message and omit
non-tRPC stack traces.

- [ ] **Step 4: Compose an initially empty router and public exports**

`root.ts` initially creates `appRouter` with no data routers. `index.ts` exports
`AppRouter`, `appRouter`, `createTRPCContext`, `AdminIdentity`,
`AdminSessionReader`, and the allowlist helpers. No `publicProcedure` is
exported.

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm -F @acme/admin-api test
pnpm -F @acme/admin-api typecheck
```

Expected: PASS.

- [ ] **Step 6: Gated commit boundary**

After explicit commit permission:

```bash
git add packages/admin-api/package.json packages/admin-api/tsconfig.json packages/admin-api/eslint.config.ts packages/admin-api/src/admin-auth.ts packages/admin-api/src/admin-auth.test.ts packages/admin-api/src/trpc.ts packages/admin-api/src/root.ts packages/admin-api/src/index.ts
git commit -m "feat(admin): add protected api foundation"
```

## Task 2: Mirror VibeCom's Firebase Admin Login

**Files:**

- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/eslint.config.ts`
- Create: `apps/admin/postcss.config.js`
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/next.config.js`
- Create: `apps/admin/src/env.ts`
- Create: `apps/admin/src/auth/firebase-client.ts`
- Create: `apps/admin/src/auth/firebase-admin.ts`
- Create: `apps/admin/src/auth/admin-session.ts`
- Create: `apps/admin/src/auth/session-handler.ts`
- Create: `apps/admin/src/auth/session-handler.test.ts`
- Create: `apps/admin/src/app/api/auth/session/route.ts`
- Create: `apps/admin/src/app/api/trpc/[trpc]/route.ts`
- Create: `apps/admin/src/proxy.ts`
- Create: `apps/admin/src/providers/auth-provider.tsx`
- Create: `apps/admin/src/trpc/query-client.ts`
- Create: `apps/admin/src/trpc/react.tsx`
- Create: `apps/admin/src/app/login/page.tsx`
- Create: `apps/admin/src/app/login/login-client.tsx`

- [ ] **Step 1: Write failing session-handler tests**

Test an injected handler with these dependencies:

```ts
interface AdminSessionDependencies {
  createSessionCookie: (idToken: string, expiresIn: number) => Promise<string>;
  verifyIdToken: (idToken: string) => Promise<{
    email?: string;
    email_verified?: boolean;
    uid: string;
  }>;
}
```

Cover missing token (`400`), unverified email (`403`), non-allowlisted email
(`403`), successful exchange (`200` plus the cookie value), provider failure
(`500` with a generic error), and logout (`200` plus an expired cookie).

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm -F @acme/admin test -- src/auth/session-handler.test.ts
```

Expected: FAIL because `@acme/admin` and the handler do not exist.

- [ ] **Step 3: Implement the pure handler**

Use:

```ts
export const ADMIN_SESSION_COOKIE = "session";
export const ADMIN_SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1_000;
```

The handler verifies `email_verified === true`, normalizes the email, checks
`ADMIN_EMAILS`, and asks Firebase Admin to create the session cookie. The route
sets it with `httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`,
and `maxAge` in seconds. DELETE expires the same cookie and returns success.

- [ ] **Step 4: Implement Firebase client and server singletons**

The browser uses a named Firebase app with validated `NEXT_PUBLIC_FIREBASE_*`
configuration and exports its Auth instance.

The server parser validates `FIREBASE_SERVICE_ACCOUNT_JSON` with Zod:

```ts
const FirebaseServiceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  project_id: z.string().min(1),
});
```

Initialize one named Firebase Admin app with `cert`, normalize escaped private
key newlines, and export `verifyIdToken`, `createSessionCookie`, and
`verifySessionCookie`. Never log the parsed object.

- [ ] **Step 5: Implement the verified cookie reader**

`readAdminSession(headers)` parses only the exact `session` cookie, verifies it
through Firebase Admin, requires a verified non-empty email, and returns the
`AdminIdentity`. Invalid, expired, or revoked cookies return `null`.

The tRPC route calls:

```ts
createTRPCContext({
  adminEmails: env.ADMIN_EMAILS,
  getSession: readAdminSession,
  headers: request.headers,
});
```

- [ ] **Step 6: Implement the VibeCom-style login page and auth provider**

`LoginClient` uses `GoogleAuthProvider` and `signInWithPopup`, sends the ID token
to `/api/auth/session`, maps popup cancellation/blocking and forbidden access to
short English messages, and redirects to `/` after success. Use
`@acme/ui/button`, not a local `<button>` implementation.

`AuthProvider` subscribes with `onAuthStateChanged`. Logout first deletes the
server cookie, then calls Firebase `signOut`, clears admin React Query data, and
routes to `/login`.

- [ ] **Step 7: Add the proxy usability guard**

Use Next.js 16 `proxy.ts`, not VibeCom's legacy `middleware.ts`. Allow `/login`,
`/api`, `/_next`, and static files. Redirect page requests without
`ADMIN_SESSION_COOKIE` to `/login`; API authorization remains authoritative.

- [ ] **Step 8: Install once and run auth verification**

```bash
pnpm install
pnpm -F @acme/admin test -- src/auth/session-handler.test.ts
pnpm -F @acme/admin typecheck
```

Expected: PASS. Review the lockfile diff and preserve unrelated Firebase
dependency changes.

- [ ] **Step 9: Gated commit boundary**

After explicit permission, stage only the files listed in this task plus the
related importer entries in `pnpm-lock.yaml`.

## Task 3: Add Shared Dashboard UI And The Responsive Shell

**Files:**

- Create: `packages/ui/src/badge.tsx`
- Create: `packages/ui/src/card.tsx`
- Create: `packages/ui/src/select.tsx`
- Create: `packages/ui/src/skeleton.tsx`
- Create: `packages/ui/src/table.tsx`
- Create: `packages/ui/src/sheet.tsx`
- Modify: `packages/ui/package.json`
- Create: `apps/admin/src/app/styles.css`
- Create: `apps/admin/src/providers/providers.tsx`
- Create: `apps/admin/src/app/layout.tsx`
- Create: `apps/admin/src/app/(dashboard)/layout.tsx`
- Create: `apps/admin/src/app/_components/admin-shell.tsx`
- Create: `apps/admin/src/app/_components/sidebar.tsx`
- Create: `apps/admin/src/app/_components/mobile-navigation.tsx`
- Create: `apps/admin/src/app/_components/page-state.tsx`
- Create: `apps/admin/src/app/_components/status-badge.tsx`
- Create: `apps/admin/src/app/_components/pagination.tsx`
- Create: `apps/admin/src/app/_components/admin-shell.test.tsx`

- [ ] **Step 1: Write the failing shared-shell tests**

Render presentational exports with `react-dom/server`. Assert:

```ts
expect(renderedShell).toContain("Overview");
expect(renderedShell).toContain("Ingestion");
expect(renderedShell).toContain("Jobs");
expect(renderedShell).toContain("Content");
expect(renderedShell).toContain("Sources");
expect(renderedShell).toContain("Users");
expect(renderedEmpty).toContain("No data");
expect(renderedError).toContain("Try again");
```

Also read the source and require a desktop sidebar breakpoint, a mobile Sheet
trigger, `ThemeToggle`, and no `@lingui` import.

- [ ] **Step 2: Run the shell test and verify RED**

```bash
pnpm -F @acme/admin test -- src/app/_components/admin-shell.test.tsx
```

Expected: FAIL because the shell and shared primitives are absent.

- [ ] **Step 3: Add only the required `packages/ui` primitives**

Port the current shadcn/Radix implementations matching existing `data-slot`,
`cn`, focus-ring, and theme-token conventions. Add explicit exports:

```json
{
  "./badge": "./src/badge.tsx",
  "./card": "./src/card.tsx",
  "./select": "./src/select.tsx",
  "./sheet": "./src/sheet.tsx",
  "./skeleton": "./src/skeleton.tsx",
  "./table": "./src/table.tsx"
}
```

Do not add Dialog or NiceModal because the admin login is a page.

- [ ] **Step 4: Implement providers and shell**

Provider order is `ThemeProvider` → `TRPCReactProvider` → `AuthProvider` →
`Toaster`. The root layout uses `<html lang="en">`, VibeCom-like admin metadata,
and the existing Geist variable font packages.

The dashboard layout renders `AdminShell`; desktop navigation collapses, mobile
navigation uses Sheet, and the top bar contains page context, `ThemeToggle`, and
the signed-in identity/logout action.

- [ ] **Step 5: Implement common states and pagination**

`PageState` has explicit loading, error, and empty variants. `Pagination`
accepts `{ page, pageSize, total, onPageChange }`, disables invalid directions,
and announces the visible row interval. `StatusBadge` maps semantic states to
Badge variants with visible text.

- [ ] **Step 6: Run shared UI verification**

```bash
pnpm -F @acme/ui typecheck
pnpm -F @acme/admin test -- src/app/_components/admin-shell.test.tsx
pnpm -F @acme/admin typecheck
```

Expected: PASS.

- [ ] **Step 7: Gated commit boundary**

After permission, commit shared UI and shell files as
`feat(admin): add responsive dashboard shell`.

## Task 4: Build The Overview Data Contract And Page

**Files:**

- Create: `packages/admin-api/src/overview.ts`
- Create: `packages/admin-api/src/overview.test.ts`
- Modify: `packages/admin-api/src/root.ts`
- Create: `apps/admin/src/app/(dashboard)/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/overview-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/overview-view.test.tsx`

- [ ] **Step 1: Write failing health derivation tests**

Define an `OverviewSnapshot` containing latest publication, published/embedded
counts, latest ingestion state, and job counts. Test:

```ts
expect(buildOverviewHealth(freshHealthySnapshot).state).toBe("healthy");
expect(buildOverviewHealth(staleSnapshot).findings).toContainEqual(
  expect.objectContaining({ code: "stale-content", severity: "critical" }),
);
expect(buildOverviewHealth(failedJobsSnapshot).findings).toContainEqual(
  expect.objectContaining({ code: "terminal-jobs" }),
);
expect(buildOverviewHealth(expiredLeaseSnapshot).findings).toContainEqual(
  expect.objectContaining({ code: "expired-job-lease" }),
);
```

Freeze `now` in every test. Use the current 72-hour news freshness threshold,
the two-hour schedule window for overdue due jobs, and the persisted job lease
for running-job health.

- [ ] **Step 2: Run the model test and verify RED**

```bash
pnpm -F @acme/admin-api test -- src/overview.test.ts
```

Expected: FAIL because the overview module does not exist.

- [ ] **Step 3: Implement one aggregate query procedure**

`overview.get` performs bounded aggregate queries for:

- source totals;
- 24-hour collected/published totals and latest published time;
- published embedding totals;
- latest aggregate ingestion run and safe source-health metadata;
- job counts, oldest due queue time, and expired running leases;
- seven UTC daily buckets for collected items and ingestion outcomes.

Return numeric values with explicit PostgreSQL casts and convert timestamps to
ISO strings at the boundary. Derive findings in a pure function, sorted
`critical` before `warning`.

- [ ] **Step 4: Write and implement the Overview view**

The view renders overall state, six compact cards, seven-day CSS bars, latest
ingestion summary, job summary, and an ordered findings panel. Test loading,
empty bootstrap state, one critical finding, and representative healthy data.
Use no charting package.

- [ ] **Step 5: Run focused verification**

```bash
pnpm -F @acme/admin-api test -- src/overview.test.ts
pnpm -F @acme/admin test -- src/app/\\(dashboard\\)/overview-view.test.tsx
pnpm -F @acme/admin-api typecheck
pnpm -F @acme/admin typecheck
```

Expected: PASS.

- [ ] **Step 6: Gated commit boundary**

After permission, commit as `feat(admin): add system overview`.

## Task 5: Add Ingestion And Job Monitoring

**Files:**

- Create: `packages/admin-api/src/ingestion.ts`
- Create: `packages/admin-api/src/ingestion.test.ts`
- Create: `packages/admin-api/src/jobs.ts`
- Create: `packages/admin-api/src/jobs.test.ts`
- Modify: `packages/admin-api/src/root.ts`
- Create: `apps/admin/src/app/(dashboard)/ingestion/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/ingestion/ingestion-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/ingestion/ingestion-view.test.tsx`
- Create: `apps/admin/src/app/(dashboard)/jobs/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/jobs/jobs-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/jobs/jobs-view.test.tsx`

- [ ] **Step 1: Write failing ingestion parser/input tests**

Use a strict object schema with `page`, `pageSize <= 50`, optional
`status`, `runType`, `sourceId`, and time range. Test malformed
`metadata.sourceHealth` returns `null`; valid metadata returns only string arrays
and bounded string records.

- [ ] **Step 2: Write failing job timing/input tests**

Use a strict object schema with `page`, `pageSize <= 50`, optional `jobType`,
`status`, and time range. Test queue wait, execution duration, retrying state,
overdue due queue, expired lease, and null timestamps.

- [ ] **Step 3: Run both tests and verify RED**

```bash
pnpm -F @acme/admin-api test -- src/ingestion.test.ts src/jobs.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement server-filtered list/detail procedures**

Use `and(...conditions)`, `count()`, `desc(startedAt/createdAt)`, `limit`, and
`offset`. Ingestion joins `NewsSource` for name/slug. Jobs select bounded
payload/result only for `byId`; list rows omit them. Clamp all error strings to
4,000 characters at the API boundary.

- [ ] **Step 5: Implement both pages**

Filters use shared Input and Select and reset page to zero. Tables render status,
time, duration, counts/attempts, and error summaries. Row detail expands safe
source diagnostics or job payload/result. There are no retry, cancel, unlock,
delete, or refresh mutations.

- [ ] **Step 6: Run focused verification**

```bash
pnpm -F @acme/admin-api test -- src/ingestion.test.ts src/jobs.test.ts
pnpm -F @acme/admin test -- src/app/\\(dashboard\\)/ingestion/ingestion-view.test.tsx src/app/\\(dashboard\\)/jobs/jobs-view.test.tsx
pnpm -F @acme/admin-api typecheck
pnpm -F @acme/admin typecheck
```

Expected: PASS.

- [ ] **Step 7: Gated commit boundary**

After permission, commit as `feat(admin): monitor ingestion and jobs`.

## Task 6: Add Content And Source Monitoring

**Files:**

- Create: `packages/admin-api/src/content.ts`
- Create: `packages/admin-api/src/content.test.ts`
- Create: `packages/admin-api/src/sources.ts`
- Create: `packages/admin-api/src/sources.test.ts`
- Modify: `packages/admin-api/src/root.ts`
- Create: `apps/admin/src/app/(dashboard)/content/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/content/content-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/content/content-view.test.tsx`
- Create: `apps/admin/src/app/(dashboard)/sources/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/sources/sources-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/sources/sources-view.test.tsx`

- [ ] **Step 1: Write failing content and source model tests**

Content input accepts only existing `newsStatusValues`,
`newsCategoryValues`, `newsEmbeddingStatusValues`, a UUID source, and a trimmed
search string of at most 160 characters. Source status tests cover inactive,
missing-feed RSS, recent failure, no content, stale content, and healthy.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm -F @acme/admin-api test -- src/content.test.ts src/sources.test.ts
```

Expected: FAIL because the modules are absent.

- [ ] **Step 3: Implement content queries**

`content.list` joins sources, selects operational list fields, applies typed
filters and case-insensitive title/canonical URL search, and paginates.
`content.byId` returns summary, original URL, tags, entities, cluster/dedupe
keys, language, and author, but not vectors.

- [ ] **Step 4: Implement source aggregates**

For each source, return story count, latest collected timestamp, and latest
source-specific ingestion state using a grouped aggregate plus a latest-run
subquery. Derive status in TypeScript with a frozen `now`; do not mutate source
configuration.

- [ ] **Step 5: Implement both pages and tests**

Content renders filters, operational columns, external canonical links with
`target="_blank"` and `rel="nofollow noopener noreferrer"`, and a read-only
detail region. Sources render state, type, credibility, feed/homepage
availability, story count, and last activity. Verify loading, empty, error, and
representative rows.

- [ ] **Step 6: Run focused verification**

```bash
pnpm -F @acme/admin-api test -- src/content.test.ts src/sources.test.ts
pnpm -F @acme/admin test -- src/app/\\(dashboard\\)/content/content-view.test.tsx src/app/\\(dashboard\\)/sources/sources-view.test.tsx
pnpm -F @acme/admin-api typecheck
pnpm -F @acme/admin typecheck
```

Expected: PASS.

- [ ] **Step 7: Gated commit boundary**

After permission, commit as `feat(admin): monitor content and sources`.

## Task 7: Add User And Reader Monitoring

**Files:**

- Create: `packages/admin-api/src/users.ts`
- Create: `packages/admin-api/src/users.test.ts`
- Modify: `packages/admin-api/src/root.ts`
- Create: `apps/admin/src/app/(dashboard)/users/page.tsx`
- Create: `apps/admin/src/app/(dashboard)/users/users-view.tsx`
- Create: `apps/admin/src/app/(dashboard)/users/users-view.test.tsx`

- [ ] **Step 1: Write failing user-input tests**

The strict input contains `page`, `pageSize <= 50`, and optional trimmed search
of at most 160 characters. Test the returned view model contract:

```ts
{
  createdAt: string,
  email: string,
  emailVerified: boolean,
  firebaseLinked: boolean,
  id: string,
  image: string | null,
  interactionCount: number,
  latestInteractionAt: string | null,
  name: string,
  readerProfile: boolean
}
```

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm -F @acme/admin-api test -- src/users.test.ts
```

Expected: FAIL because `users.ts` does not exist.

- [ ] **Step 3: Implement the aggregate**

Query the generated `user` table, left join a Firebase `account` alias,
`NewsReaderProfile`, and aggregated `NewsReaderInteraction`. Search normalized
email/name, group safely, paginate, and never return access/refresh/ID tokens
from the account table.

- [ ] **Step 4: Implement the Users page**

Render searchable rows with identity, verification, Firebase link, profile,
interaction count, latest interaction, and created time. Do not add status,
plan, billing, role, edit, suspend, or delete controls.

- [ ] **Step 5: Run focused verification**

```bash
pnpm -F @acme/admin-api test -- src/users.test.ts
pnpm -F @acme/admin test -- src/app/\\(dashboard\\)/users/users-view.test.tsx
pnpm -F @acme/admin-api typecheck
pnpm -F @acme/admin typecheck
```

Expected: PASS.

- [ ] **Step 6: Gated commit boundary**

After permission, commit as `feat(admin): monitor users and readers`.

## Task 8: Add Direct Admin Build And Railway Configuration

**Files:**

- Create: `apps/admin/scripts/sync-standalone-assets.mjs`
- Create: `apps/admin/railway.json`
- Create: `apps/admin/src/railway-config.test.ts`
- Modify: `package.json`
- Modify: `turbo.json`

- [ ] **Step 1: Write the failing config test**

Assert:

```ts
expect(railway.build.buildCommand).toBe("pnpm run deploy:admin");
expect(railway.deploy.startCommand).toBe("pnpm run start:admin");
expect(railway.deploy).not.toHaveProperty("preDeployCommand");
expect(railway.deploy.restartPolicyType).toBe("ON_FAILURE");
```

Also require a watch pattern covering `apps/admin/**`,
`packages/admin-api/**`, `packages/auth/**`, `packages/db/**`,
`packages/ui/**`, and root workspace manifests; require direct root scripts
without `RAILWAY_SERVICE_NAME`.

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm -F @acme/admin test -- src/railway-config.test.ts
```

Expected: FAIL because Railway config and scripts are absent.

- [ ] **Step 3: Add standalone and root scripts**

Add:

```json
{
  "build:admin": "turbo run build -F @acme/admin... && pnpm run sync:admin-standalone",
  "deploy:admin": "pnpm run build:admin",
  "start:admin": "HOSTNAME=0.0.0.0 pnpm exec dotenv -e .env -- node apps/admin/.next/standalone/apps/admin/server.js",
  "sync:admin-standalone": "node apps/admin/scripts/sync-standalone-assets.mjs"
}
```

The sync script mirrors the existing Next.js script for the admin standalone
path and tolerates an absent `public` directory only if the app intentionally
has none.

- [ ] **Step 4: Add Railway config-as-code**

Use Railpack, direct build/start commands, no predeploy, restart on failure, and
the focused watch patterns from the test. Add all Firebase/admin variable names
to Turbo's environment allowlist without values.

- [ ] **Step 5: Run configuration and build verification**

```bash
pnpm -F @acme/admin test -- src/railway-config.test.ts
pnpm run build:admin
```

Expected: PASS without a database schema command.

- [ ] **Step 6: Gated commit boundary**

After permission, commit as `build(admin): add Railway deployment`.

## Task 9: Full Verification And Production Handoff

**Files:**

- Modify only files proven necessary by failing verification.

- [ ] **Step 1: Run formatting checks without bulk rewriting unrelated files**

```bash
pnpm -F @acme/admin-api format
pnpm -F @acme/admin format
pnpm -F @acme/ui format
git diff --check
```

Expected: PASS. If formatting is needed, format only exact admin-touched files.

- [ ] **Step 2: Run focused and package tests**

```bash
pnpm -F @acme/admin-api test
pnpm -F @acme/admin test
pnpm -F @acme/ui typecheck
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and lint**

```bash
pnpm -F @acme/admin-api typecheck
pnpm -F @acme/admin typecheck
pnpm -F @acme/admin-api lint
pnpm -F @acme/admin lint
pnpm -F @acme/ui lint
```

Expected: PASS with no `any`.

- [ ] **Step 4: Run the production build**

```bash
pnpm run build:admin
```

Expected: PASS and produce
`apps/admin/.next/standalone/apps/admin/server.js`.

- [ ] **Step 5: Browser-verify the local application**

Start admin on port 4000 with non-production credentials and verify:

- anonymous `/` redirects to `/login`;
- Google provider initiation and access-denied handling;
- allowed login creates the HTTP-only cookie and survives reload;
- desktop collapsed sidebar and mobile Sheet navigation;
- light/dark theme;
- all six pages;
- loading, empty, filtered-empty, request-error, and representative data states;
- logout removes the session and returns to `/login`.

Capture screenshots at desktop and mobile widths. Do not log or display Firebase
tokens or the service account.

- [ ] **Step 6: Audit exclusions and security**

```bash
rg -n "growth|billing|subscription|payment|seo|playground|studio|@lingui|ADMIN_EMAILS|FIREBASE_SERVICE_ACCOUNT_JSON" apps/admin packages/admin-api
```

Expected: no excluded VibeCom page/module and no client-side secret reference.
`ADMIN_EMAILS` and service-account JSON may occur only in validated server
configuration/auth code and tests.

- [ ] **Step 7: Request commit and push permission**

Show exact `git status --short`, the verification results, and the intended
focused commit grouping. Do not stage, commit, or push until the user explicitly
authorizes it.

- [ ] **Step 8: Deploy after authorization**

After commit/push authorization, create or configure the independent Railway
admin service with `/apps/admin/railway.json`, set:

```text
POSTGRES_URL
ADMIN_EMAILS
FIREBASE_SERVICE_ACCOUNT_JSON
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Generate a Railway domain, add it to Firebase Authentication authorized domains,
deploy the saved commit, inspect deployment status/logs, and verify the
production login plus all six production data pages.

- [ ] **Step 9: Completion audit**

Compare the current source, command output, browser screenshots, Railway state,
and production behavior against every acceptance criterion in
`docs/superpowers/specs/2026-07-20-admin-observability-design.md`. Missing or
indirect evidence is incomplete; continue until every criterion is directly
verified.
