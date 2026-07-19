# Background Jobs Architecture Design

## Goal

Move scheduled news refresh and embedding work out of the Next.js
request-response lifecycle. The deployed system will have a short-lived cron
producer, a durable PostgreSQL-backed job table, and an always-on background
worker.

The design follows BuyerClaw's package separation while removing its remaining
cron-to-Next.js HTTP dependency. A timed trigger must be able to enqueue work
when the web service is unavailable, and a long task must continue independently
of HTTP request timeouts.

## Current State

The repository currently deploys a `news-refresh-cron` service by switching root
scripts on `RAILWAY_SERVICE_NAME`. That service calls the public Next.js health,
refresh, and embed endpoints. The refresh and embed endpoints execute
`refreshNewsSources` and `embedPendingNewsItems` inside the HTTP request.

This has three problems:

- A long refresh or embedding batch is coupled to the web request lifetime.
- The cron service depends on the web service and its public domain.
- One root `railway.json` contains service-name branching instead of describing
  each deployable process directly.

## Architecture

The runtime flow will be:

```text
Railway cron schedule
        |
        v
packages/cron
        |
        v
background_job (PostgreSQL)
        |
        v
packages/background-worker
        |
        +-- news_refresh --> packages/ingestion
        |
        +-- news_embed   --> packages/ingestion
        |
        v
news_source / news_item / news_item_vector
```

The services share `POSTGRES_URL`. They do not communicate through HTTP.

### `packages/cron`

`@acme/cron` is a short-lived Railway cron process. On each start it:

1. Derives the current UTC schedule window.
2. Enqueues one `news_refresh` job with a deterministic dedupe key.
3. Treats an existing dedupe key as a successful no-op.
4. Closes the PostgreSQL client and exits.

Scheduling belongs to Railway through `deploy.cronSchedule`; the package will not
use an in-process scheduling library. Railway skips overlapping cron executions,
and the database dedupe key protects against duplicate starts or manual retries.
PostgreSQL connection and statement waits are bounded, and a process watchdog
forces a nonzero exit if enqueue or connection shutdown exceeds the cron
deadline. This prevents one stalled execution from blocking future schedules.

### `packages/background-worker`

`@acme/background-worker` is an always-on Railway service. It polls PostgreSQL,
atomically claims due jobs, executes the matching ingestion function, and records
the result.

Each worker process runs one job at a time because refresh and embedding share
mutable news records and must not overlap. The polling interval, lease duration,
and embedding batch size may be configured with bounded environment variables.
Database claim serialization applies across worker replicas as well.

The worker handles `SIGINT` and `SIGTERM` by stopping new claims, waiting for
active work to settle, and closing the database client.

### Next.js

Next.js remains the read/web service. Existing authenticated refresh and embed
routes will become fast producer endpoints that enqueue jobs and return `202`
with the job ID. They will no longer import or execute long-running ingestion
functions.

The cron service never calls these endpoints. They remain only for intentional
manual or operational triggers.

## Background Job Schema

Create `packages/db/src/schemas/background-job.ts` and re-export it from the
existing schema entry point. Do not create or hand-edit migration files.

Job types:

- `news_refresh`
- `news_embed`

Statuses:

- `queued`
- `running`
- `succeeded`
- `failed`

The `background_job` table contains:

- `id`
- `jobType`
- `status`
- `dedupeKey`
- `payload`
- `result`
- `attempts`
- `maxAttempts`
- `nextRunAt`
- `lockedBy`
- `lockedAt`
- `lockExpiresAt`
- `startedAt`
- `completedAt`
- `errorMessage`
- `createdAt`
- `updatedAt`

`dedupeKey` is unique. Indexes cover `(status, nextRunAt)` and
`(status, lockExpiresAt)` so due jobs and abandoned leases are inexpensive to
find.

Payloads and results are JSON because they differ by job type. Worker boundaries
validate payloads with Zod before executing a processor. Unknown or invalid job
data fails through the same retry policy rather than being cast to an unsafe
type.

## Queue Semantics

The queue provides at-least-once processing.

### Enqueue

An insert with a deterministic `dedupeKey` creates a queued job. A uniqueness
conflict reads and returns the existing row. Enqueue is therefore idempotent for
the same schedule window or manual request key.

### Claim

A transaction selects the oldest eligible job with
`FOR UPDATE SKIP LOCKED`. Before selecting, it takes a fixed PostgreSQL
transaction-level advisory lock and verifies that no job has an unexpired
running lease. This makes the single-active-job rule global across worker
processes and replicas without preventing recovery of expired leases. Eligible
means:

- `queued` and `nextRunAt <= now`, or
- `running` and `lockExpiresAt <= now`.

The same transaction changes it to `running`, increments `attempts`, assigns the
worker ID, and sets a new lease.

### Lease

The worker periodically extends `lockExpiresAt` while a processor is active. A
lease update is ownership-guarded by job ID, `running` status, and worker ID.
Failure to renew prevents the stale worker from marking the job complete.

If a process dies, another worker can reclaim the job after the lease expires.
News item URL/dedupe constraints and vector uniqueness make the existing
ingestion writes safe for repeated execution.

### Completion And Retry

Successful completion stores a JSON result, clears lock fields, and sets
`completedAt`.

Failure stores a bounded error message. When `attempts < maxAttempts`, the job
returns to `queued` with exponential backoff. Otherwise it becomes `failed`.

Only the worker that owns the active lease may complete or fail a running job.

## Job Processors

### `news_refresh`

The processor calls:

```ts
refreshNewsSources({
  repository: createDbNewsRepository(),
});
```

Its result stores source and item counts. After success it enqueues the first
`news_embed` job using the refresh job ID in the dedupe key.

### `news_embed`

The processor validates the configured OpenAI key, creates the existing embedding
provider, and calls `embedPendingNewsItems` with a bounded batch size.

If the processed count equals the batch limit and every item succeeded, it
enqueues the next embedding batch with an incremented batch number. A partial
batch or a batch containing failed items ends the chain. The ingestion
repository intentionally includes failed items in later scheduled runs, so
immediately chaining a failed full batch could select the same rows repeatedly.
The next scheduled refresh retries those items without creating a tight job
loop.

## Railway Configuration

Each service has one config-as-code file:

- `/apps/nextjs/railway.json`
- `/packages/background-worker/railway.json`
- `/packages/cron/railway.json`

Railway services must select the matching config file once in service settings.
The repository files then own build, start, restart, cron, and watch behavior.
Railway's config-as-code format configures one deployment; it does not create all
three services from a single file.

For an existing deployment, change the old cron service's Config File Path from
the root config to `/packages/cron/railway.json` before deploying this revision.
Clear any service-level build, start, or predeploy command left by the old
remote-bootstrap deployment so config-as-code remains authoritative. Pause that
schedule during the change, deploy web first so its predeploy step installs the
queue schema, then create or deploy the worker, deploy cron, and resume the
schedule.

The web service builds the Next.js standalone output, performs the existing
database predeploy step, and starts the web server.

The worker service typechecks/builds its workspace dependency graph, starts the
worker process, uses `restartPolicyType: ALWAYS`, and gives active work a
ten-minute Railway drain window during deployments.

The cron service typechecks/builds its workspace dependency graph, starts the
one-shot enqueue command, uses a UTC `cronSchedule`, and uses
`restartPolicyType: NEVER`.

The root service-name multiplexing scripts and obsolete remote bootstrap
variables are removed. Only the web service owns database schema deployment.
No database update, push, or migration generation command is run during local
implementation.

## Testing

The queue persistence layer is separated from the worker loop so state transitions
can be tested without a live PostgreSQL database. Focused tests cover:

- job type/status/schema exports;
- deterministic cron dedupe keys;
- duplicate enqueue behavior;
- atomic-claim query contract;
- lease ownership;
- retry delay and terminal failure;
- refresh-to-embed chaining;
- embedding batch chaining;
- graceful worker loop behavior;
- Next.js producer handlers returning `202`;
- Railway config build/start/cron commands.

Verification includes focused package tests, typechecks, lint, formatting, the
full existing test suite for touched packages, and Railway JSON schema
validation. Database schema deployment is explicitly excluded until the user
authorizes it.

## Acceptance Criteria

- `packages/background-worker` exists and executes long news jobs outside
  Next.js.
- `packages/cron` exists and independently enqueues scheduled refresh jobs.
- Both packages coordinate through the durable `background_job` schema.
- Crashed workers can be recovered through an expiring lease.
- Failed jobs retry with backoff and eventually become terminal.
- Refresh and embedding HTTP endpoints no longer perform long work.
- Each Railway service has a direct `railway.json` build/start configuration.
- The cron schedule is defined in `packages/cron/railway.json`.
- The old `RAILWAY_SERVICE_NAME` and remote-bootstrap deployment path is gone.
- No migration file is hand-written and no database update command is run.
