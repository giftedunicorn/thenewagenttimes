# AI News Ingestion And Embedding Pipeline Design

## Goal

Build the first data accumulation pipeline for The New AI Times. The pipeline should seed trusted AI news sources, ingest normalized AI news items from RSS and manual inputs, deduplicate them, record ingestion runs, and prepare embedding vectors for search and ranking.

This phase turns the existing data foundation into a system that can start collecting durable news data. It does not build the public homepage, semantic vector search, large-scale crawlers, or paid/API-specific source integrations.

## Current Context

The previous phase added:

- `NewsSource`, `NewsItem`, `NewsItemVector`, `NewsSignal`, and `IngestionRun` tables in `packages/db/src/schema.ts`.
- Read-only `news.feed`, `news.byId`, and `news.searchCandidates` procedures in `packages/api/src/router/news.ts`.
- Focused Vitest coverage for DB schema and API input contracts.

The repo still has no `.env` file in the workspace. `packages/db/drizzle.config.ts` requires `POSTGRES_URL` for DB push/studio, and repo rules prohibit running DB push, migration, or update commands without explicit permission. This phase should therefore separate implementation from real database execution.

## External API Basis

The embedding provider should be pluggable. OpenAI is the intended first provider, but the pipeline should depend on a small internal interface so tests can use a deterministic fake provider.

Official OpenAI docs describe embeddings as vectors of floating-point numbers for tasks such as search, clustering, recommendations, anomaly detection, and classification. The current API guide shows embedding creation through `client.embeddings.create({ model, input })`, with `text-embedding-3-small` as a documented example model. The implementation should keep provider and model configurable rather than hardcoding a permanent model choice.

Reference: https://platform.openai.com/docs/guides/embeddings

## Scope

Included:

- A new `@acme/ingestion` package for side-effecting ingestion and embedding code.
- Source seed definitions for initial AI news sources.
- RSS ingestion primitives using fetchable XML text and deterministic parsing.
- Manual item normalization for sources not yet integrated by API.
- `dedupeKey` generation from canonical URL, source, and normalized title.
- Category and entity heuristics sufficient for first-pass AI news routing.
- Embedding text construction from title, summary, body fragment, tags, and entities.
- Embedding provider interface plus fake provider for tests.
- OpenAI embedding provider implementation gated by `OPENAI_API_KEY`.
- Repository functions that write `NewsItem`, `IngestionRun`, and `NewsItemVector` using the existing Drizzle schema.
- CLI scripts that can run source seeding, RSS ingestion, and embedding processing when environment variables are present.
- Tests for pure normalization, dedupe, category heuristics, embedding text, and fake-provider vector writes.

Excluded:

- Running `pnpm db:push`, `pnpm -F @acme/db push`, or migration generation.
- Real crawler/browser scraping.
- Product Hunt, Hacker News, YC, GitHub, or social API integrations.
- LLM summarization/classification.
- Actual vector similarity search.
- Public UI changes.
- Cron deployment.

## Architecture

Create a focused package:

- `packages/ingestion/src/sources.ts`: initial source registry seed data.
- `packages/ingestion/src/rss.ts`: RSS/Atom XML parsing into raw feed items.
- `packages/ingestion/src/normalize.ts`: canonical URL cleanup, text cleanup, category heuristics, entity extraction, and `dedupeKey`.
- `packages/ingestion/src/embedding.ts`: embedding text builder, provider interface, fake provider, and OpenAI provider.
- `packages/ingestion/src/repository.ts`: DB write operations using `@acme/db/client` and `@acme/db/schema`.
- `packages/ingestion/src/pipeline.ts`: orchestration for source seeding, feed ingestion, and pending-item embedding.
- `packages/ingestion/src/cli.ts`: small command dispatcher for local/manual runs.
- `packages/ingestion/src/*.test.ts`: Vitest tests for pure behavior and fake-provider flows.

The package should not be imported by the public API or frontend. API routes remain read-only for public consumption. Worker/CLI code owns side effects.

## Data Flow

### Source Seeding

`seedSources` inserts or upserts `NewsSource` rows for the initial source list. The first source list should include vendor blogs and RSS feeds where available:

- OpenAI News / Blog
- Anthropic News / Blog
- Google AI Blog
- DeepMind Blog
- Meta AI Blog
- Microsoft AI Blog
- NVIDIA AI Blog
- Hugging Face Blog
- LangChain Blog
- Product Hunt AI category as a deferred integration source
- Hacker News front page/search as a deferred integration source
- YC companies/news as a deferred integration source

The seed list may include sources whose `feedUrl` is `null` when API integration is deferred. Those sources are still useful for future registry and manual import.

### RSS Ingestion

`ingestRssSource(sourceSlug)`:

1. Loads an active `NewsSource` with a non-null `feedUrl`.
2. Starts an `IngestionRun` with `runType = "rss"` and `status = "running"`.
3. Fetches the feed URL.
4. Parses feed items into raw item objects.
5. Normalizes each item into a `CreateNewsItemSchema` payload.
6. Upserts or skips by `dedupeKey`.
7. Writes run counts and final status.
8. Marks failed runs with `status = "failed"` and `errorMessage`.

The first implementation should support the common RSS/Atom fields: title, link, guid/id, description/summary/content, pubDate/published/updated, author, and enclosure/media image when easily available.

### Manual Ingestion

`normalizeManualItem(input)` creates the same normalized payload as RSS ingestion. This lets operators import Product Hunt launches, YC project announcements, funding news, or social discoveries before dedicated API integrations exist.

### Embedding

`embedPendingNewsItems(limit)`:

1. Loads published news items with `embeddingStatus = "pending"`.
2. Builds embedding input text from stable fields.
3. Computes a content hash.
4. Calls the configured embedding provider.
5. Inserts `NewsItemVector` with provider, model, dimension, hash, vectorRef if any, and embedding array.
6. Updates `NewsItem.embeddingStatus` to `embedded`.
7. On item-level failure, stores `embeddingStatus = "failed"` without failing the whole batch.

The embedding input should be deterministic:

```text
Title: <title>
Summary: <summary>
Category: <category>
Tags: <tag list>
Entities: <entity list>
Body: <body fragment if present>
```

## Classification And Signals

This phase uses deterministic heuristics instead of LLM classification:

- Funding: `funding`, `raises`, `seed`, `series a`, `series b`, `valuation`.
- Product Hunt: `product hunt`, `launch`, known Product Hunt source.
- Model release: `model`, `release`, `benchmark`, `weights`, `api`.
- Agent product: `agent`, `workflow`, `automation`, `browser`, `coding agent`.
- Big tech: source or entity matches OpenAI, Anthropic, Google, Meta, Microsoft, NVIDIA, Amazon, Apple.
- Musk AI: text/entities mention Elon Musk, xAI, Grok, Tesla AI.
- YC AI: source or text mentions YC, Y Combinator, batch names.
- Research: arXiv, paper, benchmark, evaluation, research.
- New concept: `framework`, `protocol`, `paradigm`, `new term`, or glossary-like launch phrasing.

Signals are not a full ranking engine in this phase. The pipeline may create simple `NewsSignal` rows for `source_credibility`, `recency`, `model_release`, `product_launch`, `yc_batch`, `big_tech`, `funding_amount`, or `concept_novelty` when the heuristic is direct and explainable.

## Error Handling

- Feed fetch failures produce failed `IngestionRun` records.
- Individual bad feed items are skipped and counted, not allowed to fail the whole run unless all items fail.
- Invalid normalized payloads fail through existing Zod schemas before DB writes.
- Duplicate items are skipped by `dedupeKey`.
- Embedding provider failures mark only the affected item as failed.
- Missing `OPENAI_API_KEY` should fail only when the OpenAI provider is selected at runtime; tests and pure normalization should not require it.
- Missing `POSTGRES_URL` should prevent live CLI execution but should not prevent pure unit tests.

## Testing And Verification

Use TDD for implementation.

Required tests:

- RSS parser converts a fixture feed into raw items.
- Normalizer creates valid `CreateNewsItemSchema` payloads.
- Dedupe key is stable across tracking-param URL changes.
- Category heuristics cover funding, Product Hunt, model release, agent product, big tech, Musk AI, YC AI, research, and new concept.
- Embedding text builder is deterministic.
- Fake embedding provider returns deterministic vectors and dimensions.
- Embedding repository logic can be tested with injected fake DB/repository boundaries without OpenAI or Postgres.

Required verification:

- `pnpm -F @acme/ingestion test`
- `pnpm -F @acme/ingestion typecheck`
- `pnpm -F @acme/ingestion lint`
- `pnpm -F @acme/ingestion format`
- Existing `@acme/db` and `@acme/api` focused tests continue to pass if touched.

Do not run DB push, migration generation, or live ingestion without explicit permission and working environment variables.

## Acceptance Criteria

- The repo has an ingestion package separate from public API/frontend code.
- The package can normalize RSS and manual source items into existing news schemas.
- The package can seed source definitions.
- The package can compute stable dedupe keys.
- The package can build deterministic embedding inputs and produce vectors through a provider interface.
- OpenAI embedding support is implemented behind configuration and is not required for unit tests.
- CLI entry points exist for future local runs.
- No real database mutation command is executed as part of this phase unless explicitly authorized.
