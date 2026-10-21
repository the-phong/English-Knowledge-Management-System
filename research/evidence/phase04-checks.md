# Phase 04 verification evidence — 2026-10-21

All commands ran in `/mnt/d/Personal/English-Knowledge-Management-System` on `feature/ekms-p04-vocabulary`. This file contains summaries rather than credentials, tokens, cookies, or private user content.

## Baseline and data safety

- Initial HEAD and approved Phase 03 remote: `e7b269d71349d086933168aa295487e22a8b6dca`; working tree clean before branch creation. Remote `master`: `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`.
- Docker project `ekms-p01-foundation`; owned PostgreSQL service and named volume inspected. Development database `ekms_dev`: one user, two prior migrations. Isolated test database `ekms_p02_test`: zero users, two prior migrations. No unrelated containers or database targets were changed.
- Pre-migration `pg_dump -Fc` backup: `/home/ntp/ekms-backups/EKMS-P04-dev-pre-migration-20261021.dump`, mode 0600, 9,688 bytes, SHA-256 `7e3d6b549b785c81a80927feeac91d95246a7222bc09c835926a35e9a80c8f40`. `pg_restore -l` exit 0. This is a development data backup, not a production backup. An initial backup file on D: inherited broad WSL/NTFS permissions and was moved to this private directory before migration.
- `prisma migrate diff` generated `20261021_p04_vocabulary/migration.sql`; reviewed as new tables/indexes/FKs/checks only. `prisma migrate deploy` exit 0 on test database first, then owned development database. No reset, drop, or volume deletion. Final `prisma migrate status` exit 0 for both: three migrations, schema up to date.
- Post-test counts: development 1 user, 0 vocabulary items, 0 tags; test 0 users, 0 vocabulary items, 0 tags. Temporary browser and benchmark users were deleted; shared fixture lexeme metadata may remain as designed.

## Final commands

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0 | Six workspaces already up to date, pnpm 11.25.0. |
| `pnpm format:check` | 0 | All matched files formatted. A later one-line integration-test helper correction was separately checked with `pnpm exec prettier --write` and focused ESLint. |
| `pnpm lint` | 0 | Repository-wide ESLint, no diagnostics after helper correction. |
| `pnpm typecheck` | 0 | Turbo 7/7 tasks successful. |
| `pnpm test` | 0 | Turbo 10/10 tasks; API unit 12/12, web 13/13, existing config/worker/contracts suites pass. |
| `docker compose run --rm --no-deps -v /mnt/d/Personal/English-Knowledge-Management-System/apps/api/test/integration:/app/apps/api/test/integration:ro -e REDIS_URL=redis://redis:6379/1 -e AUTH_LOGIN_IP_LIMIT=1000 -e AUTH_LOGIN_ACCOUNT_LIMIT=7 -e AUTH_REGISTER_IP_LIMIT=1000 -e AUTH_REFRESH_IP_LIMIT=1000 api sh -lc 'export DATABASE_URL="${DATABASE_URL%/*}/ekms_p02_test?schema=public"; pnpm test:integration'` | 0 | Turbo 8/8; API real HTTP/PostgreSQL tests 6/6, including existing Auth and new Vocabulary. Only test source was mounted read-only to match the final assertion helper. |
| `pnpm build` | 0 | Turbo 5/5 tasks successful; Next.js route `/vocabulary` built. |
| `pnpm db:validate` | 0 | Prisma schema valid. |
| `docker compose config --quiet` | 0 | Valid Compose configuration. |
| `docker compose build api` | 0 | Corrected five-package application image built, exported, and unpacked. Final manifest list `sha256:ca65a3d1ea65b7f6eaf7f330a64e89a8ed201b2cdb8268b7c9905b0160e80e81`. |
| `docker compose up -d --no-deps --no-build api` | 0 | Only owned API container recreated; healthy after startup. |
| `NODE_PATH=/tmp/ekms-p03-browser/node_modules node research/evidence/phase04-browser-smoke.cjs` | 0 | Chromium full workflow, 15 layout checks across 375/390/768/1280/1440px, nine axe A/AA scans with zero reported violations, zero page errors, both test users removed. |
| `node research/evidence/phase04-benchmark.cjs` | 0 | 25 sequential local requests per operation; temporary user removed. Results below. |
| `git diff --check` | 0 | No whitespace errors in tracked diff; staged diff checked again before commit. |

Initial focused integration failed with HTTP 500 for creating an item with an owned tag. Adding that missing test exposed an invalid nested join creation. The implementation now creates the item and its join rows inside the same serializable transaction, then reads the complete item. The affected real PostgreSQL suite passed afterward. An earlier root lint run failed on the dynamic test-helper syntax; that helper was corrected, focused lint and repository lint passed. The initial browser run found two test-selector mistakes after tag creation and archive filter change; the final browser run passed. No failed check is represented as passed without rerun.

## Runtime and benchmark

- Final Compose: PostgreSQL, Redis, and API healthy; worker and web running. `GET /` 200, `/auth` 200, `/account` 200, direct `/api/v1/health/live` 200, direct readiness 200, proxied readiness 200. Latest API logs, worker logs, and web logs inspected with no startup exception or connection error in the final window.
- Browser script verifies same-origin registration/login, keyboard Enter activation of Quick Add, manual add without context, tag create/assign/filter, edit, search, exact duplicate returns existing item, distinct second meaning, archive/restore, reload persistence, second-account isolation, logout, and protected-route denial. Screenshots in `phase04-visual/` use random temporary `@example.test` accounts. Desktop empty, populated, Quick Add, detail, edit, archived and mobile Quick Add/detail images were visually inspected; no horizontal overflow or clipped controls observed. The visible skip link in some screenshots reflects keyboard focus during the interaction sequence.
- Local sequential HTTP latency in milliseconds, `n=25` for each operation: Quick Add p50/p95/p99 `14.76/21.9/24.6`; list `6.14/7.49/9.71`; search `5.08/6.55/6.86`; detail `4.46/5.51/6.68`; tag filter `6.59/8.58/9.22`; archive `11.2/12.96/13.9`; restore `10.99/14.52/15.11`. The workload used locally authored synthetic definitions, one temporary account, and the local Compose API. These figures are not a production SLA.
- `EXPLAIN` for the owner/active/created-at list query selected an index scan on the user/sense unique index plus sort in the tiny post-cleanup dataset. The dedicated `(user_id, archived_at, created_at, id)` index is present for the intended list pattern, but this plan does not demonstrate its benefit at scale. Search and tag filter indexes should be reassessed with realistic lawful data before production scale claims.

## Evidence limitations

Automated axe scans and screenshot inspection are not a full WCAG conformance audit. Browser smoke used Chromium; other engines and assistive technology remain unverified. No production dictionary provider, licensing entitlement, IELTS catalog, Learning/Mastery side effect, or production load was tested or claimed.
