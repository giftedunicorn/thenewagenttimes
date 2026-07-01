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

Required production environment variables include the database URL used by `@acme/db` and a real `BETTER_AUTH_SECRET`.

## Verification

Run focused checks before deployment:

```bash
pnpm -F @acme/validators test
pnpm -F @acme/api test
pnpm -F @acme/nextjs test
pnpm -F @acme/nextjs typecheck
pnpm run build:nextjs
```
