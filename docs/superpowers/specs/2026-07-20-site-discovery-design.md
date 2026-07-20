# Site Discovery Endpoints Design

## Scope

Keep the existing Next.js App Router metadata routes for `/sitemap.xml`,
`/robots.txt`, `/manifest.webmanifest`, and the existing route handler for
`/llms.txt`. Policy pages are explicitly out of scope.

## Sitemap

The sitemap is a search-engine index of canonical, indexable HTML pages. It
contains the home page, briefing, thread/topic/source/entity indexes, their
dynamic detail pages, and news articles.

It does not contain search, reader-personalization pages, authentication
routes, APIs, or machine-readable resources such as RSS, JSON Feed,
OpenSearch, and `llms.txt`. Those resources remain discoverable through
`llms.txt`, page metadata, or their direct URLs.

## Robots

Allow public crawling by default, block `/api/` and `/auth/`, and advertise the
absolute sitemap URL. Page-level `noindex` metadata continues to control
private/personalized reader pages and search.

## llms.txt

Describe the public editorial and discovery surfaces, including entities, plus
the available machine feeds. Do not advertise personalized reader-management
pages. Search remains listed as a useful public tool even though it is not a
canonical sitemap destination.

## Web App Manifest

Keep the current product branding, colors, categories, standalone display, and
root start URL. Add a stable root app ID, root scope, and English language.
Publish the existing SVG only with `purpose: "any"` because it was not designed
and verified as a maskable safe-zone icon.

## Verification

Update focused unit tests first and observe the expected failures. Then make
the smallest implementation changes and run focused tests, Next.js formatting,
type checking, linting, the full Next.js test suite, and a production build.
