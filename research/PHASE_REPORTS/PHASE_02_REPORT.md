# EKMS — PHASE 02 AUTHENTICATION IMPLEMENTATION REPORT

## 1. Executive Summary

**Phase 02 execution status: PASS; eligible for Product Owner and Project Controller review.** Phase 02 implements multi-user authentication, server-authoritative sessions, refresh rotation and replay detection, an authentication UI, a reviewed additive migration, and security tests. The earlier Docker Desktop image-export failure did not recur after disk space was restored. The corrected combined integration suite, latest-image build, live proxy smoke, and real Chromium browser flow passed. The verified implementation commit was pushed only to the approved feature branch. Final acceptance remains the Product Owner's and Project Controller's decision. No Phase 03 work was started.

## 2. Git Baseline

| Item                            | Evidence                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| Repository                      | `/mnt/d/Personal/English-Knowledge-Management-System`           |
| Phase 01 parent                 | `638b55409a2238ae9a28401e93e00795342a0227`                      |
| Branch                          | `feature/ekms-p02-auth`, based on the exact Phase 01 commit     |
| Initial continuation tree       | Expected Phase 02 modified and untracked source; HEAD at parent |
| Remote Phase 01                 | Matched the parent commit                                       |
| Protected `master` baseline     | `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`                      |
| Phase 02 remote before delivery | Absent                                                          |

No reset, stash, clean, rebase, merge, or branch rewrite was used.

## 3. Authentication Architecture

`apps/api/src/auth` owns registration, login, sessions, Origin protection, rate limiting, JWTs, and guards. `InfrastructureModule` provides Prisma and Redis. `@ekms/config` validates security settings; `@ekms/contracts` provides public response shapes. PostgreSQL is the authority for user and session state. Registration creates an account without signing it in; login creates a session and returns an access JWT plus a scoped HttpOnly refresh cookie. Each protected request validates the JWT and current database session state. The web client sends same-origin `/api/v1` requests through Next.js, keeps access JWTs only in memory, and restores state using refresh and `/me`. UI components do not grant backend authorization.

## 4. Database and Migrations

`User` contains a UUID ID, unique normalized email, Argon2id password hash, timezone, JSON preferences, and timestamps. `RefreshSession` contains the user foreign key, unique token hash, family ID, expiry, consumed/revoked timestamps, and replacement ID. `SecurityEvent` records event type and privacy-conscious user/family/session references. Indexes support lookup and revocation. The SQL checks normalized email and session lifetime.

The additive, reviewed migration is `apps/api/prisma/migrations/20261021_p02_auth/migration.sql`. It preserves the Phase 01 migration and drops no existing objects. The owned Compose PostgreSQL volume contains development database `ekms_dev`; isolated integration database `ekms_p02_test` is in the same owned server. Prisma migration status for both databases exited 0 and reported Phase 01 and Phase 02 migrations up to date. No reset, schema push, data deletion, or volume removal was performed. A fresh source backup was created before the Docker rebuild; it does not include database volumes.

## 5. API Contract

All routes use `/api/v1`, successful responses use `{ "data": ... }`, and errors use `{ "error": { "code", "message", "requestId" } }`.

| Method and route            | Request                                | Success                                 | Authority and notable errors                                 |
| --------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `POST /auth/register`       | email, password                        | 201 safe user                           | Exact Origin; 400 validation, 409 duplicate, 429 limit       |
| `POST /auth/login`          | email, password                        | 201 user and access JWT, refresh cookie | Exact Origin; generic 401, 429 limit                         |
| `POST /auth/refresh`        | refresh cookie                         | 201 rotated JWT and cookie              | Exact Origin; 401 invalid/revoked/reused, 429 limit          |
| `POST /auth/logout`         | refresh cookie and/or valid access JWT | 201, cookie cleared                     | Exact Origin; expired access JWT supported with valid cookie |
| `POST /auth/logout-all`     | access JWT                             | 201, all owned sessions revoked         | Exact Origin and active server session                       |
| `GET /auth/sessions`        | access JWT                             | 200 safe session list                   | Active server session; no token hash                         |
| `DELETE /auth/sessions/:id` | owned UUID and access JWT              | 200 revocation                          | Exact Origin; another user's ID returns 404                  |
| `GET /me`                   | access JWT                             | 200 safe current user                   | Active server session; 401 otherwise                         |

## 6. Security Implementation

- Email is trimmed and lowercased for lookup. Passwords are not trimmed; length is 8–128. Argon2id uses 19 MiB, two iterations, one lane. A database unique constraint resolves concurrent registration.
- Access JWTs use HS256 with a separately validated signing key, `sub`, `sessionId`, `iat`, `exp`, `iss`, and `aud`; lifetime is 10 minutes. Strict validation rejects malformed, tampered, expired, and wrong-claim tokens. Protected requests also check the database session.
- Opaque refresh tokens contain 256 random bits and expire after 30 days. PostgreSQL stores only HMAC-SHA-256 digests with a separate server pepper. The `ekms_refresh` cookie is HttpOnly, SameSite=Lax, scoped to `/api/v1/auth`, and Secure in production. Production config rejects insecure cookies and HTTP allowed origins.
- Rotation locks the user and token rows in a transaction. Reuse revokes the entire family and atomically records security events. Historical consumed rows remain to detect replay. Logout, logout-all, and selected-session revocation persist in PostgreSQL.
- All auth mutations reject missing or unlisted Origins. CORS permits credentials only for exact configured origins. Redis atomic fixed-window limits protect register, login by IP/account, and refresh. HTTP 429 includes `Retry-After`; Redis failure denies the attempt with 503.
- Structured logs and responses omit passwords, raw refresh credentials, token hashes, Authorization and Cookie values, and signing secrets.

The Next.js proxy presents one socket-peer IP to the API. The `.env.example` IP limit of 100 per hour is explicitly for local development; the account login limit remains 5. A multi-user deployment needs reviewed trusted-ingress IP attribution and tuning. Arbitrary `X-Forwarded-For` was not enabled. Browsers without Web Locks may race across tabs; the server then fails closed by family revocation.

## 7. Frontend Implementation

`/auth` provides labeled login and registration forms, input validation, loading/error/success states, and keyboard-accessible controls. `/app` is a minimal authenticated landing area without fake dashboard data. `/account` shows current-user and safe session data and supports selected-session revocation, logout, and logout-all. Responsive styles and focus states are included. The client restores state through refresh and `/me`, withholds protected content while checking, uses single-flight refresh within a tab, Web Locks across supported tabs, and BroadcastChannel for logout propagation. Tokens are not stored in local or session storage.

Seven web tests passed in the combined suite. A real headless Chromium script passed registration, login, protected navigation, reload restoration, account/session access, logout, denial after logout, two-tab Web Locks restoration, and a single-tab restoration with Web Locks unavailable. It verified cookie propagation through the Next.js proxy and HttpOnly/Lax/path attributes. This is local browser smoke, not a production browser compatibility claim.

## 8. Files Changed

| Area          | Files                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| API           | `apps/api/src/auth/*`, `apps/api/src/infrastructure/*`, app wiring, error filter, package manifest                    |
| Schema        | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261021_p02_auth/migration.sql`                         |
| Web           | `apps/web/src/app/{auth,app,account}/*`, `apps/web/src/auth/*`, `apps/web/src/lib/auth-client.ts`, layout/home/styles |
| Shared        | `packages/config/src/index.ts`, `packages/contracts/src/index.ts`, workspace manifests and lockfile                   |
| Runtime/CI    | `Dockerfile`, `compose.yaml`, `.env.example`, `.github/workflows/ci.yml`                                              |
| Tests         | API unit and integration tests, web client/UI tests, browser and proxy smoke scripts                                  |
| Docs/evidence | `README.md`, ADR 0004, this report, `research/evidence/phase02-checks.md`                                             |

The prior logout-cookie test assumed `Max-Age=0`. The corrected assertion checks an empty cookie plus an expired `Expires` date, which is the actual clearing response. The browser smoke was corrected to query the cookie at its scoped auth path.

## 9. Verification Evidence

| Command or check                                                                              |          Exit | Result | Evidence                                                       |
| --------------------------------------------------------------------------------------------- | ------------: | ------ | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                              |             0 | PASS   | Lockfile current                                               |
| `pnpm format:check`                                                                           |             0 | PASS   | Final rerun passed                                             |
| `pnpm lint`                                                                                   |             0 | PASS   | No lint errors                                                 |
| `pnpm typecheck`                                                                              |             0 | PASS   | Seven tasks                                                    |
| `pnpm test`                                                                                   |             0 | PASS   | Ten tasks; API 8, web 7, config 5, contracts 1, worker 1 tests |
| `pnpm test:integration` with isolated Compose test DB, latest-image rerun                     |             0 | PASS   | Eight tasks; API 5 HTTP/PostgreSQL tests, web 7, worker 1      |
| `pnpm build`                                                                                  |             0 | PASS   | Five build tasks                                               |
| `pnpm db:validate`                                                                            |             0 | PASS   | Prisma schema valid                                            |
| Prisma migrate status in dev and test DB                                                      |        0 each | PASS   | Both migrations up to date                                     |
| `docker compose config --quiet`                                                               |             0 | PASS   | Config accepted                                                |
| `docker compose build api`                                                                    |             0 | PASS   | Image export/unpack completed; image ID recorded in checks     |
| Latest-image direct live/ready, web home/proxied ready                                        | HTTP 200 each | PASS   | Owned Compose stack operational                                |
| `node research/evidence/phase02-proxy-smoke.mjs`                                              |             0 | PASS   | Live auth/cookie/Origin/session flow; temporary user removed   |
| `NODE_PATH=/tmp/ekms-p02-browser/node_modules node research/evidence/phase02-browser-e2e.cjs` |             0 | PASS   | Real Chromium auth/reload/logout/multi-tab flow                |
| `git diff --check`                                                                            |             0 | PASS   | Final rerun passed                                             |

Full commands, recovery context, and sanitized outcomes are in `research/evidence/phase02-checks.md`. The latest-image combined suite was rerun directly without a pipeline and exited 0 with all eight tasks successful.

## 10. Security Negative Tests

| Scenario                                                             | Observed result                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Invalid, expired, tampered, wrong issuer/audience, or `alg=none` JWT | Unit and HTTP checks reject with 401 as applicable                                              |
| Refresh replay                                                       | HTTP 401 and token-family revocation; event persisted                                           |
| Concurrent refresh                                                   | One successful rotation and one reuse rejection; family loses access                            |
| Revoked session                                                      | Protected access rejected after revocation/logout                                               |
| Cross-user session                                                   | Another user's session ID returns 404                                                           |
| Malicious or missing Origin                                          | 403; unlisted CORS origin has no allow-origin grant                                             |
| Rate limiting                                                        | 429 with positive `Retry-After`                                                                 |
| Expired/revoked refresh; failed transaction                          | Combined PostgreSQL integration assertions passed                                               |
| Sensitive data leakage                                               | Unit/HTTP response redaction assertions passed; live logs inspected without credential exposure |

## 11. Acceptance Gates A01–A16

| Gate | Status at report-writing time | Evidence / remaining work                                                                             |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| A01  | PASS                          | Exact Phase 01 parent and branch verified                                                             |
| A02  | PASS                          | Additive SQL, constraints, and dev/test migration status verified                                     |
| A03  | PASS                          | Registration and concurrent normalized-email uniqueness HTTP tests                                    |
| A04  | PASS                          | Argon2id and generic invalid-credential tests                                                         |
| A05  | PASS                          | 10-minute strict JWT and negative tests                                                               |
| A06  | PASS                          | 256-bit opaque token, HMAC storage, scoped 30-day cookie tests                                        |
| A07  | PASS                          | Rotation, replay, family revocation, concurrent race, rollback integration suite                      |
| A08  | PASS                          | Logout, logout-all, session list, selected revoke HTTP tests and smoke                                |
| A09  | PASS                          | Ownership 404 and two-user isolation tests                                                            |
| A10  | PASS                          | Origin, CORS, cookie unit/HTTP/browser tests                                                          |
| A11  | PASS                          | 429/Retry-After and security-event persistence                                                        |
| A12  | PASS                          | Seven web tests and real Chromium auth/restoration/protected-navigation smoke                         |
| A13  | PASS                          | Combined integration, current image build/export, migration status, runtime and quality checks        |
| A14  | PASS                          | Phase 01 health, worker, config, and contract tests remain passing                                    |
| A15  | PASS                          | README, ADR, test scripts, sanitized evidence and this report                                         |
| A16  | PASS                          | Implementation commit pushed to the feature branch; remote SHA verified; protected `master` unchanged |

## 12. Risks, Limitations, and Deferred Work

The prior containerd failure may have related to low disk space, but its exact root cause is not proven. The rebuilt image exported successfully after space recovery. PostgreSQL session lookup on each protected request adds load; user-row locks serialize session mutations for a user. Proxy socket-peer IP limits aggregate many users; production deployment requires a defined trusted ingress and reviewed rate-limit policy. Browsers without Web Locks can race in multiple tabs, and server replay protection may require fresh login. Local browser smoke does not establish full browser compatibility or production readiness. Password recovery, MFA, social login, Vocabulary, IELTS, Learning, Writing, Mastery, Dashboard, AI Tutor, and Web3 remain out of scope.

## 13. Git Delivery

Implementation commit `7731eea162f1af657e4df55dd8d501e28081b74d` (`feat(auth): implement secure authentication and sessions`) was pushed with `git push -u origin HEAD:refs/heads/feature/ekms-p02-auth` (exit 0). An independent `git ls-remote` matched that SHA, while remote `master` remained `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`. This report is delivered in a documentation-only follow-up commit; the final feature-branch SHA and clean-tree verification are recorded in the final chat report because a commit cannot contain its own SHA. No merge or deployment occurred.

## 14. Phase 03 Readiness

The foundation now offers multi-user identity, server-authoritative sessions, shared contracts, protected web routing, and account/session UI integration points. These can support a later UI design-system phase after Product Owner and Project Controller acceptance. Phase 03 is not authorized and has not started.

## 15. Mandatory Stop Statement

Phase 02 continuation has stopped. No Phase 03 implementation was started. No direct push or merge to main/master was performed. I am awaiting the Product Owner and Project Controller's review.
