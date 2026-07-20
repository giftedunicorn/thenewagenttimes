# Firebase Login Design

## Goal

Add a complete web login system to The New AI Times by following VibeCom's
Firebase authentication pattern. Readers can sign in with Google or an email
magic link, remain signed in across browser sessions, sign out, and have their
verified Firebase identity available to the existing tRPC personalization and
reader-interaction APIs.

The Next.js application will use the same Firebase project already configured
for VibeCom, so an existing VibeCom Firebase account can authenticate without
creating a second Firebase identity.

## Scope

This design covers the deployed Next.js application:

- Google authentication
- email magic-link authentication and callback completion
- persistent browser authentication state
- authenticated tRPC requests
- a responsive login modal
- signed-in account controls and sign-out
- linking Firebase identities to the existing application `user` records
- English Lingui messages for every new user-facing string
- dark and light presentation

The TanStack Start and Expo applications retain their current Better Auth
integration. Firebase becomes the authentication runtime for the Next.js
application, not a repository-wide forced migration.

Password authentication, account settings, account deletion, provider
unlinking, multi-factor authentication, and admin roles are outside this
feature.

## Existing Constraints

The repository already contains Better Auth server configuration and generated
Better Auth tables. News reader data references the existing `user.id`, so a
Firebase-only client implementation would fail when authenticated readers save
stories or record preferences without a matching database user.

Database migrations are not required. The existing `account` table can map a
Firebase UID to an application user:

- `providerId`: `firebase`
- `accountId`: the verified Firebase UID
- `userId`: the stable existing application user ID

This mapping preserves existing Better Auth users and their reader data. If a
verified Firebase email matches an existing application user, the Firebase
account is linked to that user rather than replacing the primary key.

## Architecture

### Firebase client

The Next.js client owns a single lazily initialized Firebase App and Auth
instance. The configuration comes from validated
`NEXT_PUBLIC_FIREBASE_*` variables already present in the local environment.
Firebase IndexedDB persistence keeps the browser session across reloads.

An `AuthProvider` subscribes to Firebase authentication state and exposes:

- readiness and loading state
- the current Firebase user
- Google sign-in
- email magic-link sending
- sign-out

Google uses a popup on desktop browsers. iOS uses a same-origin redirect flow,
matching VibeCom's behavior, because WebKit can discard popups after an
asynchronous import. The Firebase auth handler paths are proxied through the
application origin for the redirect flow.

The provider does not persist a duplicate serialized user in application
storage. Firebase remains the authority for browser persistence, which avoids
showing an optimistic user after Firebase has revoked the session.

### Server token verification

Every browser tRPC request asks the current Firebase user for an ID token and
sends it as:

```text
Authorization: Bearer <firebase-id-token>
```

Requests without a current Firebase user omit the header. They never send the
literal values `Bearer undefined` or `Bearer null`.

`@acme/auth` exposes a Firebase session verifier for the Next.js runtime. It
uses Firebase Admin with the configured project ID to validate the token's
signature, audience, issuer, and expiration. The server trusts only decoded
claims returned by this verifier; client-provided UID, email, name, or image
fields are never accepted as identity.

The generic tRPC context accepts an injected session reader rather than a
Better Auth-specific object. Next.js injects the Firebase reader. TanStack Start
continues to adapt its Better Auth session reader to the same context contract.
The unused `authApi` field is removed from the API context because no router
consumes it.

### Application-user linking

After verification, the server resolves the Firebase UID through the existing
`account` table:

1. Look up the deterministic Firebase account mapping.
2. If it exists, return its linked application user.
3. Otherwise, require a verified token email and look up an existing user by
   normalized email.
4. Reuse that user when found; otherwise create a user from the verified
   Firebase claims.
5. Insert the Firebase account mapping with a deterministic account ID, making
   concurrent first requests converge on one mapping.
6. Return a session whose `user.id` is the application user ID, not the
   Firebase UID.

This makes existing news procedures continue to use `ctx.session.user.id`
without schema or router changes. The returned session includes `id`, `name`,
`email`, `emailVerified`, and `image`, matching the fields the application
already expects.

If linking fails, authentication fails closed for that request and the client
shows a generic sign-in error. It does not create reader interactions under an
unlinked Firebase UID.

### Better Auth coexistence

The Next.js `/api/auth/[...all]` Better Auth handler is removed because the web
application no longer creates Better Auth sessions. Shared Better Auth code and
tables remain for TanStack Start and Expo. This avoids a high-risk
repository-wide migration and avoids dual sessions inside the Next.js
application.

## User Experience

### Entry points

The public navigation contains one account control:

- signed out: `Sign in`
- resolving Firebase state: a disabled loading control that does not flash a
  signed-out action
- signed in: the reader's image when available, otherwise initials, with a
  menu containing the email and `Sign out`

The control is keyboard accessible, remains visible at mobile widths, and uses
components exported by `packages/ui`.

### Login modal

The `LoginModal` is a NiceModal modal registered once in `Modals.tsx`. It
contains:

- The New AI Times identity and a short reader-focused description
- `Continue with Google`
- an email field
- `Continue with Email`
- progress and disabled states
- inline or toast feedback for validation and provider errors

Closing the modal does not mutate authentication state. A successful Google
login closes it only after Firebase supplies a signed-in user. Sending a magic
link changes the modal to a confirmation state and leaves the user signed out
until the link is completed.

The modal uses `packages/ui` Button, Input, Dialog, Dropdown Menu, and Toast
components. Any missing primitives are added to `packages/ui`, rather than
building application-local substitutes.

### Email callback

`/auth/callback` verifies that the current URL is a Firebase email sign-in link.
It retrieves the email stored when the link was sent. If storage is unavailable
or the link is opened on another device, it asks the reader to re-enter the
email before completing sign-in.

Success clears the stored email and redirects to `/`. Invalid, expired, or
already-used links render a recoverable error with a button that returns to the
home page and reopens sign-in.

### Sign-out

Sign-out calls Firebase Auth, clears authentication-sensitive React Query
cache, closes the account menu, and returns to the public home page. Anonymous
local recommendation memory is not erased because it is separate from the
authenticated identity.

## Internationalization and Theme

All new JSX copy uses `Trans`; placeholders, toast strings, and attributes use
the Lingui `t` macro. The implementation adds the minimum Lingui runtime and
Next.js compilation setup required by the repository rules, with English as the
initial locale.

No `.po` file is edited and no catalog extraction command is run. The new UI is
implemented with semantic theme tokens plus the existing newspaper palette so
it remains legible in both light and dark modes.

## Configuration

The validated Next.js client environment includes:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The server uses `NEXT_PUBLIC_FIREBASE_PROJECT_ID` as the Firebase project ID for
token verification. No service-account JSON is copied into this repository and
no private Firebase credential is exposed to browser code.

The example environment file documents the Firebase variables without real
values. Production deployment still requires the variables to be configured in
the hosting environment and the deployed domain to be authorized in Firebase
Authentication.

## Error Handling

The UI maps Firebase failures into concise user-facing categories:

- popup closed or cancelled: restore the idle state without a destructive toast
- popup blocked: tell the reader to allow the popup and retry
- provider or network failure: show a retryable error
- invalid email: prevent the request locally
- email link expired or invalid: offer a fresh sign-in
- server token rejection: clear stale client auth and require sign-in again

Detailed provider errors may be logged in development, but raw Firebase error
objects, tokens, and credentials are never shown in the UI or production logs.

## Testing

Implementation follows red-green-refactor with focused tests:

- Firebase environment validation accepts complete configuration and rejects
  incomplete production configuration.
- The tRPC link omits authorization for signed-out users and sends a real token
  for signed-in users.
- Server verification rejects missing, malformed, expired, wrong-project, and
  unverified-email identities.
- Account linking reuses a Firebase mapping, links by normalized email, creates
  a new user when necessary, and converges under repeated requests.
- The auth provider exposes loading, signed-in, and signed-out transitions.
- Login modal validation prevents an empty or malformed email and shows the
  magic-link confirmation state.
- Email callback handles stored-email success, cross-device email entry, and
  invalid links.
- Account controls open login, render the authenticated identity, and sign out.
- Existing anonymous news behavior remains available without an Authorization
  header.

Focused Vitest suites, package type checks, and lint run before browser
verification. Browser verification covers responsive light and dark layouts,
opening and closing the modal, email validation, Firebase provider initiation,
session persistence after reload, authenticated tRPC session visibility, and
sign-out.

## Acceptance Criteria

The feature is complete when:

1. A reader can sign in with Google through Firebase on desktop and iOS.
2. A reader can request and complete a Firebase email magic link.
3. Reloading preserves a valid Firebase session without showing another user's
   cached data.
4. Authenticated tRPC requests expose the stable linked application user ID.
5. Saving and personalizing news works without user foreign-key failures.
6. A reader can sign out and subsequent requests are anonymous.
7. Login and account UI are responsive, keyboard accessible, translated
   through Lingui, and legible in light and dark modes.
8. No Firebase service-account file, token, or private credential is committed.
9. TanStack Start and Expo retain their current Better Auth behavior.
10. Focused tests, type checks, lint, and browser verification pass.
