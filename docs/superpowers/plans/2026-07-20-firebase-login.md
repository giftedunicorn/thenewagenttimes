# Firebase Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google and email magic-link login to the Next.js application with Firebase-backed, server-verified tRPC sessions linked to existing application users.

**Architecture:** The browser uses Firebase Auth and attaches an ID token to tRPC requests. `@acme/auth` verifies the token with Firebase Admin, links the Firebase UID through the existing Better Auth `account` table, and returns the stable application user ID. Next.js uses this Firebase session reader while TanStack Start retains Better Auth.

**Tech Stack:** Next.js 16, React 19, Firebase Auth/Admin, tRPC, Drizzle, NiceModal, Lingui, Radix UI, Vitest

**Execution note:** Do not commit, push, run migrations, run database update scripts, or regenerate Lingui catalogs. The repository requires separate commit permission, and the user asked implementation to continue without further questions.

---

## File Structure

- `packages/auth/src/session.ts`: shared application session and reader contract
- `packages/auth/src/firebase-session.ts`: bearer parsing, verified-claim validation, user linking, and Firebase session reader
- `packages/auth/src/firebase-session.test.ts`: focused server-auth unit tests
- `packages/api/src/trpc.ts`: session-reader-based request context
- `apps/nextjs/src/auth/server.ts`: Next.js Firebase session reader
- `apps/nextjs/src/utils/firebase-config.ts`: lazy Firebase browser singleton
- `apps/nextjs/src/auth/firebase-client.ts`: pure header and email helpers
- `apps/nextjs/src/auth/firebase-client.test.ts`: browser-auth helper tests
- `apps/nextjs/src/providers/auth-provider.tsx`: Firebase auth state and actions
- `apps/nextjs/src/providers/lingui-client-provider.tsx`: English Lingui runtime
- `apps/nextjs/src/app/_components/LoginModal.tsx`: NiceModal login UI
- `apps/nextjs/src/app/_components/Modals.tsx`: modal registration
- `apps/nextjs/src/app/_components/auth-menu.tsx`: signed-out and signed-in navigation control
- `apps/nextjs/src/app/auth/callback/page.tsx`: magic-link callback route
- `apps/nextjs/src/app/auth/callback/email-callback.tsx`: callback behavior and UI
- `packages/ui/src/dialog.tsx`: shared Radix dialog primitive

### Task 1: Shared Firebase session contract

**Files:**

- Create: `packages/auth/src/session.ts`
- Create: `packages/auth/src/firebase-session.ts`
- Create: `packages/auth/src/firebase-session.test.ts`
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Write failing tests for token parsing and verified claims**

Add tests proving that missing/malformed bearer headers return `null`, a valid
header returns only the token, and missing or unverified email claims cannot
produce an application session.

```ts
expect(readFirebaseBearerToken(new Headers())).toBeNull();
expect(
  readFirebaseBearerToken(
    new Headers({ authorization: "Bearer verified-token" }),
  ),
).toBe("verified-token");
expect(validateFirebaseClaims({ uid: "reader", exp: 123 })).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/auth test -- src/firebase-session.test.ts
```

Expected: FAIL because `firebase-session.ts` does not exist.

- [ ] **Step 3: Implement the shared session contract**

Define:

```ts
export interface AppSession {
  expiresAt: Date;
  user: {
    email: string;
    emailVerified: boolean;
    id: string;
    image: string | null;
    name: string;
  };
}

export type SessionReader = (headers: Headers) => Promise<AppSession | null>;
```

Implement strict `Bearer` parsing and convert only verified Firebase claims
with non-empty email into normalized internal claims.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command again. Expected: PASS.

- [ ] **Step 5: Write failing user-linking tests**

Use an in-memory `FirebaseUserStore` fake to prove:

- an existing UID mapping is reused
- a new UID links to an existing normalized email
- a new identity creates one user and one Firebase account mapping
- repeated resolution returns the same application user ID

- [ ] **Step 6: Run the test and verify RED**

Expected: FAIL because `resolveFirebaseUser` is missing.

- [ ] **Step 7: Implement linking and the Firebase Admin reader**

Use deterministic account ID `firebase:<uid>`. The Drizzle store queries the
existing `account` and `user` tables, reuses a case-insensitive email match,
creates a user only when absent, and inserts the mapping with conflict
protection. `createFirebaseSessionReader(projectId)` verifies ID tokens through
a named Firebase Admin app and delegates to the linker.

- [ ] **Step 8: Run auth tests and typecheck**

```bash
pnpm -F @acme/auth test
pnpm -F @acme/auth typecheck
```

Expected: PASS.

### Task 2: Inject Firebase sessions into tRPC

**Files:**

- Modify: `packages/api/src/trpc.ts`
- Modify: `apps/nextjs/src/auth/server.ts`
- Modify: `apps/nextjs/src/app/api/trpc/[trpc]/route.ts`
- Modify: `apps/nextjs/src/trpc/server.tsx`
- Modify: `apps/tanstack-start/src/lib/trpc.ts`
- Modify: `apps/tanstack-start/src/routes/api/trpc.$.ts`
- Delete: `apps/nextjs/src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Write a failing API context test**

Add a focused test that injects a `SessionReader`, asserts it receives the
request headers, and asserts its returned application session is available to
`auth.getSession`.

- [ ] **Step 2: Run the focused API test and verify RED**

```bash
pnpm -F @acme/api test -- src/trpc.test.ts
```

Expected: FAIL because `createTRPCContext` still requires Better Auth.

- [ ] **Step 3: Replace the Better Auth-specific context input**

Change the context input to:

```ts
export const createTRPCContext = async (opts: {
  headers: Headers;
  getSession: SessionReader;
}) => ({
  session: await opts.getSession(opts.headers),
  db: await getDbClient(),
});
```

Next.js passes its Firebase reader. TanStack Start wraps
`auth.api.getSession({ headers })` and maps the result to `AppSession`, retaining
its current Better Auth runtime.

- [ ] **Step 4: Run focused tests and typechecks**

```bash
pnpm -F @acme/api test
pnpm -F @acme/api typecheck
pnpm -F @acme/tanstack-start typecheck
```

Expected: PASS.

### Task 3: Firebase browser client and auth provider

**Files:**

- Create: `apps/nextjs/src/utils/firebase-config.ts`
- Create: `apps/nextjs/src/auth/firebase-client.ts`
- Create: `apps/nextjs/src/auth/firebase-client.test.ts`
- Create: `apps/nextjs/src/providers/auth-provider.tsx`
- Modify: `apps/nextjs/src/trpc/react.tsx`
- Modify: `apps/nextjs/src/env.ts`
- Modify: `apps/nextjs/package.json`
- Modify: `apps/nextjs/next.config.js`
- Modify: `.env.example`

- [ ] **Step 1: Write failing client-helper tests**

Test:

```ts
expect(await createFirebaseAuthorizationHeaders(null)).not.toHaveProperty(
  "authorization",
);
expect(await createFirebaseAuthorizationHeaders(tokenUser)).toMatchObject({
  authorization: "Bearer real-token",
});
expect(isValidLoginEmail("reader@example.com")).toBe(true);
expect(isValidLoginEmail("reader@")).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm -F @acme/nextjs test -- src/auth/firebase-client.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the minimal browser helpers and Firebase singleton**

Lazily import `firebase/app` and `firebase/auth`, configure IndexedDB
persistence, omit authorization when no current user exists, and provide the
email validator.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 3 focused command again. Expected: PASS.

- [ ] **Step 5: Implement `AuthProvider`**

Expose `status`, `user`, `signInWithGoogle`, `sendSignInLink`, and `signOut`.
Subscribe with `onAuthStateChanged`, use redirect on iOS, refresh auth-sensitive
queries after state changes, and avoid storing a second serialized user.

- [ ] **Step 6: Attach the token to tRPC**

Build headers from `getFirebaseAuth().currentUser`. Never emit
`Bearer undefined`.

- [ ] **Step 7: Configure dependencies and environment**

Add Firebase, NiceModal, Lingui runtime/SWC dependencies, validated
`NEXT_PUBLIC_FIREBASE_*` variables, example entries, and a Firebase auth rewrite
derived from the configured auth domain.

- [ ] **Step 8: Run Next.js tests and typecheck**

```bash
pnpm install
pnpm -F @acme/nextjs test
pnpm -F @acme/nextjs typecheck
```

Expected: PASS.

### Task 4: Responsive login, callback, and account UI

**Files:**

- Create: `packages/ui/src/dialog.tsx`
- Modify: `packages/ui/package.json`
- Create: `apps/nextjs/lingui.config.ts`
- Create: `apps/nextjs/src/providers/lingui-client-provider.tsx`
- Create: `apps/nextjs/src/app/_components/LoginModal.tsx`
- Create: `apps/nextjs/src/app/_components/Modals.tsx`
- Create: `apps/nextjs/src/app/_components/auth-menu.tsx`
- Create: `apps/nextjs/src/app/auth/callback/email-callback.tsx`
- Create: `apps/nextjs/src/app/auth/callback/page.tsx`
- Modify: `apps/nextjs/src/app/layout.tsx`
- Modify: `apps/nextjs/src/app/_components/news-public-front-page.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home.test.ts`

- [ ] **Step 1: Write failing source-level UI contract tests**

Assert that the home navigation renders `AuthMenu`, the modal uses NiceModal and
shared UI components, all new JSX text uses Lingui macros, and the callback
handles stored and cross-device email entry.

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home.test.ts
```

Expected: FAIL because the auth components are absent.

- [ ] **Step 3: Add the shared Dialog primitive**

Port the existing Radix/shadcn dialog shape into `packages/ui` and export it as
`@acme/ui/dialog`.

- [ ] **Step 4: Add Lingui and provider composition**

Configure English as the source and initial locale. Wrap the application in
`LinguiClientProvider`, `AuthProvider`, and `NiceModal.Provider`; register the
login modal once in `Modals.tsx`.

- [ ] **Step 5: Implement the login modal**

Use shared Button, Input, Dialog, and Toast components. Support Google login,
email validation, progress state, magic-link confirmation, light/dark styling,
and mobile width. All strings use `Trans` or `t`.

- [ ] **Step 6: Implement account navigation**

Signed-out state opens the registered modal. Signed-in state shows image or
initials and a dropdown with verified email and sign-out.

- [ ] **Step 7: Implement the email callback**

Validate the Firebase link, use stored email when available, accept explicit
email for cross-device completion, clear stored email on success, and redirect
home. Invalid and expired links offer a return to sign-in.

- [ ] **Step 8: Run UI tests, UI typecheck, and Next.js typecheck**

```bash
pnpm -F @acme/ui typecheck
pnpm -F @acme/nextjs test
pnpm -F @acme/nextjs typecheck
```

Expected: PASS.

### Task 5: Production readiness and full verification

**Files:**

- Modify: `apps/nextjs/src/app/page.tsx`
- Modify: `apps/nextjs/src/app/_components/news-home-model.ts`
- Modify: relevant focused tests

- [ ] **Step 1: Write a failing readiness test**

Assert production readiness refers to Firebase configuration rather than a
Better Auth secret for the Next.js application.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts
```

- [ ] **Step 3: Update readiness**

Use validated Firebase project configuration as `authConfigured` and update the
readiness wording without changing unrelated marketing or SEO copy.

- [ ] **Step 4: Run focused repository verification**

```bash
pnpm -F @acme/auth test
pnpm -F @acme/api test
pnpm -F @acme/nextjs test
pnpm -F @acme/auth typecheck
pnpm -F @acme/api typecheck
pnpm -F @acme/ui typecheck
pnpm -F @acme/nextjs typecheck
pnpm -F @acme/auth lint
pnpm -F @acme/api lint
pnpm -F @acme/ui lint
pnpm -F @acme/nextjs lint
```

Expected: all commands PASS without migration or catalog generation.

- [ ] **Step 5: Browser verification**

Start the Next.js app and verify:

- mobile and desktop login modal
- light and dark themes
- empty and invalid email feedback
- magic-link request initiation
- Google provider initiation
- authenticated account menu
- reload persistence
- `auth.getSession` returns the linked application user
- sign-out returns requests to anonymous state

- [ ] **Step 6: Completion audit**

Compare current files, command output, and browser behavior against every
acceptance criterion in
`docs/superpowers/specs/2026-07-20-firebase-login-design.md`. Do not claim
completion for any criterion lacking direct evidence.
