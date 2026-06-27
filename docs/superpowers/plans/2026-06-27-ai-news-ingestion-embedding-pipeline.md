# AI News Ingestion And Embedding Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable ingestion package that can seed AI news sources, parse RSS/Atom feeds, normalize raw items into the existing news schema, compute dedupe keys, build embedding inputs, and run fake/OpenAI embedding providers without running DB migrations or live ingestion.

**Architecture:** Create `packages/ingestion` as a side-effecting worker/CLI package that depends on `@acme/db` but is not imported by the public API or frontend. Keep pure parsing, normalization, and embedding text logic isolated from repository functions so tests do not require Postgres or OpenAI. Live DB writes stay behind explicit CLI commands and repository functions.

**Tech Stack:** TypeScript, Vitest, Drizzle schema types from `@acme/db`, Zod schemas from `@acme/db/schema`, `fast-xml-parser` for RSS/Atom, native `fetch` for optional OpenAI embeddings.

---

## File Structure

- Create `packages/ingestion/package.json`: package metadata, scripts, dependencies.
- Create `packages/ingestion/tsconfig.json`: compiled package TypeScript config.
- Create `packages/ingestion/eslint.config.ts`: base lint config.
- Create `packages/ingestion/src/index.ts`: public exports.
- Create `packages/ingestion/src/types.ts`: shared raw item and repository interfaces.
- Create `packages/ingestion/src/sources.ts`: initial source seed list.
- Create `packages/ingestion/src/rss.ts`: RSS/Atom parser.
- Create `packages/ingestion/src/normalize.ts`: URL cleanup, category/entity heuristics, dedupe key generation.
- Create `packages/ingestion/src/embedding.ts`: embedding text builder, fake provider, OpenAI provider.
- Create `packages/ingestion/src/repository.ts`: Drizzle-backed repository implementation.
- Create `packages/ingestion/src/pipeline.ts`: orchestration functions.
- Create `packages/ingestion/src/cli.ts`: command dispatcher.
- Create focused tests beside implementation files.

## Task 1: Scaffold Package

**Files:**

- Create: `packages/ingestion/package.json`
- Create: `packages/ingestion/tsconfig.json`
- Create: `packages/ingestion/eslint.config.ts`
- Create: `packages/ingestion/src/index.ts`

- [ ] **Step 1: Create package metadata**

Create `packages/ingestion/package.json`:

```json
{
  "name": "@acme/ingestion",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint --flag unstable_native_nodejs_ts_config",
    "seed:sources": "tsx src/cli.ts seed:sources",
    "ingest:rss": "tsx src/cli.ts ingest:rss",
    "embed:pending": "tsx src/cli.ts embed:pending",
    "test": "vitest run",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "@acme/db": "workspace:*",
    "fast-xml-parser": "^5.9.3"
  },
  "devDependencies": {
    "@acme/eslint-config": "workspace:*",
    "@acme/prettier-config": "workspace:*",
    "@acme/tsconfig": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "tsx": "^4.21.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "prettier": "@acme/prettier-config"
}
```

- [ ] **Step 2: Create TypeScript and ESLint config**

Create `packages/ingestion/tsconfig.json`:

```json
{
  "extends": "@acme/tsconfig/compiled-package.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/ingestion/eslint.config.ts`:

```ts
import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: [],
  },
  baseConfig,
);
```

- [ ] **Step 3: Create initial export file**

Create `packages/ingestion/src/index.ts`:

```ts
export * from "./embedding";
export * from "./normalize";
export * from "./pipeline";
export * from "./rss";
export * from "./sources";
export * from "./types";
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
pnpm install
```

Expected: exits 0 and updates `pnpm-lock.yaml`.

## Task 2: Source Registry

**Files:**

- Create: `packages/ingestion/src/sources.test.ts`
- Create: `packages/ingestion/src/sources.ts`

- [ ] **Step 1: Write failing source registry tests**

Create `packages/ingestion/src/sources.test.ts` with tests asserting the initial source list includes active RSS-capable vendor sources and deferred Product Hunt/HN/YC sources.

Run:

```bash
pnpm -F @acme/ingestion test -- src/sources.test.ts
```

Expected: FAIL because `sources.ts` does not exist.

- [ ] **Step 2: Implement source definitions**

Create `packages/ingestion/src/sources.ts` with `initialNewsSources`, using `CreateNewsSourceSchema` to validate each source. Include OpenAI, Anthropic, Google AI, DeepMind, Meta AI, Microsoft AI, NVIDIA AI, Hugging Face, LangChain, Product Hunt, Hacker News, and YC.

- [ ] **Step 3: Verify source tests**

Run:

```bash
pnpm -F @acme/ingestion test -- src/sources.test.ts
```

Expected: PASS.

## Task 3: RSS Parser

**Files:**

- Create: `packages/ingestion/src/rss.test.ts`
- Create: `packages/ingestion/src/rss.ts`
- Create: `packages/ingestion/src/types.ts`

- [ ] **Step 1: Write failing parser tests**

Create tests for one RSS fixture and one Atom fixture. Assert title, link, published date, summary, author, guid/id, and image extraction.

Run:

```bash
pnpm -F @acme/ingestion test -- src/rss.test.ts
```

Expected: FAIL because parser exports do not exist.

- [ ] **Step 2: Implement parser**

Create `types.ts` with `RawFeedItem`, `ManualNewsInput`, `NewsRepository`, and embedding provider interfaces. Create `rss.ts` using `XMLParser` from `fast-xml-parser` and export `parseFeedXml(xml: string): RawFeedItem[]`.

- [ ] **Step 3: Verify parser tests**

Run:

```bash
pnpm -F @acme/ingestion test -- src/rss.test.ts
```

Expected: PASS.

## Task 4: Normalization And Dedupe

**Files:**

- Create: `packages/ingestion/src/normalize.test.ts`
- Create: `packages/ingestion/src/normalize.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover URL tracking-param cleanup, stable dedupe keys, category heuristics, entity extraction, and `CreateNewsItemSchema` compatibility.

Run:

```bash
pnpm -F @acme/ingestion test -- src/normalize.test.ts
```

Expected: FAIL because normalizer exports do not exist.

- [ ] **Step 2: Implement normalizer**

Create `normalize.ts` exporting `canonicalizeUrl`, `buildDedupeKey`, `inferNewsCategory`, `extractEntities`, `normalizeFeedItem`, and `normalizeManualItem`. Use deterministic string heuristics only.

- [ ] **Step 3: Verify normalization tests**

Run:

```bash
pnpm -F @acme/ingestion test -- src/normalize.test.ts
```

Expected: PASS.

## Task 5: Embedding Providers

**Files:**

- Create: `packages/ingestion/src/embedding.test.ts`
- Create: `packages/ingestion/src/embedding.ts`

- [ ] **Step 1: Write failing embedding tests**

Cover deterministic embedding text, SHA-256 content hash, fake provider vector dimension, and missing API key behavior for the OpenAI provider factory.

Run:

```bash
pnpm -F @acme/ingestion test -- src/embedding.test.ts
```

Expected: FAIL because embedding exports do not exist.

- [ ] **Step 2: Implement embedding utilities**

Create `embedding.ts` exporting `buildEmbeddingInput`, `hashEmbeddingInput`, `createFakeEmbeddingProvider`, and `createOpenAIEmbeddingProvider`. The OpenAI provider should call `https://api.openai.com/v1/embeddings` with `{ model, input }` only when configured.

- [ ] **Step 3: Verify embedding tests**

Run:

```bash
pnpm -F @acme/ingestion test -- src/embedding.test.ts
```

Expected: PASS.

## Task 6: Repository, Pipeline, And CLI

**Files:**

- Create: `packages/ingestion/src/pipeline.test.ts`
- Create: `packages/ingestion/src/repository.ts`
- Create: `packages/ingestion/src/pipeline.ts`
- Create: `packages/ingestion/src/cli.ts`

- [ ] **Step 1: Write failing pipeline tests**

Use fake repository and fake embedding provider. Assert source seeding calls, RSS item normalization, duplicate counting, and pending embedding item status transitions.

Run:

```bash
pnpm -F @acme/ingestion test -- src/pipeline.test.ts
```

Expected: FAIL because pipeline exports do not exist.

- [ ] **Step 2: Implement repository interfaces and Drizzle repository**

Create `repository.ts` with a `createDbNewsRepository()` function that uses `@acme/db/client` and schema tables. Keep live DB calls behind this factory.

- [ ] **Step 3: Implement pipeline orchestration**

Create `pipeline.ts` exporting `seedSources`, `ingestRssSource`, and `embedPendingNewsItems`.

- [ ] **Step 4: Implement CLI command dispatcher**

Create `cli.ts` supporting `seed:sources`, `ingest:rss <sourceSlug>`, and `embed:pending [limit]`. Fail with clear messages when required arguments or environment variables are missing.

- [ ] **Step 5: Verify pipeline tests**

Run:

```bash
pnpm -F @acme/ingestion test -- src/pipeline.test.ts
```

Expected: PASS.

## Task 7: Full Verification

**Files:**

- Inspect all changed files.

- [ ] **Step 1: Run ingestion checks**

Run:

```bash
pnpm -F @acme/ingestion test
pnpm -F @acme/ingestion typecheck
pnpm -F @acme/ingestion lint
pnpm -F @acme/ingestion format
```

Expected: all exit 0.

- [ ] **Step 2: Run existing focused checks**

Run:

```bash
pnpm -F @acme/db test -- src/schema.test.ts
pnpm -F @acme/api test -- src/router/news.test.ts
```

Expected: both exit 0.

- [ ] **Step 3: Confirm no DB mutation command was run**

Run:

```bash
git status --short
find . -path './node_modules' -prune -o -path './.git' -prune -o \( -path '*drizzle*' -o -path '*migrations*' \) -print | sed -n '1,160p'
```

Expected: no new migration files. Do not run `pnpm db:push`, `pnpm -F @acme/db push`, or live ingestion commands.

## Self-Review Notes

- Spec coverage: source seeding, RSS/manual normalization, dedupe, embedding text/provider interface, OpenAI provider gating, repository boundaries, CLI, and no DB push are covered.
- Completeness scan: every task has concrete files, commands, and expected results.
- Type consistency: `NewsRepository` and `EmbeddingProvider` are introduced before pipeline tasks consume them.
