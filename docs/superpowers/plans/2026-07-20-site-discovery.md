# Site Discovery Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing sitemap, robots, llms.txt, and web app manifest endpoints accurately describe the public site without adding policy pages.

**Architecture:** Preserve the current Next.js metadata-route entry points and their small pure helpers. Tighten the sitemap and robots policies in `news-sitemap.ts`, tighten the public agent index in `news-agent-discovery.ts`, and return an accurate install manifest directly from `manifest.ts`.

**Tech Stack:** Next.js 16 App Router metadata routes, TypeScript, Vitest

---

### Task 1: Lock down sitemap and robots behavior

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-sitemap.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-sitemap.ts`

- [x] **Step 1: Write the failing sitemap and robots expectations**

Remove `/search`, every `/reader` path, and machine-resource URLs from the
expected sitemap entries. Change the robots expectation to:

```ts
rules: {
  allow: "/",
  disallow: ["/api/", "/auth/"],
  userAgent: "*",
}
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs exec vitest run src/app/_components/news-sitemap.test.ts
```

Expected: the sitemap assertion reports the old extra URLs and the robots
assertion reports the old string-only `/api/` policy.

- [x] **Step 3: Implement the minimal sitemap and robots changes**

Delete the static sitemap entries for `/search`, `/reader`,
`/reader/following`, `/reader/library`, `/reader/onboarding`, `/rss.xml`,
`/feed.json`, `/llms.txt`, and `/opensearch.xml`. Preserve the canonical
editorial indexes and all dynamic public content. Change the robots policy to:

```ts
disallow: ["/api/", "/auth/"],
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: the test file passes.

### Task 2: Restrict llms.txt to public discovery surfaces

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-agent-discovery.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-agent-discovery.ts`

- [x] **Step 1: Write the failing llms.txt expectations**

Expect the description to refer to public editorial and discovery surfaces,
expect an Entities link, and assert that `/reader`, `/reader/following`,
`/reader/library`, and `/reader/onboarding` do not appear.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs exec vitest run src/app/_components/news-agent-discovery.test.ts
```

Expected: the new description and Entities assertions fail, and the excluded
reader URLs are still present.

- [x] **Step 3: Implement the minimal llms.txt changes**

Update the summary, keep the public core surfaces and machine feeds, add:

```ts
`- [Entities](${url("/entities")}): Browse people, companies, models, and products covered in AI news.`,
```

Delete the Reader Personalization section.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: the test file passes.

### Task 3: Make the install manifest accurate

**Files:**

- Create: `apps/nextjs/src/app/manifest.test.ts`
- Modify: `apps/nextjs/src/app/manifest.ts`

- [x] **Step 1: Write the failing manifest test**

Import the default manifest function and assert that its result includes:

```ts
{
  id: "/",
  lang: "en",
  scope: "/",
}
```

Also assert that `icons` contains only the existing SVG with
`purpose: "any"`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm -F @acme/nextjs exec vitest run src/app/manifest.test.ts
```

Expected: `id`, `lang`, and `scope` are missing and the duplicate maskable icon
is present.

- [x] **Step 3: Implement the minimal manifest changes**

Add `id: "/"`, `lang: "en"`, and `scope: "/"`. Remove only the icon object
whose purpose is `maskable`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: the test file passes.

### Task 4: Verify the complete Next.js application

**Files:**

- Verify all files changed in Tasks 1–3
- Verify: `docs/superpowers/specs/2026-07-20-site-discovery-design.md`
- Verify: `docs/superpowers/plans/2026-07-20-site-discovery.md`

- [x] **Step 1: Run focused regression tests**

```bash
pnpm -F @acme/nextjs exec vitest run \
  src/app/_components/news-sitemap.test.ts \
  src/app/_components/news-agent-discovery.test.ts \
  src/app/manifest.test.ts \
  src/railway-config.test.ts
```

Expected: all focused tests pass.

- [x] **Step 2: Run formatting, type checking, and lint**

```bash
pnpm -F @acme/nextjs format
pnpm -F @acme/nextjs typecheck
pnpm -F @acme/nextjs lint
```

Expected: all commands pass with no errors.

- [x] **Step 3: Run the complete Next.js test suite**

```bash
pnpm -F @acme/nextjs test
```

Expected: all tests pass.

- [x] **Step 4: Run the production build**

```bash
pnpm -F @acme/nextjs build
```

Expected: Next.js produces a successful production build including
`/sitemap.xml`, `/robots.txt`, `/llms.txt`, and `/manifest.webmanifest`.

- [x] **Step 5: Review the exact diff and worktree state**

```bash
git diff --check
git status --short
git diff -- \
  apps/nextjs/src/app/_components/news-sitemap.ts \
  apps/nextjs/src/app/_components/news-sitemap.test.ts \
  apps/nextjs/src/app/_components/news-agent-discovery.ts \
  apps/nextjs/src/app/_components/news-agent-discovery.test.ts \
  apps/nextjs/src/app/manifest.ts \
  apps/nextjs/src/app/manifest.test.ts \
  docs/superpowers/specs/2026-07-20-site-discovery-design.md \
  docs/superpowers/plans/2026-07-20-site-discovery.md
```

Expected: no whitespace errors and only the scoped endpoint, test, and design
documents are modified.
