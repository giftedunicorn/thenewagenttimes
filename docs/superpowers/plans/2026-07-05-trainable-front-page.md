# Trainable Front Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact For You Control Strip near the top of the homepage so readers can see and steer the recommendation model before reaching the deep recommendation lab.

**Architecture:** Add one pure model helper in `news-home-model.ts` and render it in `news-home.tsx` immediately before the existing Channel Rail section. Reuse existing `NewsPreferenceProfileTrainingAction`, `applyPreferenceProfileAction`, `savedItems`, `guardrailItems`, and `resetProfile` flows. No API, DB, ingestion, or Railway config changes.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Tailwind utility classes, Vitest, tRPC client hooks already present in the homepage.

---

## File Structure

- Modify `apps/nextjs/src/app/_components/news-home-model.test.ts`: add TDD coverage for `getNewsForYouControlStrip` and a source-order test for homepage placement.
- Modify `apps/nextjs/src/app/_components/news-home-model.ts`: add the pure helper and supporting types/constants near the existing preference control helpers.
- Modify `apps/nextjs/src/app/_components/news-home.tsx`: import the helper, compute the strip model, and render the compact section before Channel Rail.
- No new files are required for implementation.

## Task 1: Pure For You Control Strip Model

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home-model.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home-model.ts`

- [ ] **Step 1: Write the failing model tests**

Add `NewsReaderMemoryItem` to the type import and `getNewsForYouControlStrip` to the value import in `apps/nextjs/src/app/_components/news-home-model.test.ts`.

```ts
import type {
  NewsHomeItem,
  NewsPositiveFeedbackMemoryItem,
  NewsReaderMemoryItem,
} from "./news-home-model";
```

```ts
  getNewsForYouControlStrip,
```

Add this test block after the `createDefaultNewsPreferenceProfile` describe block.

```ts
describe("getNewsForYouControlStrip", () => {
  const rankedLocalItem = {
    ...localItem,
    matchedSignals: ["category"],
    personalizedScore: 120,
  };
  const savedMemoryItem = {
    ...localItem,
    savedAt: "2026-07-01T09:00:00.000Z",
  } satisfies NewsReaderMemoryItem;
  const guardrailMemoryItem = {
    ...localItem,
    hiddenAt: "2026-07-01T09:30:00.000Z",
    id: "guardrail-story",
  } satisfies NewsReaderMemoryItem;

  it("summarizes the default For You profile with compact metrics", () => {
    const strip = getNewsForYouControlStrip({
      formatCategory: (category) =>
        category === "agent_product"
          ? "Agents"
          : category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category,
      guardrailItems: [],
      profile: createDefaultNewsPreferenceProfile(),
      rankedItems: [rankedLocalItem],
      savedItems: [],
    });

    expect(strip.label).toBe("Train For You");
    expect(strip.summary).toBe(
      "For You is using 3 topics, 0 sources, 0 entities, Fresh 1/2, Novel 1/2 across 1 ranked story.",
    );
    expect(strip.metrics).toEqual([
      { label: "Topics", value: "3" },
      { label: "Sources", value: "0" },
      { label: "Entities", value: "0" },
      { label: "Saved", value: "0" },
      { label: "Less", value: "0" },
    ]);
  });

  it("exposes high-value one-click training actions with active state", () => {
    const strip = getNewsForYouControlStrip({
      formatCategory: (category) =>
        category === "agent_product"
          ? "Agents"
          : category === "model_release"
            ? "Models"
            : category === "funding"
              ? "Funding"
              : category,
      guardrailItems: [],
      profile: {
        preferredCategories: ["funding"],
        preferredSources: [],
        preferredEntities: [],
        noveltyBias: 1,
        recencyBias: 1,
      },
      rankedItems: [rankedLocalItem],
      savedItems: [],
    });

    expect(
      strip.trainingActions.map((action) => ({
        active: action.active,
        actionLabel: action.actionLabel,
        label: action.label,
        signal: action.signals[0]?.signal,
      })),
    ).toEqual([
      {
        active: false,
        actionLabel: "More Agents",
        label: "Agents",
        signal: "agent_product",
      },
      {
        active: false,
        actionLabel: "More Models",
        label: "Models",
        signal: "model_release",
      },
      {
        active: true,
        actionLabel: "Following Funding",
        label: "Funding",
        signal: "funding",
      },
    ]);
  });

  it("reports Saved and Less memory counts from merged memory arrays", () => {
    const strip = getNewsForYouControlStrip({
      formatCategory: (category) => category,
      guardrailItems: [guardrailMemoryItem],
      profile: createDefaultNewsPreferenceProfile(),
      rankedItems: [rankedLocalItem],
      savedItems: [savedMemoryItem],
    });

    expect(strip.memory).toEqual([
      { label: "Saved", value: "1 saved" },
      { label: "Less", value: "1 less" },
      { label: "Reset", value: "Reset memory" },
    ]);
  });
});
```

- [ ] **Step 2: Run the model test and verify it fails**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand
```

Expected: FAIL because `getNewsForYouControlStrip` is not exported.

- [ ] **Step 3: Add the minimal helper implementation**

Add this code in `apps/nextjs/src/app/_components/news-home-model.ts` after `getNewsPreferenceControlPanel`.

```ts
type NewsForYouControlStripTrainingAction =
  NewsPreferenceProfileTrainingAction & {
    active: boolean;
  };

const forYouControlStripTopics = [
  {
    actionLabel: "More Agents",
    activeActionLabel: "Following Agents",
    category: "agent_product",
  },
  {
    actionLabel: "More Models",
    activeActionLabel: "Following Models",
    category: "model_release",
  },
  {
    actionLabel: "More Funding",
    activeActionLabel: "Following Funding",
    category: "funding",
  },
] as const;

const formatForYouControlStripBias = (value: number) =>
  `${Math.round(value * 10) / 10}/2`;

const formatForYouControlStripStoryCount = (count: number) =>
  `${count} ranked ${count === 1 ? "story" : "stories"}`;

export const getNewsForYouControlStrip = ({
  formatCategory,
  guardrailItems,
  profile,
  rankedItems,
  savedItems,
}: {
  formatCategory: (category: string) => string;
  guardrailItems: readonly NewsReaderMemoryItem[];
  profile: NewsPreferenceProfile;
  rankedItems: readonly RankedNewsItem<NewsHomeItem>[];
  savedItems: readonly NewsReaderMemoryItem[];
}) => {
  const normalizedProfile = normalizeNewsPreferenceProfile(profile);
  const topicCount = normalizedProfile.preferredCategories.length;
  const sourceCount = normalizedProfile.preferredSources.length;
  const entityCount = normalizedProfile.preferredEntities.length;
  const freshLabel = formatForYouControlStripBias(
    normalizedProfile.recencyBias,
  );
  const novelLabel = formatForYouControlStripBias(
    normalizedProfile.noveltyBias,
  );
  const trainingActions: NewsForYouControlStripTrainingAction[] =
    forYouControlStripTopics.map((topic) => {
      const active = hasPreferenceSignal(
        normalizedProfile.preferredCategories,
        topic.category,
      );
      const label = formatCategory(topic.category);

      return {
        active,
        actionLabel: active ? topic.activeActionLabel : topic.actionLabel,
        effect: "add",
        label,
        signals: [
          {
            kind: "category",
            label,
            signal: topic.category,
          },
        ],
        source: "control",
      };
    });

  return {
    label: "Train For You",
    memory: [
      {
        label: "Saved",
        value: `${savedItems.length} saved`,
      },
      {
        label: "Less",
        value: `${guardrailItems.length} less`,
      },
      {
        label: "Reset",
        value: "Reset memory",
      },
    ],
    metrics: [
      { label: "Topics", value: String(topicCount) },
      { label: "Sources", value: String(sourceCount) },
      { label: "Entities", value: String(entityCount) },
      { label: "Saved", value: String(savedItems.length) },
      { label: "Less", value: String(guardrailItems.length) },
    ],
    summary: `For You is using ${topicCount} ${
      topicCount === 1 ? "topic" : "topics"
    }, ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}, ${entityCount} ${
      entityCount === 1 ? "entity" : "entities"
    }, Fresh ${freshLabel}, Novel ${novelLabel} across ${formatForYouControlStripStoryCount(
      rankedItems.length,
    )}.`,
    trainingActions,
  };
};
```

- [ ] **Step 4: Run the model test and verify it passes**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand
```

Expected: PASS for the new `getNewsForYouControlStrip` tests and the existing file tests.

- [ ] **Step 5: Commit the pure model helper**

Run:

```bash
git add apps/nextjs/src/app/_components/news-home-model.ts apps/nextjs/src/app/_components/news-home-model.test.ts
git commit -m "feat(news): model trainable front page controls"
```

## Task 2: Homepage For You Control Strip UI

**Files:**

- Modify: `apps/nextjs/src/app/_components/news-home-model.test.ts`
- Modify: `apps/nextjs/src/app/_components/news-home.tsx`

- [ ] **Step 1: Write the failing homepage source-order test**

Add this test near the existing source-level homepage tests in `apps/nextjs/src/app/_components/news-home-model.test.ts`.

```ts
describe("NewsHome For You control strip placement", () => {
  it("renders the trainable For You control strip before Channel Rail", async () => {
    const source = await readFile(
      new URL("./news-home.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("getNewsForYouControlStrip({");
    expect(source).toContain("For You Control Strip");
    expect(source).toContain("applyPreferenceProfileAction(action)");
    expect(source).toContain("onClick={resetProfile}");
    expect(source.indexOf("For You Control Strip")).toBeLessThan(
      source.indexOf("Channel Rail"),
    );
  });
});
```

- [ ] **Step 2: Run the homepage source-order test and verify it fails**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand
```

Expected: FAIL because `news-home.tsx` does not yet import or render `getNewsForYouControlStrip`.

- [ ] **Step 3: Import and compute the control strip model**

Add `getNewsForYouControlStrip` to the existing import from `./news-home-model` in `apps/nextjs/src/app/_components/news-home.tsx`.

```ts
  getNewsForYouControlStrip,
```

After the existing `const preferenceControlPanel = getNewsPreferenceControlPanel({ formatCategory: getCategoryLabel, profile });` statement, add:

```ts
const forYouControlStrip = getNewsForYouControlStrip({
  formatCategory: getCategoryLabel,
  guardrailItems,
  profile,
  rankedItems,
  savedItems,
});
```

- [ ] **Step 4: Render the compact strip before Channel Rail**

In `apps/nextjs/src/app/_components/news-home.tsx`, insert this section after the closing `</header>` and before the current Channel Rail section.

```tsx
<section className="border-b border-[#161616]/25 bg-[#fffdf7] dark:border-[#f4f1ea]/25 dark:bg-[#181818]">
  <div className="container grid gap-3 py-4">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className="font-mono text-xs tracking-[0.18em] uppercase">
          For You Control Strip
        </p>
        <h2 className="mt-1 text-xl font-black">{forYouControlStrip.label}</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-[#5b5750] dark:text-[#bbb4aa]">
          {forYouControlStrip.summary}
        </p>
      </div>
      <Button
        className="rounded-none whitespace-nowrap"
        disabled={resetReaderMemory.isPending}
        type="button"
        variant="outline"
        onClick={resetProfile}
      >
        Reset memory
      </Button>
    </div>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {forYouControlStrip.metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-t border-[#161616]/20 pt-2 dark:border-[#f4f1ea]/15"
          >
            <dt className="font-mono text-[10px] tracking-[0.12em] text-[#5b5750] uppercase dark:text-[#bbb4aa]">
              {metric.label}
            </dt>
            <dd className="mt-1 text-lg font-black">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {forYouControlStrip.trainingActions.map((action) => (
          <Button
            key={action.signals.map((signal) => signal.signal).join(":")}
            className="h-9 rounded-none px-3 text-xs whitespace-nowrap"
            disabled={action.active}
            type="button"
            variant={action.active ? "default" : "outline"}
            onClick={() => applyPreferenceProfileAction(action)}
          >
            {action.actionLabel}
          </Button>
        ))}
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Run the homepage source-order test and verify it passes**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand
```

Expected: PASS for the new placement test and all existing `news-home-model` tests.

- [ ] **Step 6: Commit the homepage strip UI**

Run:

```bash
git add apps/nextjs/src/app/_components/news-home.tsx apps/nextjs/src/app/_components/news-home-model.test.ts
git commit -m "feat(news): surface trainable for you controls"
```

## Task 3: Verification, Browser Check, And Push

**Files:**

- Verify: `apps/nextjs/src/app/_components/news-home-model.ts`
- Verify: `apps/nextjs/src/app/_components/news-home.tsx`
- Verify: `apps/nextjs/src/app/_components/news-home-model.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand
```

Expected: exit 0 with the `news-home-model` suite passing.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm -F @acme/nextjs typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm -F @acme/nextjs lint
```

Expected: exit 0. Existing baseline-browser-mapping or Babel deopt warnings may appear, but ESLint must not fail.

- [ ] **Step 4: Run production build path**

Run:

```bash
pnpm run deploy:nextjs
```

Expected: exit 0. Local Node engine warnings are acceptable if the build completes.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 6: Browser-check the local or deployed homepage**

Use the existing Playwright CLI wrapper:

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" close-all
"$PWCLI" open https://thenewagenttimes-production.up.railway.app/
"$PWCLI" console
"$PWCLI" eval "(() => ({ title: document.title, text: document.body.innerText.slice(0, 2200), hasControlStrip: document.body.innerText.includes('For You Control Strip') }))()"
"$PWCLI" close-all
```

Expected before deployment: the current live page may not yet include the strip. Expected after deployment: title is `The New AI Times`, console reports 0 errors and 0 warnings, and `hasControlStrip` is `true`.

- [ ] **Step 7: Push commits**

Run:

```bash
git status --short --branch
git log --oneline -5
git push origin main
```

Expected: local commits push to `origin/main`.

- [ ] **Step 8: Deploy and verify Railway**

Use the Railway workflow already used for this project:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.4 RAILWAY_AGENT_SESSION=railway-skill-20260705-thenewagenttimes npx --yes @railway/cli up --project 41f2f713-fc37-4c22-8be2-2c76dcc86ca6 --environment c1e668e3-2f5c-4918-bf2d-ddbd61420d92 --service 950c9857-42ea-4f61-8f38-77a232621716 --detach -m "add trainable for you control strip"
```

Poll until terminal success:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.4 RAILWAY_AGENT_SESSION=railway-skill-20260705-thenewagenttimes npx --yes @railway/cli deployment list --project 41f2f713-fc37-4c22-8be2-2c76dcc86ca6 --environment c1e668e3-2f5c-4918-bf2d-ddbd61420d92 --service 950c9857-42ea-4f61-8f38-77a232621716 --limit 1 --json
```

Expected: latest deployment reaches `SUCCESS`. Do not report deployment success while status is `BUILDING`, `DEPLOYING`, `QUEUED`, `FAILED`, or `CRASHED`.

- [ ] **Step 9: Browser-check live after deployment**

Run:

```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" close-all
"$PWCLI" open https://thenewagenttimes-production.up.railway.app/
"$PWCLI" console
"$PWCLI" eval "(() => ({ title: document.title, firstText: document.body.innerText.slice(0, 2600), hasControlStrip: document.body.innerText.includes('For You Control Strip'), controlBeforeChannel: document.body.innerText.indexOf('For You Control Strip') < document.body.innerText.indexOf('Channel Rail') }))()"
"$PWCLI" close-all
```

Expected: title is `The New AI Times`, console reports 0 errors and 0 warnings, `hasControlStrip` is `true`, and `controlBeforeChannel` is `true`.

- [ ] **Step 10: Final status check**

Run:

```bash
git status --short --branch
```

Expected: clean tracked worktree on `main...origin/main`. Remove generated `.playwright-cli/` and `output/` artifacts if present before final response.
