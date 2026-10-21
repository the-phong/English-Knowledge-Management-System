# Phase 02 verification record

Repository: `/mnt/d/Personal/English-Knowledge-Management-System`
Branch: `feature/ekms-p02-auth`
Base commit: `638b55409a2238ae9a28401e93e00795342a0227`
Initial tree: clean. Remote Phase 01 branch matched the base; protected `master` was `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`.

The official EKMS Google Doc was accessible. Chapter 9–11, Chapter 17, UI-A/Settings, and Appendix D v1.4 were reviewed before business implementation.

## Database safety

- Compose project label: `ekms-p01-foundation`; PostgreSQL service `ekms-p01-foundation-postgres-1`; persistent volume `ekms-p01-foundation_postgres_data` has the same project label. Neither PostgreSQL nor Redis publishes a host port.
- Existing development database: `ekms_dev`. Before Phase 02, it contained only the Phase 01 Prisma migration history. The separate `ekms_p02_test` database did not exist and was created in the same owned PostgreSQL service for integration tests.
- Reviewed additive SQL: `apps/api/prisma/migrations/20261021_p02_auth/migration.sql`. It adds `users`, `refresh_sessions`, and `security_events` with unique indexes, ownership foreign keys, timestamp and email checks. It does not drop existing objects. The Phase 01 migration remains unchanged.
- `docker compose run --rm --no-deps api sh -lc 'export DATABASE_URL="${DATABASE_URL%/*}/ekms_p02_test?schema=public"; pnpm --filter @ekms/api exec prisma migrate deploy'` — exit 0; baseline and Phase 02 migrations applied to the isolated test database.
- `docker compose run --rm --no-deps api pnpm --filter @ekms/api exec prisma migrate deploy` — exit 0; only Phase 02 migration applied to `ekms_dev`.
- No migration reset, schema push, volume deletion, or unrelated container operation occurred.

## Corrected verification attempts

- First `docker compose build api` — exit 1: new Prisma models were unavailable during container TypeScript compilation. Dockerfile now generates Prisma Client before `pnpm build`; the second build exited 0 and produced the Phase 02 application image.
- First PostgreSQL HTTP suite — exit 1: the test's repeated Alice sign-ins reached the configured account limit. The test environment now uses a documented seven-attempt account limit, while the test still proves 429 with `Retry-After` on the eighth attempt. The subsequent suite passed.
- First web DOM test attempt — exit 1 due to a test harness missing the browser `self` global. The harness was corrected; the three UI interaction tests then passed.
- The browser automation connector returned `Target closed` when asked to open the auth page. Browser E2E is therefore **NOT RUN**; DOM interaction tests and live proxy HTTP smoke are separate evidence.
- A final `docker compose run --rm --no-deps ... api sh -lc '... pnpm test:integration'` exited 1. Turborepo now passes the isolated test database and Redis variables correctly, but one test asserted `Max-Age=0` on a cleared cookie. Express emitted an empty cookie with `Expires=Thu, 01 Jan 1970 00:00:00 GMT`, which is a valid clearing response. The assertion and proxy smoke were corrected to check the empty value and past expiry. The same combined run canceled one web DOM test file under concurrent container load; the complete web suite passed when run directly in the container (7 passed, 0 failed). The corrected combined suite has not been rerun.
- A subsequent `docker compose build api` compiled the full workspace successfully, then exited 1 during image export: `failed to create temp dir: mkdir /var/lib/desktop-containerd/daemon/tmpmounts/containerd-mount3231608911: input/output error`. Docker operations stopped immediately under the Phase 02 safety policy; no restart or rebuild loop was attempted. This blocks final container integration and runtime verification of the corrected test image.

## Passing checks recorded during implementation

| Command | Exit | Evidence |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile current; supply chain policy verification completed. |
| `pnpm format:check` | 0 | All matched files formatted. |
| `pnpm lint` | 0 | No lint errors after test and source corrections. |
| `pnpm typecheck` | 0 | Seven Turborepo tasks passed before final small JWT claim refinement; final rerun is recorded below. |
| `pnpm db:validate` | 0 | Prisma schema valid. |
| `docker compose config --quiet` | 0 | Compose configuration accepted. |
| `git diff --check` | 0 | No whitespace errors. |
| `pnpm --filter @ekms/api test` | 0 | Seven unit tests passed before final cookie and claim tests; final rerun is recorded below. |
| `pnpm --filter @ekms/config test` | 0 | Five environment tests passed. |
| `pnpm --filter @ekms/web test` | 0 | Four initial web tests passed; later three DOM interaction tests passed individually. |
| `docker compose run --rm --no-deps api sh -lc 'cd apps/web; pnpm exec tsx --test test/*.test.tsx'` | 0 | Seven web tests passed in the container after DOM setup correction. |
| Isolated API HTTP integration suite with Compose API image and `ekms_p02_test` | 0 | Five tests passed: real registration, login, refresh, replay, concurrent rotation, ownership, logout, Origin, CORS, 429, health. Final extended suite rerun is recorded below. |
| `curl` homepage, direct readiness, proxied readiness | 0 | HTTP 200, 200, 200 respectively. |
| `node research/evidence/phase02-proxy-smoke.mjs` | 0 | Through Next.js: register 201, login 201, `/me` 200, refresh 201, replay 401, revoked access 401, malicious Origin 403; temporary user cleaned (`DELETE 1`). |

## Final gates and delivery

Host-only final results after the Docker I/O failure:

| Command | Exit | Result |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile current. |
| `pnpm format:check` | 0 | All matched files formatted after formatting the new Phase 02 report. |
| `pnpm lint` | 0 | No lint errors. |
| `pnpm typecheck` | 0 | Seven tasks succeeded. |
| `pnpm test` | 0 | Ten tasks succeeded; API eight, web seven, config five, contracts one, worker one tests passed. |
| `pnpm build` | 0 | Five tasks succeeded. |
| `pnpm db:validate` | 0 | Prisma schema valid. |
| `docker compose config --quiet` | 0 | Compose file valid. |
| `git diff --check` | 0 | No whitespace errors before final report edit. |

The remote `master` ref remained `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`; no remote Phase 02 branch was present. No Phase 02 commit or push was made because the final Docker-backed verification gate is blocked. Full gate status and recovery steps are in `research/PHASE_REPORTS/PHASE_02_REPORT.md`. No raw access token, refresh token, password, connection string, or signing key is written here.

## P02-FIX-001 recovery and final verification (2026-10-21)

The original Docker image-export failure occurred with low Windows disk space. Free space was restored, and the latest export succeeded. This supports storage pressure as a possible cause; the exact cause of the earlier containerd I/O error remains unproven.

- Preflight: branch `feature/ekms-p02-auth`, HEAD `638b55409a2238ae9a28401e93e00795342a0227`, expected Phase 02 modified and untracked files preserved. Remote Phase 01 branch still matched HEAD; remote `master` remained `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`; remote Phase 02 absent.
- Fresh source backup before Docker rebuild or source changes: `/mnt/d/Personal/EKMS-P02-source-backup-20261021-170735-recovery.tar.gz` (107,950 bytes; SHA-256 `dbc5bee50321998c2348eb8502cfa3e0abbde6375d680467ed383c2b308c5452`). `tar -tzf` exited 0. All 93 archived source members matched `/mnt/d/Personal/EKMS-P02-source-backup-20261021-170735-manifest.txt`, including the Prisma migration, auth source, web client, configuration template, reports, and tests. `.git`, `.env`, dependencies, generated outputs, and caches were excluded. This is not a database backup.
- `docker version`, `docker compose version`, `docker system df`, and `df -h` exited 0. Engine/client 29.4.3; Desktop 4.73.1; Compose v5.1.3; containerd 2.2.3. D: had approximately 207 GiB free. Existing PostgreSQL/Redis and application containers had the `ekms-p01-foundation` Compose label. The persistent `ekms-p01-foundation_postgres_data` volume was preserved. No prune, reset, destructive migration, or unrelated project operation occurred.
- Prisma migration status was checked against both owned `ekms_dev` and `ekms_p02_test`; each had the Phase 01 and Phase 02 migrations applied and was up to date (exit 0). No migration was rerun.
- The corrected `auth.test.cjs` checks cookie clearing by empty `ekms_refresh` value and an expired 1970 `Expires` date. This matches the actual Express header and proves invalidation without relying on a particular `Max-Age` spelling. Combined `pnpm test:integration` against the isolated test database exited 0: all 8 Turborepo tasks succeeded, including 5 API HTTP/PostgreSQL tests, 7 web tests, and the worker test. Coverage includes uniqueness, rotation/replay and concurrency, revocation, Origin, 429, security events, rollback, and health.
- Exact latest-image rerun: `docker compose run --rm --no-deps -e REDIS_URL=redis://redis:6379/1 -e AUTH_LOGIN_IP_LIMIT=100 -e AUTH_LOGIN_ACCOUNT_LIMIT=7 -e AUTH_REGISTER_IP_LIMIT=100 -e AUTH_REFRESH_IP_LIMIT=100 api sh -lc 'export DATABASE_URL="${DATABASE_URL%/*}/ekms_p02_test?schema=public"; pnpm test:integration'` exited 0 directly, with 8/8 tasks, API 5/5 tests, web 7/7 tests, and worker 1/1 test. The latest image and corrected cookie assertion are therefore independently verified without a pipeline wrapper.
- `docker compose build api` exited 0, including image export and unpack. The current API image ID is `sha256:0875148afae3d9a8d2e35090da3f741f4eaac68107c1fb53b5e04ad1515b2cde`. Only this project's API, worker, and web containers were recreated from the latest image; PostgreSQL and Redis were left in place. All five services remained operational. The corrected image's combined integration output reported 8 successful Turborepo tasks, 5 API tests, and 7 web tests. The command wrapper used `tail` without `pipefail`, so the standalone combined run above is the authoritative exit-code evidence.
- Latest-image HTTP checks: direct API liveness 200, direct readiness 200, web homepage 200, proxied readiness 200. `node research/evidence/phase02-proxy-smoke.mjs` exited 0: register 201, login 201, `/me` 200, refresh 201, replay 401, revoked access 401, malicious Origin 403, session list 200, session revocation 200, revoked-session access 401, logout 201, logged-out access 401; temporary user deletion returned 1. Last 50 API/worker/web log lines had no startup, connection, or proxy exception match.
- The browser connector could not launch because Chrome Stable was absent at `/opt/google/chrome/chrome`. An isolated `playwright@1.63.0` test install under `/tmp/ekms-p02-browser` downloaded headless Chromium 153 into the user cache; no project dependency was added. The installer garbage-collected two unused old browser-cache directories. The first browser run exposed a test assumption: a path-scoped cookie is not returned by `context.cookies(origin)`; the script now queries the auth path. `NODE_PATH=/tmp/ekms-p02-browser/node_modules node research/evidence/phase02-browser-e2e.cjs` then exited 0. Real Chromium registered, logged in, reached `/app` and `/account`, restored through a page reload, propagated the HttpOnly/Lax/path-scoped cookie through Next.js, listed sessions, logged out, and denied protected navigation. It also passed two-tab restoration with Web Locks and a single-tab restoration with `navigator.locks` unavailable. Temporary test user deletion returned 1.
- Repeated live proxy/browser smokes initially returned 429 at registration because the Next.js proxy makes browser requests share an API socket-peer IP and the previous local hourly registration IP limit was 5. The local `.env.example` template now uses IP limits of 100 for login, registration, and refresh; the account login limit remains 5. The ignored local `.env` received only these nonsecret numeric settings. No untrusted `X-Forwarded-For` header was enabled. API was recreated with these settings, and live HTTP and Chromium smoke reruns exited 0. This is a local-development correction; production needs a reviewed ingress trust boundary and rate-limit tuning, as ADR 0004 states.

| Final command | Exit | Result |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile current. |
| `pnpm format:check` | 0 | Final rerun passed after documentation edits. |
| `pnpm lint` | 0 | Passed. |
| `pnpm typecheck` | 0 | Seven Turborepo tasks succeeded. |
| `pnpm test` | 0 | Ten tasks succeeded, including API and web suites. |
| `pnpm test:integration` in the isolated Compose test database, including exact latest-image rerun | 0 | Eight tasks succeeded; corrected HTTP assertion passed. |
| `pnpm build` | 0 | Five build tasks succeeded. |
| `pnpm db:validate` | 0 | Prisma schema valid. |
| `docker compose config --quiet` | 0 | Compose config valid. |
| `git diff --check` | 0 | Final rerun passed after documentation edits. |

No tokens, cookies, password hashes, or secret values were captured in this evidence. Implementation commit `7731eea162f1af657e4df55dd8d501e28081b74d` was pushed to `refs/heads/feature/ekms-p02-auth` (exit 0); `git ls-remote` matched it, and remote `master` remained `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`. The final documentation-commit SHA and remote verification are recorded in the chat report.
