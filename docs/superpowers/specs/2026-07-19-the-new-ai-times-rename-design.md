# The New AI Times Rename Design

## Objective

Standardize the product as The New AI Times with the technical slug
`thenewaitimes` without changing database contracts or unrelated workspace
package names.

## Scope

- Keep every user-facing product name as `The New AI Times`.
- Replace the root package slug with `thenewaitimes`.
- Replace canonical, auth fallback, fixture, and test hosts with
  `thenewaitimes.com` or `thenewaitimes.test`.
- Update current documentation and historical product references so the old
  brand does not remain discoverable in the repository.
- Rename the GitHub repository to `giftedunicorn/thenewaitimes` and update the
  local `origin`.
- Rename the Railway project and Web service to `thenewaitimes`.
- Point all Railway source integrations at the renamed GitHub repository.
- Update Worker and Cron reference variables to
  `${{thenewaitimes.POSTGRES_URL}}`.
- Replace the old Railway-generated Web domain with a `thenewaitimes` domain,
  then verify the production health endpoint.
- Rename the legacy local checkout directory to `thenewaitimes` after all
  active worktrees are removed.

## Non-Goals

- Do not rename `background_job` tables, enums, or job types.
- Do not rename the `@acme/*` workspace scope.
- Do not recreate Railway services, databases, environments, or opaque IDs.
- Do not run database migrations or schema update commands.
- Do not claim `thenewaitimes.com` is live unless the domain is attached and
  DNS verification succeeds.

## Rollout

Repository changes land first so GitHub redirects and Railway can deploy the
same commit after their resources are renamed. Remote resources are renamed by
stable IDs, reference variables are updated, and all three application
services are redeployed from the renamed repository. The old generated Railway
domain is removed only after a new generated domain responds successfully.

## Verification

Run affected Next.js and ingestion tests, root typecheck, root lint, and the
production Next.js build. After remote changes, verify GitHub origin, Railway
project/service/source metadata, service config paths, the new production
health endpoint, and a clean synchronized `main` branch.
