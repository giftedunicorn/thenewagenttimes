# Reader-First Homepage Design

## Goal

Make the homepage behave like an AI-native newspaper: readers should encounter the edition, current stories, and a small set of useful personalization controls before any recommendation-system diagnostics.

The current homepage proves that the underlying aggregation and recommendation system exists, but it renders the full system as one public page. A local runtime audit measured roughly 1.09 MB of initial HTML, 734 buttons, and dozens of recommendation, training, queue, experiment, and audit panels. That is too much for a front page and obscures the news.

## Product Boundary

The product will use three reader-facing surfaces with distinct responsibilities.

### Front Page (`/`)

The front page is the daily edition. It keeps:

- Newspaper masthead, primary navigation, edition date, and search.
- A1 lead story and editorial story modules.
- Search trends and the compact For You control strip.
- The channel rail, briefing, topic and source coverage, story clusters, and the ranked story stream.
- A compact For You rail with current profile summary, a small number of recommendations, Saved and Less counts, and a link to Reader Center.
- Story-level Save, Less, source, share, and recommendation-reason actions.

The front page does not render system diagnostics, experiment allocation, training batches, operational queues, or model audit tables.

### Reader Center (`/reader`)

Reader Center is the reader-owned control plane. It keeps:

- Preference profile editing and quick-start interests.
- Recency, novelty, and rotation-objective controls.
- Saved, Less, reading history, search memory, and data export or reset.
- A concise explanation of which signals influence ranking.
- Links to Following, Library, onboarding, and the recommendation lab.

### Recommendation Lab (`/reader/lab`)

The lab is an advanced, noindex transparency surface. It owns:

- Ranking inputs and recommendation traces.
- Diversity, saturation, fatigue, and filter-bubble diagnostics.
- Training batches, profile proposals, cohorts, experiments, and queue simulations.
- Aggregation, distribution, push, newsletter, and edition-quality diagnostics that are useful for inspecting the system but not for reading the news.

The lab is discoverable from Reader Center, not from the primary front-page navigation.

## Architecture

Do not copy the current homepage into a second route. Split by ownership.

- `news-home.tsx` remains the front-page client surface and loses lab-only rendering and calculations.
- `news-reader-center.tsx` remains the profile and memory surface.
- A new `news-recommendation-lab.tsx` client surface owns lab-only models and interactions.
- A new `/reader/lab` server page loads the same news data used by Reader Center and passes it into the lab surface.
- Pure recommendation helpers stay in `news-home-model.ts` initially so behavior does not change during the surface split. Moving helpers into smaller model files is allowed only when required to break an import or ownership cycle.

The first implementation should remove front-page rendering and computation together. Hiding existing markup with CSS, `<details>`, or a client-only toggle is not sufficient because it leaves the initial HTML and computation cost in place.

## Front-Page Content Order

The page order should be stable and editorial:

1. Masthead and navigation.
2. A1 lead story.
3. Search and search trends.
4. For You control strip.
5. Channel rail and briefing.
6. Editorial packages and story clusters.
7. Ranked story stream with Load more.
8. Compact For You rail.
9. Signal board and desk status only when they communicate public edition health rather than internal model state.

No recommendation-lab section appears after the ranked story stream.

## Data Flow

1. `page.tsx` continues to load `getNewsHomeData()` for the front page.
2. `NewsHome` hydrates the local and server reader profile and memory exactly as it does now.
3. Story actions continue to call the existing tRPC mutations and local fallback storage.
4. The compact control strip updates the same profile state and persistence path.
5. `/reader` and `/reader/lab` read the same local visitor identity and server profile rather than creating new persistence.
6. Lab actions that change preferences use the existing update-profile mutation. Read-only diagnostics do not create additional writes.

## Error And Empty States

- The front page still renders a sample edition if live stories are unavailable.
- The compact For You rail remains usable with an empty profile and zero Saved or Less items.
- Reader Center remains the recovery surface when profile persistence fails; local storage stays the fallback.
- Recommendation Lab shows a concise waiting state when there are not enough stories or signals for a diagnostic.
- Removing lab sections from the homepage must not remove story actions, profile persistence, or infinite-feed behavior.

## Responsive, Theme, And Language Requirements

- Front-page multi-column sections collapse to one column below 768px.
- The compact For You rail must not create horizontal overflow on mobile.
- Existing light and dark semantic colors remain available on all three surfaces.
- This repository does not currently include Lingui dependencies or catalog configuration. This refactor follows the existing English-string convention and does not introduce or regenerate an i18n system.
- Buttons continue to use `@acme/ui/button`; inputs continue to use `@acme/ui/input`.

## Testing

Use TDD for each extraction boundary.

- Add a source-level or component test proving the homepage no longer renders lab headings such as `Experiment Allocation`, `Model Training Batch`, and `Recommendation Audit`.
- Add a test proving the homepage still renders `For You Control Strip`, `Channel Rail`, the ranked stream, and Reader Center navigation.
- Add route and component tests proving `/reader/lab` renders the moved diagnostics.
- Preserve existing model-helper tests and interaction tests.
- Run focused tests after each extraction, then Next.js typecheck, lint, production build, and `git diff --check`.
- Runtime acceptance: initial homepage HTML should be materially smaller than the measured 1.09 MB baseline and should contain far fewer than 734 buttons.
- Browser acceptance: desktop, mobile, light mode, and dark mode show no overlap, clipped labels, console errors, or unusable controls.

## Acceptance Criteria

- A reader reaches live stories and the ranked stream without passing internal recommendation diagnostics.
- The homepage still provides visible, useful preference training.
- Reader Center owns preferences and memory.
- Recommendation Lab owns advanced transparency and operational diagnostics.
- Existing reader identity, profile, Save, Less, history, and recommendation APIs remain unchanged.
- Initial homepage HTML and interactive-control counts decrease materially from the audit baseline.
- No database schema or migration changes are required.
