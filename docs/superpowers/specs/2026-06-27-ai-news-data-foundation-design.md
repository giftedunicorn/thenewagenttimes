# AI News Data Foundation Design

## Goal

Build the first backend foundation for The News Agent Times: a public AI agent news aggregation platform that can also provide structured trend material to internal incubation projects. This phase defines durable news, source, vector, signal, and ingestion data shapes, plus read-only API contracts that future public pages, crawler jobs, embedding workers, and internal trend tools can share.

## Current Context

The repository is still close to the create-t3-turbo starter. The database package currently exposes a demo `Post` table from `packages/db/src/schema.ts`, the API package exposes `auth` and `post` routers, and the Next.js homepage still renders the starter post example. There is no existing product-specific news model, crawler, vector pipeline, or public news feed.

Repository rules constrain this phase:

- Do not create or hand-edit DB migration files.
- Put schema work in `packages/db/src/schema.ts` unless the repo is intentionally reorganized later.
- Do not run DB push, migration, or update scripts without explicit permission.
- Avoid `any`.
- Use existing tRPC, Drizzle, Zod, and package patterns.
- Public UI changes must use shared UI components, responsive behavior, dark and light mode, and i18n. This phase does not include public UI implementation.

## Scope

This phase creates the shared data and API foundation only. It should make the requested final product more true by establishing how AI news is stored, categorized, ranked, searched later, and reused internally.

Included:

- News source schema.
- News item schema.
- News vector metadata schema.
- News signal schema for trend and ranking inputs.
- Ingestion run schema for crawler and import observability.
- Zod insert/select validation boundaries where the repo already uses them.
- A `news` tRPC router with read-only procedures for feed, detail, and search-candidate access.
- Typecheck and focused router/schema tests or testable pure helpers where practical.

Excluded:

- Real crawler integrations.
- Real embedding API calls.
- Actual vector similarity search.
- DB migration generation or DB push.
- Public homepage redesign.
- Admin moderation UI.
- Internal trend dashboard UI.

## Architecture

The first implementation should keep the foundation small and explicit:

- `packages/db/src/schema.ts` owns the Drizzle tables and exported Zod schemas.
- `packages/api/src/router/news.ts` owns public read-only news queries.
- `packages/api/src/root.ts` registers the `news` router.
- Optional API-local helpers can normalize feed filters and ranking order if keeping those helpers makes the router simpler.

The schema should be designed for later ingestion workers without requiring those workers now. The API should read already-ingested rows. Future crawler and embedding jobs can write to the same tables through separate worker code.

## Data Model

### NewsSource

Represents an upstream place where news can come from, such as a publication, RSS feed, Product Hunt, Hacker News, GitHub releases, YC company pages, vendor blogs, research feeds, or social/news APIs.

Fields:

- `id`: UUID primary key.
- `name`: source display name.
- `slug`: stable unique source key.
- `homepageUrl`: source homepage.
- `feedUrl`: nullable feed or API URL.
- `sourceType`: controlled string for `publication`, `rss`, `product_hunt`, `hacker_news`, `github`, `yc`, `vendor_blog`, `research`, `social`, `manual`, or `other`.
- `credibility`: integer score from 0 to 100, default 50.
- `isActive`: boolean for ingestion eligibility.
- `createdAt`, `updatedAt`: timestamps.

### NewsItem

Represents one canonical news item after source normalization and deduplication.

Fields:

- `id`: UUID primary key.
- `sourceId`: foreign key to `NewsSource`.
- `title`: headline.
- `summary`: concise generated or extracted summary.
- `bodyText`: nullable extracted text or body fragment.
- `canonicalUrl`: canonical public URL.
- `originalUrl`: first observed URL.
- `imageUrl`: nullable image.
- `authorName`: nullable author or publisher attribution.
- `language`: BCP-47 language tag, default `en`.
- `publishedAt`: source publication timestamp.
- `collectedAt`: ingestion timestamp.
- `status`: controlled string for `draft`, `published`, `archived`, `rejected`, or `duplicate`.
- `category`: primary editorial category.
- `tags`: text array for flexible labels.
- `entities`: text array for companies, people, products, models, funds, and projects.
- `dedupeKey`: stable unique fingerprint derived from canonical URL and normalized title/source facts.
- `sourceScore`: numeric credibility/relevance input.
- `trendScore`: numeric score materialized from signals for feed ordering.
- `embeddingStatus`: controlled string for `pending`, `embedded`, `failed`, or `skipped`.
- `createdAt`, `updatedAt`: timestamps.

Primary categories:

- `funding`
- `product_hunt`
- `model_release`
- `new_concept`
- `hot_take`
- `agent_product`
- `big_tech`
- `musk_ai`
- `yc_ai`
- `research`
- `policy`
- `security`
- `open_source`
- `market_map`
- `other`

These categories intentionally cover the user's examples: financing news, Product Hunt launches, model releases, new terms and concept creation, hot news, operational AI facts, big-company news, Musk and AI, YC AI projects, and AI agent product releases.

### NewsItemVector

Represents embedding metadata for a news item. The vector itself may be stored directly as a numeric array when supported by the selected database setup, or referenced through an external vector store later. This phase must preserve the metadata needed for search and ranking without forcing the final vector storage choice.

Fields:

- `id`: UUID primary key.
- `newsItemId`: foreign key to `NewsItem`.
- `provider`: embedding provider, such as `openai`.
- `model`: embedding model name.
- `dimension`: vector dimension.
- `contentHash`: hash of the text used to create the embedding.
- `vectorRef`: nullable external vector-store reference.
- `embedding`: nullable JSON numeric array as a portable starter representation.
- `createdAt`: timestamp.

Rules:

- A news item can have multiple vector rows over time or across models.
- `(newsItemId, provider, model, contentHash)` should be unique.
- `embeddingStatus` on `NewsItem` reflects the current primary embedding state.

### NewsSignal

Represents ranking, trend, and internal opportunity signals attached to a news item.

Fields:

- `id`: UUID primary key.
- `newsItemId`: foreign key to `NewsItem`.
- `signalType`: controlled string for `source_credibility`, `recency`, `social_velocity`, `product_launch`, `funding_amount`, `yc_batch`, `big_tech`, `model_release`, `concept_novelty`, `internal_relevance`, or `manual_boost`.
- `signalValue`: numeric value.
- `metadata`: JSON object for source-specific details.
- `observedAt`: timestamp.

The implementation should not overfit the ranking algorithm in this phase. It should store clean signal inputs so later feed ranking and internal opportunity scoring can evolve.

### IngestionRun

Represents a crawler/import run, even though real crawlers are out of scope for this phase.

Fields:

- `id`: UUID primary key.
- `sourceId`: nullable foreign key to `NewsSource`.
- `runType`: controlled string for `manual_import`, `rss`, `api`, `crawler`, or `backfill`.
- `status`: controlled string for `queued`, `running`, `succeeded`, `failed`, or `partial`.
- `startedAt`: timestamp.
- `finishedAt`: nullable timestamp.
- `itemsSeen`: integer count.
- `itemsCreated`: integer count.
- `itemsUpdated`: integer count.
- `errorMessage`: nullable text.
- `metadata`: JSON object for run context.

## API Design

Add `news` to the tRPC app router.

### `news.feed`

Public query for the public website and future internal surfaces.

Input:

- `category`: optional primary category.
- `tag`: optional tag.
- `sourceSlug`: optional source slug.
- `q`: optional text query for simple candidate filtering before real vector search exists.
- `limit`: optional integer from 1 to 50, default 20.
- `cursor`: optional timestamp or id cursor.

Behavior:

- Return only `published` news.
- Order by `trendScore` descending, then `publishedAt` descending.
- Include source display metadata.
- Keep the output narrow enough for feed cards.

### `news.byId`

Public query for article/detail pages.

Input:

- `id`: news item UUID.

Behavior:

- Return one `published` news item with source, tags, entities, signal summary, and vector metadata presence.
- Return `null` when the item does not exist or is not published.

### `news.searchCandidates`

Public query that provides a bridge toward future vector search.

Input:

- `q`: required text query.
- `category`: optional category.
- `limit`: optional integer from 1 to 25, default 10.

Behavior:

- Use simple title/summary/entity filtering in this phase.
- Return candidate ids, titles, summaries, categories, and current scores.
- Do not claim semantic/vector search until a real vector query path exists.

## Data Flow

The intended future flow is:

1. Source registry stores upstream sources in `NewsSource`.
2. Ingestion worker records an `IngestionRun`.
3. Ingestion worker normalizes raw source data into `NewsItem`.
4. Dedupe uses `dedupeKey` to avoid repeated canonical items.
5. Embedding worker creates or refreshes `NewsItemVector` and updates `NewsItem.embeddingStatus`.
6. Signal worker or ingestion worker writes `NewsSignal` rows.
7. Feed API reads `NewsItem` with source metadata and ranking fields.
8. Internal opportunity tools use the same items, entities, categories, vectors, and signals.

This phase implements the durable read side and storage contracts for steps 1, 3, 5, 6, and 7. It does not implement the workers.

## Error Handling

- Invalid feed/search inputs should fail through Zod validation.
- Detail lookups for missing or unpublished items should return `null`, not throw.
- API procedures should not expose ingestion errors to public users.
- Insert schemas should constrain string lengths where the database has length limits.
- Source and news uniqueness should be expressed in schema constraints where Drizzle supports them cleanly.

## Testing And Verification

Implementation should follow test-first development where tests are practical in the current stack.

Verification for this phase:

- Schema types compile with `pnpm -F @acme/db typecheck`.
- API types compile with `pnpm -F @acme/api typecheck`.
- If test tooling is added, focused tests cover feed filtering, published-only behavior, and search candidate input validation.
- No migration or DB push command is run unless explicitly approved.
- `git status --short` is checked before and after changes to avoid touching unrelated files.

## Acceptance Criteria

- The repo has product-specific AI news data tables instead of relying on the starter `Post` model for news concepts.
- The schema can represent public news aggregation and internal trend-material needs.
- Every news item has a path to vector metadata storage.
- The API exposes read-only news feed, detail, and search-candidate procedures.
- The implementation keeps real crawling, real embedding calls, actual vector similarity search, and public UI work out of this phase.
- Typecheck verification is run for touched packages.
