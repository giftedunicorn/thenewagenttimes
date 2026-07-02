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
pnpm run news:health:remote
pnpm run news:refresh:remote
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

Required production environment variables:

```text
POSTGRES_URL
BETTER_AUTH_SECRET
AUTH_SECRET
NEWS_REFRESH_SECRET
```

`NEWS_REFRESH_URL` is optional on Railway when `RAILWAY_PUBLIC_DOMAIN` is
available. Set `NEWS_REFRESH_URL` explicitly for custom domains, local scripts,
or non-Railway schedulers.

`NEWS_REFRESH_SECRET` protects `POST /api/news/refresh`. Send it as
`Authorization: Bearer <secret>` or `x-news-refresh-secret: <secret>` from a
Railway cron, manual curl, or other scheduler.

Use `/api/news/health` after deploy to check whether the web process, auth
secret, refresh secret, schema, sources, and first refresh are ready. It returns
top-level `ready`, `checks` for automation, and `actionRequired` with the next
production bootstrap step. The `nextStep` value is a stable machine-readable
summary such as `configure-auth-secret`, `apply-database-schema`,
`run-news-refresh`, or `ready`.

You can check the deployed service from the repo root:

```bash
NEWS_HEALTH_URL=https://thenewagenttimes.up.railway.app \
pnpm run news:health:remote
```

`NEWS_REFRESH_URL` is used by `pnpm run news:refresh:remote`. It accepts either
the deployed app base URL or the full `/api/news/refresh` endpoint. If it is not
set, the command falls back to `RAILWAY_PUBLIC_DOMAIN` and calls the deployed
app over HTTPS:

```bash
NEWS_REFRESH_URL=https://thenewagenttimes.up.railway.app \
NEWS_REFRESH_SECRET=replace-me \
pnpm run news:refresh:remote
```

For a new Railway database, the app can build and start before the news tables
exist, but the front page will use preview stories until the schema and sources
are bootstrapped. Run the database push only when you intend to update the
target database:

```bash
pnpm run db:push
pnpm run news:refresh
```

`news:refresh` seeds the configured AI news sources and ingests active RSS
feeds. After that, the homepage should switch from preview stories to live
published news rows.

For a deployed service, a Railway cron can call the app over HTTP instead of
connecting directly to the database:

```bash
pnpm run news:refresh:remote
```

The command reads `NEWS_REFRESH_SECRET` plus either `NEWS_REFRESH_URL` or
`RAILWAY_PUBLIC_DOMAIN`.

## Verification

Run focused checks before deployment:

```bash
pnpm -F @acme/validators test
pnpm -F @acme/api test
pnpm -F @acme/nextjs test
pnpm -F @acme/nextjs typecheck
pnpm run build:nextjs
```
