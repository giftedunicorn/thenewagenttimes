# The New AI Times

The New AI Times is an AI news aggregation and recommendation system. The
production architecture separates web traffic, scheduled triggers, and
long-running ingestion work.

## Repository Structure

```text
apps/nextjs                 Production news website and enqueue-only APIs
apps/expo                   Mobile shell
apps/tanstack-start         Legacy experimental web shell
packages/api                tRPC news and reader APIs
packages/db                 Drizzle schemas, database client, and job queue
packages/ingestion          News refresh and embedding domain logic
packages/background-worker Long-running background job processor
packages/cron               One-shot Railway schedule producer
packages/ui                 Shared UI components
packages/validators         Ranking and recommendation logic
```

`background_job` in PostgreSQL is the contract between producers and workers.
The cron process and manual web endpoints insert jobs. The background worker
claims them with a lease, renews the lease while working, records success or
failure, retries recoverable failures with backoff, and reclaims expired jobs.

The services share `POSTGRES_URL`; they do not call each other over HTTP.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm run build:nextjs
pnpm run start:nextjs
```

Useful direct-development commands:

```bash
pnpm run news:seed-sources
pnpm run news:refresh
pnpm run news:embed:pending
pnpm run news:health:remote
pnpm --filter @acme/background-worker dev
pnpm --filter @acme/cron start
```

Database schema changes live in `packages/db/src/schemas/*`. Generate schema
updates with the project workflow; do not hand-edit migration files.

## Railway Services

Create three services from the same repository and branch. In each Railway
service, select its checked-in config file once:

| Service             | Railway config path                        | Process                  |
| ------------------- | ------------------------------------------ | ------------------------ |
| `web`               | `/apps/nextjs/railway.json`                | Next.js web server       |
| `background-worker` | `/packages/background-worker/railway.json` | Always-on queue worker   |
| `cron`              | `/packages/cron/railway.json`              | Native UTC cron producer |

`/railway.json` is also a direct web configuration for deployments that use the
repository root.

Config-as-code supplies build, start, restart, watch, predeploy, and cron
settings. Railway still requires the config path to be selected for each
service; a `railway.json` file does not create multiple Railway services.

### Rollout Order

An existing `news-refresh-cron` service may still be configured to read
`/railway.json`. Change its **Config File Path** to
`/packages/cron/railway.json` before deploying this revision. Otherwise that
scheduled service will start the web server instead of enqueueing a job.
Remove any service-level custom Build Command, Start Command, or Pre-deploy
Command left by the previous `news:bootstrap:remote` deployment so the checked-in
config remains authoritative.

Deploy in this order:

1. Pause the existing cron schedule while changing its config path.
2. Deploy `web` first so its predeploy step installs the `background_job`
   schema.
3. Create `background-worker` from the same GitHub repository and `main` branch,
   select `/packages/background-worker/railway.json`, and clear custom command
   overrides.
4. Deploy and resume `cron` with `/packages/cron/railway.json`.

The `web`, `background-worker`, and `cron` services must reference the same
`POSTGRES_URL`.

### Web

The web service builds and starts Next.js directly:

```bash
pnpm run deploy:nextjs
pnpm run db:predeploy
pnpm run start:nextjs
```

Only the web service runs `db:predeploy`. The worker and cron services never
apply schema changes.

Required web variables:

```text
POSTGRES_URL
BETTER_AUTH_SECRET or AUTH_SECRET
NEWS_REFRESH_SECRET
```

`NEWS_REFRESH_SECRET` protects the optional manual producer endpoints:

```bash
curl -X POST \
  -H "Authorization: Bearer $NEWS_REFRESH_SECRET" \
  -H "Idempotency-Key: operator-refresh-2026-07-19T12:00Z" \
  https://your-domain.example/api/news/refresh

curl -X POST \
  -H "Authorization: Bearer $NEWS_REFRESH_SECRET" \
  -H "Idempotency-Key: operator-embed-2026-07-19T12:00Z" \
  "https://your-domain.example/api/news/embed?limit=25"
```

Both endpoints only insert a `background_job` and return `202 Accepted`; they
do not run refresh or embedding work inside the HTTP request. If an HTTP client
times out before receiving the response, retry with the same `Idempotency-Key`.
The unique queue key returns the original job instead of creating duplicate
work.

### Background Worker

Required worker variables:

```text
POSTGRES_URL
OPENAI_API_KEY
```

Optional worker variables:

```text
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
NEWS_EMBED_LIMIT=25
BACKGROUND_WORKER_ID=
BACKGROUND_WORKER_IDLE_MS=5000
BACKGROUND_WORKER_ERROR_MS=15000
BACKGROUND_WORKER_LEASE_MS=300000
BACKGROUND_WORKER_HEARTBEAT_MS=60000
```

A worker process claims one job at a time. PostgreSQL transaction-level locking
also prevents multiple worker replicas from holding active job leases
simultaneously, so refresh and embedding cannot overlap.

A successful `news_refresh` automatically enqueues the first `news_embed`
batch. Full successful embedding batches enqueue the next batch until the queue
is drained. Failed batches stop chaining and are recorded for inspection.

### Cron

The cron service requires only:

```text
POSTGRES_URL
```

Railway runs it every two hours with the UTC schedule `0 */2 * * *`. The process
creates one deterministic `news_refresh` job per two-hour window and exits.
Duplicate Railway invocations for the same window are successful no-ops.

Database connections wait at most 10 seconds, database statements at most 30
seconds, and the entire cron process has a 60-second hard deadline. A stalled
run exits nonzero instead of blocking later Railway schedules indefinitely.

## Health Check

`GET /api/news/health` reports schema, source catalog, refresh freshness,
published stories, and embedding readiness.

From the repository:

```bash
NEWS_HEALTH_URL=https://your-domain.example \
pnpm run news:health:remote
```

When `NEWS_HEALTH_URL` is empty, the health command can use Railway's
`RAILWAY_PUBLIC_DOMAIN`.

## Verification

```bash
pnpm --filter @acme/db test
pnpm --filter @acme/background-worker test
pnpm --filter @acme/cron test
pnpm --filter @acme/ingestion test
pnpm --filter @acme/nextjs test
pnpm typecheck
pnpm lint
pnpm format
```
