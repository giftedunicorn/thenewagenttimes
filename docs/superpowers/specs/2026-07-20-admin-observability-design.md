# Admin Observability Design

## Goal

Add a private administrator application that makes The New AI Times'
operational state understandable from production data. The first release must
show whether ingestion, background jobs, content freshness, embedding, sources,
and reader activity are healthy without mixing admin code into the public news
experience.

The design borrows VibeCom's useful admin boundaries—an independent Next.js
application, an admin-only tRPC package, server-side authorization, a persistent
navigation shell, summary cards, and filterable tables. It does not copy
VibeCom's Growth, billing, subscription, SEO, attribution, blog, email,
playground, studio, or product-specific event surfaces.

## Current State

The repository has three user-facing applications but no admin application or
administrator role model. `apps/nextjs` already provides tRPC and the public
news product, and the current Firebase login work establishes verified Firebase
identities linked to application users. PostgreSQL already contains the data
needed for an initial operational dashboard:

- application users and Firebase account links;
- news sources and items;
- ingestion runs and per-source health metadata;
- durable background jobs, attempts, leases, results, and errors;
- reader profiles and interactions.

The existing news health model can identify content freshness, source catalog
readiness, ingestion failures, and semantic embedding readiness. It does not
record request latency, HTTP error rate, CPU, memory, or other infrastructure
telemetry.

## Scope

Create:

- `apps/admin`, a separately built and deployed Next.js application;
- `packages/admin-api`, an admin-only tRPC API;
- a responsive, theme-aware admin shell;
- Overview, Ingestion, Jobs, Content, Sources, and Users pages;
- an independent Railway service configuration for the admin application.

The first release is read-only. It observes production state but cannot retry
jobs, start refreshes, edit content, change source credibility, enable or
disable sources, or modify users.

## Non-Goals

- Growth, billing, subscriptions, payments, credit usage, SEO, attribution,
  blog, email, reports, playground, studio, and generic product event pages.
- A new event or telemetry table.
- Web/API P95 latency, HTTP error rate, Railway CPU, memory, network, or disk
  charts. Those require a real telemetry source and may be added later.
- Database schema changes, generated migrations, or database update commands.
- Database-backed roles, teams, or fine-grained administrator permissions.
- Operational mutations.

## Architecture

The runtime flow is:

```text
Admin browser
     |
     | Firebase session cookie
     v
apps/admin
     |
     | /api/trpc
     v
packages/admin-api
     |
     | adminProcedure
     v
shared PostgreSQL
  |-- user / account
  |-- news_source / news_item
  |-- ingestion_run
  |-- background_job
  `-- news_reader_profile / news_reader_interaction
```

### `apps/admin`

`apps/admin` owns the login flow, route protection, admin layout, navigation,
pages, theming, and tRPC client. It does not import the database client or make
the final authorization decision.

The login behavior follows VibeCom admin:

1. the login page opens Google sign-in through the Firebase browser SDK;
2. the browser sends the resulting Firebase ID token to `/api/auth/session`;
3. the server verifies the token with Firebase Admin, resolves its linked
   application user, and checks admin access;
4. the server creates a host-scoped Firebase session cookie with the maximum
   supported 14-day lifetime;
5. the admin tRPC context verifies that cookie on every request;
6. logout deletes the session cookie, signs out Firebase in the browser, and
   returns to `/login`.

The cookie is HTTP-only, `SameSite=Lax`, scoped to `/`, and secure in
production. Raw ID tokens and Firebase service-account credentials are never
stored in application state, logs, or the repository.

A lightweight Next.js proxy checks for a session cookie and redirects anonymous
page requests to `/login`. This is a usability guard only; API authorization is
the security boundary.

### `packages/admin-api`

`packages/admin-api` owns the tRPC context, `adminProcedure`, input validation,
database aggregation, pagination, filtering, and response shaping. Every
operational router uses `adminProcedure`; there is no public procedure for
monitoring data.

The package exposes these routers:

- `overview`
- `ingestion`
- `jobs`
- `content`
- `sources`
- `users`

Database errors are logged on the server and sanitized before reaching the
browser. Responses never include SQL, stack traces, secrets, session tokens, job
locks that are not useful for diagnosis, or unrequested JSON metadata.

### Administrator Authorization

VibeCom stores an administrator role on its product-specific user table. This
repository's generated Better Auth user table has no role field, so copying that
single storage detail would require an otherwise unnecessary database schema
change. Administrators are instead controlled by the `ADMIN_EMAILS` server
environment variable. It is a comma-separated allowlist. Parsing trims
whitespace, lowercases addresses, removes duplicates, rejects an empty
production configuration, and never exposes the configured list to the client.

`adminProcedure`:

1. verifies the Firebase session cookie;
2. returns `UNAUTHORIZED` when no authenticated user exists;
3. resolves the Firebase UID to the stable application user and normalizes the
   verified email;
4. returns `FORBIDDEN` when the normalized email is absent from
   `ADMIN_EMAILS`;
5. passes a non-null admin identity to the router.

The API check runs on every request. A forged cookie, direct tRPC call, or
client-side navigation cannot bypass it.

This avoids a database migration while the admin audience is a small internal
group. A database-backed role model should replace it only when permission
management becomes a real product requirement.

## Pages And Data Contracts

All list queries perform filtering, sorting, and pagination on the server. A
page returns no more than 50 rows. Dates are transferred as absolute timestamps
and rendered in the browser's timezone. Large JSON fields are omitted from list
responses and loaded only as part of a selected row's bounded detail payload.

### Overview

Overview answers one question first: does the news system currently need
attention?

It returns:

- an overall `healthy`, `degraded`, or `critical` state;
- latest published story time and freshness state;
- stories collected and published in the last 24 hours;
- embedded and unembedded published story counts and embedding coverage;
- latest aggregate ingestion run, duration, outcome, item yield, failed-source
  count, and empty-source count;
- queued, actively running, retrying, terminally failed, and recently succeeded
  background job counts;
- age of the oldest due queued job;
- seven UTC daily buckets for collected stories and ingestion outcomes;
- a prioritized list of derived operational findings.

Findings are derived from observable state, not from the admin service merely
having access to an environment variable. Examples include stale live content,
an overdue queue, expired or stalled work, terminal job failures, failed
sources, no active sources, and incomplete embedding.

The initial thresholds are named server constants rather than scattered UI
conditions. Content older than the existing news freshness threshold is stale.
A due queued job is overdue after it remains unclaimed beyond the expected
two-hour scheduling window. A running job is stalled only when its lease is
expired; an unexpired long-running lease is not mislabeled.

### Ingestion

The Ingestion page filters by run status, run type, source, and time range. Each
row shows:

- source or aggregate run;
- run type and status;
- start and finish timestamps;
- duration;
- items seen, created, and updated;
- bounded error text.

Aggregate run details parse the existing `metadata.sourceHealth` structure and
show succeeded, failed, and empty source counts plus source-specific failure and
empty-result messages. Invalid or historical metadata is treated as unavailable
rather than cast unsafely.

### Jobs

The Jobs page filters by job type, status, and time range and sorts newest first
by default. Each row shows:

- job type and status;
- created, next-run, start, and completion timestamps;
- queue wait and execution duration when derivable;
- attempts and maximum attempts;
- worker ID for running or historical diagnosis;
- bounded error text.

The detail view may show the validated job payload and result. It does not
provide retry, cancel, unlock, or delete controls.

### Content

The Content page filters by status, category, source, embedding status, and a
trimmed title/URL search term. Each row shows:

- title and canonical URL;
- source;
- publication and collection timestamps;
- status and category;
- source and trend scores;
- embedding status.

The detail view shows bounded text and operational metadata useful for data
quality diagnosis: summary, original URL, tags, entities, cluster key, dedupe
key, language, and author. It does not edit or republish the item.

### Sources

The Sources page shows all configured sources with:

- name, slug, type, and active state;
- credibility;
- feed and homepage availability;
- story count;
- latest collected story;
- latest source-specific ingestion status and timestamp.

Derived status highlights active sources with no recent content, recent failed
runs, and missing feed URLs where the source type expects a feed. It does not
change source configuration.

### Users

The Users page filters by email or name and shows:

- user ID, name, email, verification state, and creation time;
- whether a Firebase account is linked;
- whether a reader profile exists;
- reader interaction count and latest interaction time.

It does not invent VibeCom's plan, billing status, role, or account status
fields because they do not exist in this product.

## UI And Interaction Design

The layout keeps VibeCom's useful persistent sidebar pattern but corrects its
desktop-only and light-only assumptions:

- a collapsible sidebar on desktop;
- a sheet navigation on narrow screens;
- a compact top bar with page title, theme switcher, and signed-in identity;
- semantic status badges with text and icon cues, not color alone;
- summary cards that reflow from one to four columns;
- horizontally scrollable tables with the important identity column pinned or
  repeated in compact mobile rows where necessary;
- consistent loading skeleton, empty state, request error, and stale-data
  treatment on every page;
- light and dark themes through `packages/ui`;
- visible focus, keyboard navigation, labelled controls, and accessible table
  semantics.

The application uses components from `packages/ui`. Only components actually
needed by the approved pages are added, such as Card, Badge, Table, Select,
Skeleton, and Sheet. It does not copy local button, input, modal, or table
implementations from VibeCom.

Overview uses small summary cards, a simple seven-day trend visualization, and
an ordered findings panel. It does not add a general charting dependency for
one small time series.

## Language

Admin is an internal operational tool and does not require multilingual
support. Its interface uses concise English copy, matching VibeCom admin. It
does not add Lingui, locale routing, catalogs, extraction commands, or a locale
switcher.

## Error And Empty States

- Anonymous requests receive `UNAUTHORIZED` and page navigation redirects to
  login.
- Authenticated non-admin users receive `FORBIDDEN` and see a dedicated access
  denied state.
- Invalid filters receive a typed tRPC input error.
- Database failures display a generic retry message and are logged only on the
  server.
- Empty tables distinguish “no production data exists” from “no rows match the
  current filters.”
- Overview displays the last successful data timestamp and marks old query data
  as stale rather than silently presenting it as current.
- Malformed legacy JSON metadata is omitted with an explicit unavailable label.

## Railway Deployment

Admin is a fourth Railway application service with
`/apps/admin/railway.json`. It has direct build and start commands, uses Next.js
standalone output, and watches only the admin app and its workspace
dependencies. It does not run database predeploy because it introduces no
schema changes and the web service remains the single schema owner.

Required variables:

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
RAILWAY_PUBLIC_DOMAIN
```

The public Firebase values may reference the same project values used by the
web application. `FIREBASE_SERVICE_ACCOUNT_JSON` is a server-only Railway
secret used to create and verify Firebase session cookies; it is never written
to a file in the repository or exposed through `NEXT_PUBLIC_*`.
`ADMIN_EMAILS` is admin-service-only. `RAILWAY_PUBLIC_DOMAIN` is supplied by
Railway for the admin service. The deployed admin domain must be added to
Firebase Authentication's authorized domains before login verification.

Deploying admin does not change the web, worker, or cron routes, schedules, or
restart policies.

## Testing

Implementation follows test-driven development. Focused tests cover:

- strict `ADMIN_EMAILS` parsing and normalization;
- Google ID-token exchange, session-cookie creation, and logout;
- anonymous, authenticated non-admin, and allowed-admin tRPC calls;
- error sanitization;
- overview aggregation and every operational finding threshold;
- safe ingestion source-health metadata parsing;
- filter input schemas and bounded pagination for every list router;
- job durations and stalled/overdue classifications;
- source and user aggregate response shaping;
- responsive navigation and protected-route behavior;
- loading, empty, request error, and forbidden UI states;
- Railway build/start/watch configuration.

Verification includes focused tests, touched-package test suites, typechecks,
lint, formatting, the admin production build, and browser checks at desktop and
mobile widths in light and dark themes. The deployed service is verified with
an allowed Google account and production data.

No database migration, database update, database push, or hand-written migration
is part of implementation or verification.

## Acceptance Criteria

- `apps/admin` exists as a separately buildable and deployable application.
- `packages/admin-api` exposes only admin-authorized operational routers.
- Anonymous and non-allowlisted users cannot read monitoring data.
- Overview accurately summarizes freshness, ingestion, embedding, and queue
  health from current database state.
- Ingestion, Jobs, Content, Sources, and Users provide useful server-filtered
  read-only views.
- The UI is responsive, keyboard accessible, and theme-aware.
- The admin Railway service has direct config-as-code and all required
  environment variables.
- Production login and all six data surfaces are verified after deployment.
- No Growth or other excluded VibeCom surface is present.
- No database schema or migration is changed.
