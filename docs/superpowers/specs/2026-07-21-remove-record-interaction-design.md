# Remove Record Interaction Design

## Decision

Delete the `news.recordInteraction` feature instead of repairing or throttling
it. The application must not send reader actions, article read milestones, or
automatic home-card exposures through a per-item mutation.

## User experience

Existing local interactions remain responsive. Save, Less, read-state, and
similar controls continue updating their existing React state and browser
storage. Explicit profile controls that use `news.updateProfile` remain; they
are not interaction telemetry.

The homepage stops collecting automatic exposure memory. Exposure state must
not participate in the current `For You` request body, query key, ranking, or
pagination feedback loop. Reading history may still be used as recommendation
context because it represents deliberate article activity stored locally.

## Client removal

Remove every `trpc.news.recordInteraction` mutation from the homepage, edition
story actions, thread pages, and article page. Delete the homepage exposure
effect, its storage hydration/subscription, API exposure feedback application,
and the now-unused exposure-record selector.

No replacement analytics endpoint, retry, debounce, batching layer, or hidden
background request is introduced.

## Server removal

Remove the `recordInteraction` tRPC procedure and its public input schema.
Delete helpers used only for creating, deduplicating, or reconciling new
interaction writes. Keep the interaction database schema and historical read
paths because schema migrations are out of scope and existing saved/history
cleanup surfaces still read historical rows.

## Verification

Regression tests must prove that the client and API router no longer reference
`recordInteraction`, that homepage exposure state no longer feeds the current
recommendation request, and that local interaction code remains present. Run
focused tests first, then formatting, type checking, linting, complete Next.js
and API tests, and a production Next.js build.
