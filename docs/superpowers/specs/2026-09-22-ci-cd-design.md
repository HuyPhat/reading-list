# CI for Reading List — Design

**Date:** 2026-09-22
**Status:** Approved for implementation

## Purpose

Add automated CI checks to the Reading List repo, which currently has none (no `.github/` directory, no branch protection, no status checks). This is scoped to CI only — deployment ("CD") is explicitly out of scope for this pass, because the app's SQLite-file-based database doesn't survive on typical serverless hosts, and swapping to a hosted database is a separate, larger piece of work the project isn't taking on right now.

## Scope decisions (from brainstorming)

- **CI only, no deployment.** Confirmed with the human partner: real deployment would require either a persistent-disk host or a database swap (e.g. to Postgres or Turso/libSQL), neither of which is happening as part of this change.
- **Migration validation is included.** The workflow applies the repo's committed Prisma migrations to a fresh SQLite database and runs the seed script, not just `tsc`/`lint`/`build`. This project has already hit several real Prisma-7-on-SQLite surprises during development (the driver-adapter requirement, the `prisma generate` gap that broke a fresh clone), so verifying migrations apply cleanly on every push is worth the small amount of extra CI time — SQLite needs no external service, so this is nearly free to add.
- **The check is required and blocking.** Branch protection on `main` will require this CI job to pass before a pull request can merge. This applies retroactively to the currently-open PR #1 (the add-item-dialog PR) once branch protection is enabled.

## Design

### Workflow file: `.github/workflows/ci.yml`

**Triggers:**
```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

**Job:** a single `ci` job on `ubuntu-latest` (no need to split into parallel jobs — the steps share the same dependency install and the whole thing runs in well under a minute for a project this size).

**Steps, in order:**
1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` pinned to pnpm `12.4.2` (matches the version recorded in this repo's `pnpm-lock.yaml`/`packageManager` expectations)
3. `actions/setup-node@v4` pinned to Node `24.x` (matches local dev, per this repo's own development history), with `cache: 'pnpm'` for automatic pnpm-store caching between runs
4. `pnpm install --frozen-lockfile` — this triggers the `postinstall` script (`prisma generate`) automatically, exactly as it does locally and on a fresh clone
5. `pnpm exec prisma migrate deploy` — applies every committed migration under `prisma/migrations/` to a brand-new SQLite file. This is the check that would have caught the fresh-clone gap the final review found in the earlier build, had it existed then.
6. `pnpm exec prisma db seed` — runs `prisma/seed.ts` against that freshly-migrated database, verifying the seed script still matches the current schema
7. `pnpm exec tsc --noEmit` — type-check
8. `pnpm lint` — ESLint
9. `pnpm build` — production build (this is also what would catch a regression of the static-prerender issue the final review found and fixed: if `/` or `/tags` ever lost their `export const dynamic = 'force-dynamic'`, `next build` would either fail or silently start prerendering against build-time data again)

**Environment:** `DATABASE_URL: file:./prisma/dev.db` set directly as a workflow-level `env` value. This is not a secret — it's a relative path to a SQLite file that only exists inside the CI runner's own filesystem for the duration of the job — so no GitHub Actions secret is needed.

### README

Add a CI status badge (`![CI](https://github.com/HuyPhat/reading-list/actions/workflows/ci.yml/badge.svg)`) near the top of `README.md`, above "Getting Started".

### Branch protection on `main`

Enable "Require status checks to pass before merging" for the `ci` job, via `gh api` (a `PUT` to `repos/HuyPhat/reading-list/branches/main/protection`) or the GitHub web UI if the API call needs the human partner's direct action. This is a repo-settings change, not a code change — the implementation plan should treat it as its own step and verify it actually took effect (e.g. `gh api repos/HuyPhat/reading-list/branches/main/protection` returns the expected required-checks configuration) rather than assuming the API call succeeded.

## Verification

There is no way to fully verify a GitHub Actions workflow without GitHub actually running it — linting the YAML locally (e.g. with `actionlint` if available, or just careful reading) is necessary but not sufficient. The real verification is: open this change as its own pull request (consistent with how this repo has been doing all its work) and confirm in the PR's checks tab that the `ci` job actually runs and passes, showing each of the 9 steps above succeeding. Only after that should branch protection be enabled requiring it, since enabling a required check that has never successfully run would leave every PR (including the already-open PR #1) unable to merge.

## Out of scope for this pass

- Deployment of any kind (Vercel, Fly.io, Railway, or otherwise).
- Swapping SQLite for a hosted database.
- Splitting CI into multiple parallel jobs (not worth the added complexity at this project's size).
- Any check beyond type-check/lint/build/migration-validate (e.g. no automated test suite exists in this project, per its own design spec, so there is nothing to run here).
