# The New AI Times

The New AI Times is a news aggregation and recommendation system for AI news. The web app presents a newspaper-style front page, reader preference signals, personalized ranking, saved and recently read stories, article-level context, and Railway-ready deployment commands.

## Apps

```text
apps/nextjs          Next.js web application for the news product
apps/expo            Legacy mobile shell retained in the monorepo
apps/tanstack-start  Legacy experimental web shell retained in the monorepo
```

The production Railway service should deploy the Next.js app through the root monorepo scripts, not the Expo or TanStack Start examples.

## Packages

```text
packages/api         tRPC routers for news, profiles, interactions, and feeds
packages/db          Drizzle schema and database client
packages/ingestion   Source seeding, RSS ingestion, refresh, and embedding jobs
packages/ui          Shared UI components
packages/validators  Ranking, recommendation, profile, and dedupe logic
```

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm run build:nextjs
pnpm run start:nextjs
```

Useful news commands:

```bash
pnpm run news:seed-sources
pnpm run news:ingest:rss:active
pnpm run news:refresh
pnpm run news:ingest:arxiv-ai
pnpm run news:bootstrap:remote
pnpm run news:health:remote
pnpm run news:refresh:remote
pnpm run news:embed:remote
pnpm run news:embed:pending
```

Database schema changes live in `packages/db/src/schemas/*`. Do not hand-edit migration files.

## Railway

Railway should use the root directory and the `main` branch.

The checked-in `railway.json` configures Railpack with:

```bash
pnpm run deploy:nextjs
pnpm run start:nextjs
```

The Next.js app is built with `output: "standalone"`, and the root start script runs:

```bash
node apps/nextjs/.next/standalone/apps/nextjs/server.js
```

The build script also syncs `.next/static` and `public` into the standalone
directory so Railway serves CSS, JavaScript chunks, fonts, and icons from the
standalone server.

If Railway creates or selects a service rooted at `apps/tanstack-start`, use the
checked-in `apps/tanstack-start/railway.json`. It delegates that service back to
the root Next.js build and start commands so the deployed page is The New AI
Times, not the legacy TanStack Start scaffold.
The TanStack package's default `build` and `start` scripts also delegate to the
root Next.js deployment commands as a fallback for Railpack package-script
detection. Use `build:tanstack` and `start:tanstack` only when explicitly
testing the legacy shell.

Do not intentionally configure Railway services with `packages/api` or
`packages/db` as the app root. They are shared workspace packages, not
standalone web services; a Railway app should point at the repo root or
`apps/nextjs` so Railpack sees the workspace lockfile, Next.js app, and root
deployment scripts. The package-level `railway.json` files are defensive
fallbacks only: if Railway is accidentally rooted at `packages/api` or
`packages/db`, they delegate build and start back to the root Next.js service
instead of letting Railpack fail with "No start command detected."

Required production environment variables:

```text
POSTGRES_URL
BETTER_AUTH_SECRET
AUTH_SECRET
NEWS_REFRESH_SECRET
OPENAI_API_KEY
```

`OPENAI_API_KEY` is required before running `pnpm run news:embed:remote` on a
deployed service or `pnpm run news:embed:pending` with direct database access.
`OPENAI_EMBEDDING_MODEL` is optional and defaults to
`text-embedding-3-small`.

`NEWS_HEALTH_URL` is optional for `pnpm run news:health:remote`. It accepts the
deployed app base URL, `/api/news/health`, `/api/news/refresh`, or
`/api/news/embed`. When omitted, the command falls back to `NEWS_REFRESH_URL`,
`NEWS_EMBED_URL`, `NEWS_BOOTSTRAP_URL`, or `RAILWAY_PUBLIC_DOMAIN`.

`NEWS_REFRESH_URL` is optional on Railway when `RAILWAY_PUBLIC_DOMAIN` is
available. It accepts the deployed app base URL, `/api/news/refresh`,
`/api/news/health`, or `/api/news/embed`. When omitted, the command falls back
to `NEWS_HEALTH_URL`, `NEWS_EMBED_URL`, or `RAILWAY_PUBLIC_DOMAIN`.

`NEWS_EMBED_URL` follows the same pattern for remote semantic embedding jobs.
It can be omitted when `NEWS_HEALTH_URL`, `NEWS_REFRESH_URL`, or
`RAILWAY_PUBLIC_DOMAIN` is available.

`NEWS_BOOTSTRAP_URL` is optional for `pnpm run news:bootstrap:remote`. It
accepts the deployed app base URL, `/api/news/health`, `/api/news/refresh`, or
`/api/news/embed`. When omitted, the command falls back to `NEWS_HEALTH_URL`,
`NEWS_REFRESH_URL`, `NEWS_EMBED_URL`, or `RAILWAY_PUBLIC_DOMAIN`.
`NEWS_BOOTSTRAP_EMBED_BATCHES` optionally sets how many embedding batches the
bootstrap command may run if semantic health is still pending after the first
batch. It defaults to `1`.

`NEWS_REFRESH_SECRET` protects `POST /api/news/refresh`. Send it as
`Authorization: Bearer <secret>` or `x-news-refresh-secret: <secret>` from a
Railway cron, manual curl, or other scheduler.

Use `/api/news/health` after deploy to check whether the web process, auth
secret, refresh secret, embedding provider, schema, sources, first refresh, and
semantic embeddings are ready. It returns top-level `ready`, `checks` for
automation, `news.liveReady` for live published stories,
`news.semanticReady` for completed embeddings, `actionRequired` with the
next production bootstrap step, and `commands.next` with the matching repo
command when the next step can be run from the workspace. The `nextStep` value
is a stable
machine-readable summary such as
`configure-auth-secret`, `configure-embedding-provider`,
`apply-database-schema`, `run-news-refresh`, `embed-news-stories`, or `ready`.

You can check the deployed service from the repo root:

```bash
NEWS_HEALTH_URL=https://thenewagenttimes.up.railway.app \
pnpm run news:health:remote
```

`NEWS_REFRESH_URL` is used by `pnpm run news:refresh:remote`. It accepts the
deployed app base URL, `/api/news/refresh`, `/api/news/health`, or
`/api/news/embed`. If it is not set, the command falls back to
`NEWS_HEALTH_URL`, `NEWS_EMBED_URL`, or `RAILWAY_PUBLIC_DOMAIN` and calls the
deployed app over HTTPS:

```bash
NEWS_REFRESH_URL=https://thenewagenttimes.up.railway.app \
NEWS_REFRESH_SECRET=replace-me \
pnpm run news:refresh:remote
```

`NEWS_EMBED_URL` is used by `pnpm run news:embed:remote`. It accepts the
deployed app base URL, `/api/news/embed`, `/api/news/health`, or
`/api/news/refresh`. The endpoint uses the same `NEWS_REFRESH_SECRET`, runs a
bounded pending-or-failed embedding batch, and requires `OPENAI_API_KEY` to be
configured on the deployed service:

```bash
NEWS_EMBED_URL=https://thenewagenttimes.up.railway.app \
NEWS_REFRESH_SECRET=replace-me \
NEWS_EMBED_LIMIT=25 \
pnpm run news:embed:remote
```

You can also pass just a batch limit when the URL comes from
`NEWS_EMBED_URL`, `NEWS_HEALTH_URL`, `NEWS_REFRESH_URL`, or
`RAILWAY_PUBLIC_DOMAIN`:

```bash
pnpm run news:embed:remote 25
```

After the database schema and required Railway variables are configured, the
single bootstrap command runs a health preflight, remote refresh, remote
embedding batch, and final health check in order. Missing auth secret, refresh
secret, or database schema stops the command before refresh and prints the
health `nextStep`. A missing `OPENAI_API_KEY` does not block live story refresh;
bootstrap will refresh stories first, then stop before embedding and report
`configure-embedding-provider`.

```bash
NEWS_BOOTSTRAP_URL=https://thenewagenttimes.up.railway.app \
NEWS_REFRESH_SECRET=replace-me \
NEWS_EMBED_LIMIT=25 \
NEWS_BOOTSTRAP_EMBED_BATCHES=4 \
pnpm run news:bootstrap:remote
```

You can also pass the embedding batch limit and maximum batch count when the URL
comes from the environment:

```bash
pnpm run news:bootstrap:remote 25 4
```

For a new Railway database, the app can build and start before the news tables
exist, but the front page will use preview stories until the schema and sources
are bootstrapped. Run the deploy schema sync only when you intend to update the
target database. For a deployed service, prefer the remote refresh so the same
Railway environment, secret, and public URL are used:

```bash
pnpm run db:predeploy
pnpm run news:refresh:remote
```

`news:refresh:remote` calls the deployed app over HTTPS, seeds the configured AI
news sources, and ingests active RSS feeds. After that, the homepage should
switch from preview stories to live published news rows.

For a deployed service, a Railway cron can call the app over HTTP instead of
connecting directly to the database:

```bash
pnpm run news:refresh:remote
pnpm run news:embed:remote
pnpm run news:bootstrap:remote
```

The commands read `NEWS_REFRESH_SECRET` plus either the task-specific remote
URL or `RAILWAY_PUBLIC_DOMAIN`.

## Verification

Run focused checks before deployment:

```bash
pnpm -F @acme/validators test
pnpm -F @acme/api test
pnpm -F @acme/nextjs test
pnpm -F @acme/nextjs typecheck
pnpm run build:nextjs
```
