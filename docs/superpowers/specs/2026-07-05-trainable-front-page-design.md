# Trainable Front Page Design

## Goal

Make The New AI Times feel immediately trainable. The homepage already has live AI news, For You ranking, saved stories, Less feedback, reader profile persistence, semantic feedback, collaborative signals, and recommendation explanations. This phase moves a compact recommendation control surface near the top of the homepage so a reader can see and steer the For You model before scrolling into the deep recommendation lab sections.

The change should move the product closer to a New York Times style AI front page with a Toutiao-style recommendation loop: editorial structure remains visible, but the reader can actively train the feed from the first screen.

## Current Context

The current homepage is no longer a starter page. Railway serves a live edition with published AI stories, source health, embeddings, For You ranking, Saved, Less guardrails, Reader Memory, recommendation traces, cohorts, and profile tuning tools.

The remaining product gap is placement and clarity. A live browser audit found:

- `For You` appears around 2241px down the page.
- `Preference Controls` appears around 6123px down the page.
- `Reader Memory`, `Saved`, and `Less / Guardrails` appear around 42881px down the page or later.

The recommendation system exists, but the first-time reader does not immediately see that the page can be trained. The next phase should reduce that distance without replacing the existing deep modules.

Relevant existing implementation:

- `apps/nextjs/src/app/_components/news-home.tsx` owns the homepage client experience and already has profile mutation handlers, local fallback storage, server profile sync, Save, Less, undo, and reset logic.
- `apps/nextjs/src/app/_components/news-home-model.ts` owns pure recommendation model helpers and already exposes profile summaries, preference controls, preference starters, tuning plans, reader memory, and ranking explanations.
- `apps/nextjs/src/app/_components/news-home-model.test.ts` has broad test coverage for ranking, profile, memory, feedback, recommendation explanation, and interaction helpers.
- `packages/api/src/router/news.ts` already persists `news.profile`, `news.forYou`, `news.saved`, `news.history`, `news.guardrails`, `news.recordInteraction`, `news.updateProfile`, `news.restoreGuardrail`, `news.removeSaved`, and `news.resetProfile`.

## Scope

Included:

- Add a compact `For You Control Strip` near the top of the homepage, after the search trends area and before the main editorial story modules.
- Surface the current reader profile in a short scan-friendly summary.
- Surface one-click profile training actions such as More Agents, More Models, and More Funding, using the existing preference profile action flow.
- Surface compact counters and jump links or buttons for Saved, Less, and Reset memory.
- Keep the existing deep For You, Preference Controls, Reader Memory, Saved, Less / Guardrails, and audit sections in place.
- Add pure model helper tests before implementation so the control strip has deterministic text, metrics, and actions.
- Verify the top of the live page exposes a trainable recommendation entry point and still renders without browser console errors.

Excluded:

- New database tables or migrations.
- New recommendation algorithms.
- New tRPC procedures.
- Changes to ingestion, embeddings, or Railway config.
- Removing existing deep recommendation lab sections.
- Redesigning the full homepage layout.

## Design

### Placement

The `For You Control Strip` should render directly after Search Trends and before Channel Rail / Today's Briefing. This keeps search and global filters at the top, then immediately tells the reader how the personalized edition can be trained.

The strip should be visually compact and horizontal on desktop, with an explicit single-column mobile fallback. It should not become a large dashboard card. It should feel like an editorial control surface: dense, bordered, and scannable.

### Content

The strip should contain four small zones:

1. **Profile summary**: short copy that says what the For You model is currently using. It should include counts for topics, sources, and entities, plus labels for recency and novelty bias.
2. **One-click training actions**: three buttons built from existing profile action mechanics. Initial actions should prioritize high-value AI categories already in the system: Agents, Models, and Funding. The labels should be concise, for example `More Agents`, `More Models`, and `More Funding`.
3. **Memory counters**: compact indicators for Saved and Less. These use the already computed `savedItems` and `guardrailItems` arrays.
4. **Reset memory**: a compact reset affordance wired to the existing `resetProfile` flow. It must not be visually dominant, but it must be discoverable.

The strip should avoid long explanations. The detailed teaching and audit copy stays in the existing Reader Signal, Preference Controls, Reader Memory, and Recommendation Audit sections.

### Behavior

Training buttons should reuse `applyPreferenceProfileAction`, not create new mutation code. The actions should update local profile state immediately and persist through the existing `shouldPersistNewsReaderProfile` and `updateProfile` flow.

Saved and Less counters should read from the already merged local and server memory arrays. If counts are zero, the strip should still render with a clear empty state such as `0 saved` and `0 less`.

Reset memory should reuse the existing `resetProfile` handler and mutation. The strip should not introduce a separate reset path.

### Model Helper

Add a pure helper in `news-home-model.ts` for the control strip, for example `getNewsForYouControlStrip`. It should accept:

- `profile`
- `savedItems`
- `guardrailItems`
- `rankedItems`
- `formatCategory`

It should return:

- `label`
- `summary`
- `metrics`
- `trainingActions`
- `memoryActions` or count labels

The helper should not mutate state and should be easy to test without rendering React.

### UI Integration

Add a small React section in `news-home.tsx` that uses the helper output and existing handlers:

- Training buttons call `applyPreferenceProfileAction`.
- Reset calls `resetProfile`.
- Saved and Less controls may scroll or link to the existing sections if that is already easy through anchors. If anchors would require broad markup changes, counters alone are acceptable for this phase.

The implementation should keep mobile width stable:

- No button text should wrap on desktop.
- On mobile, buttons can wrap into rows.
- Long profile labels should truncate rather than pushing layout.

## Data Flow

1. Homepage computes `profile`, `savedItems`, `guardrailItems`, and `rankedItems` as it already does.
2. Homepage calls the new pure helper to produce strip content.
3. Reader clicks a training action.
4. Existing `applyPreferenceProfileAction` updates local state, writes local storage, and persists to the server profile when a visitor key is present.
5. Existing feed ranking and server For You query pick up the updated profile through the current code paths.
6. Reader can still use deeper Preference Controls and Reader Memory sections for more detailed tuning.

## Error Handling

- If profile hydration has not finished, the strip should render from the normalized default profile instead of disappearing.
- If no stories are ranked yet, the strip should still show profile counts and disabled or low-impact training actions.
- If server profile persistence fails, existing mutation handling and local fallback behavior should remain the source of truth. The strip should not add a new error path.
- Reset should follow the current reset failure behavior and training update message path.

## Testing And Verification

Use TDD for implementation.

Required tests:

- The pure helper summarizes an empty/default profile with usable fallback text.
- The helper exposes Agents, Models, and Funding training actions when those signals are available.
- The helper reports Saved and Less counts from memory arrays.
- The helper avoids adding already active profile signals as new training impact where existing profile action helpers already treat them as covered.
- A component-level or source-level test confirms the homepage renders the control strip before the existing `Channel Rail` or `For You` deep section markup.

Required verification:

- `pnpm -F @acme/nextjs test -- src/app/_components/news-home-model.test.ts --runInBand`
- `pnpm -F @acme/nextjs typecheck`
- `pnpm -F @acme/nextjs lint`
- `pnpm run deploy:nextjs`
- Browser check of the homepage: `The New AI Times` renders, the new control strip appears near the top, and console errors/warnings are zero.

## Acceptance Criteria

- A reader can see a For You training control near the top of the homepage without scrolling into the recommendation lab.
- The strip exposes current profile state, one-click training, Saved count, Less count, and reset.
- Existing For You ranking, Save, Less, Reader Memory, and server profile persistence continue to work.
- The implementation adds no new persistence layer.
- Mobile layout remains readable and does not occlude story titles or filters.
- The change is committed separately from unrelated work.
