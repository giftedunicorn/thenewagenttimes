# Homepage Performance Repair Design

## Goal

Make the existing homepage responsive without changing its visual design or
reader-facing interaction model. The repair must stop the personalized-feed
request loop, reduce unnecessary server work, and load story images according
to viewport priority.

## Current Failure

The primary personalized query uses the full request body as its React Query
key. That body contains recent exposure memory. After a successful request, the
homepage merges the response's exposure memory into local state, which changes
the request body and query key and starts another request. The newly ranked
stories also trigger more exposure mutations.

A production reproduction generated at least 500 `/api/news/for-you` requests
in roughly 21 seconds. The browser remained unresponsive after a 30-second
navigation timeout.

The server-rendered homepage also requests desk-health aggregates that the
current public homepage does not render, and `force-dynamic` prevents the page
from reusing a recent edition response. Story art is rendered as CSS
backgrounds, so below-the-fold images cannot use native lazy loading.

## Product Boundary

The UI, content order, feed modes, personalization controls, story actions,
responsive layout, and light/dark styling remain unchanged.

This change does not redesign the recommendation algorithm, combine reader
memory APIs, add a database migration, or reorganize the large recommendation
model. Those are separate projects.

## Architecture

### Stable Primary Recommendation Identity

The primary For You query will use the existing stable request key produced by
`getNewsHomeForYouApiNextRequestResetKey`. That key includes inputs that should
cause a new recommendation—profile, feedback, filters, search, objective,
history, collaborative signals, and semantic signals—but deliberately excludes
recent exposure memory.

The query function will continue sending the complete request body, including
the latest exposure memory. Exposure changes alone therefore will not create a
new query. When a meaningful input changes, the new query sends the latest
exposure memory available at that time.

The response can continue updating local exposure memory and the explicit
`nextRequest` used by Load More. Load More remains an intentional network
action and is not tied to the primary query key.

The exposure mutation will retain its existing deduplication and six-item
limit. The component will depend on the stable mutation function rather than
the full mutation result object, preventing mutation status updates from
needlessly retriggering the exposure effect.

### Homepage Data Path

Add a focused `getNewsHomeFeedData` function that loads the published story
candidates and returns `items` plus `status`. `getNewsHomeData` will compose
that feed data with `getNewsDeskStatus` for directory and operational surfaces
that still need health information.

The public homepage will call only `getNewsHomeFeedData`. Its unused
`authConfigured`, `deskStatus`, and `refreshConfigured` props and related
environment reads will be removed.

The homepage will use a 60-second Next.js revalidation interval instead of
`force-dynamic`. Readers can reuse a recent edition response while news remains
fresh within one minute. API personalization remains per-reader and is not
cached as part of the page response.

### Story Image Loading

`StoryImage` will render actual image elements through `next/image` with an
explicit pass-through loader because story sources use arbitrary remote image
hosts. The fixed aspect-ratio wrapper preserves the current layout and prevents
layout shift.

The A1 lead image will be eager/high priority. Editor picks and stream images
will use lazy loading and asynchronous decoding. Descriptive alternative text,
current cropping, borders, fallback art, responsive behavior, and dark-mode
styling remain unchanged.

## Error Handling

- A feed query failure still returns the preview edition and `unavailable`
  status.
- A desk-status failure does not prevent the feed from being returned to
  surfaces that can still render stories.
- A failed personalized request retains the existing initial server-rendered
  stories and React Query error behavior.
- Invalid or missing image URLs continue to use the existing category/source
  fallback art where no URL is available.

## Testing

Implementation follows red-green TDD.

- Add a pure regression test proving recent exposure changes do not change the
  stable primary request key.
- Preserve tests proving profile, feedback, filters, history, and other
  meaningful inputs do change that key.
- Add a homepage integration/source test proving the React Query key uses the
  stable key rather than the complete request body.
- Add data tests for `getNewsHomeFeedData`, including live and unavailable
  results, and preserve `getNewsHomeData` desk-status coverage.
- Add route tests proving the homepage uses feed-only data, exports a
  60-second revalidation interval, and no longer passes unused props.
- Add front-page image tests covering eager lead art, lazy secondary art,
  descriptive alt text, and unchanged fallback rendering.
- Run focused tests during each red-green cycle, followed by the full Next.js
  test suite, typecheck, lint, production build, `git diff --check`, and a
  browser/network regression check.

## Acceptance Criteria

- A new homepage session performs one initial `/api/news/for-you` request.
- Exposure state updates do not trigger another primary personalized request.
- Meaningful reader or filter changes still request a new personalized page.
- Load More continues to request subsequent recommendation pages explicitly.
- The public homepage does not run desk-status aggregate queries.
- Anonymous page HTML is reusable for up to 60 seconds.
- The lead image remains visually identical and prioritized; below-the-fold
  story images are lazy-loaded.
- The existing responsive layout, light/dark modes, content, controls, and
  story actions remain unchanged.
- No database schema or migration changes are required.
