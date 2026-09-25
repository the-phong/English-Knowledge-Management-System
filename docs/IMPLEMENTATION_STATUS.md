# EKMS Implementation Status

## Current phase

Phase 1 — Authentication vertical slice (complete)

## Initial audit

Repository was greenfield: only product/technical documentation existed before bootstrap. No source packages, database schema, migrations, environment template, tests or Docker Compose were present. No `AGENTS.md` was found.

## Baseline decisions

- Follow `TECHNICAL_DESIGN.md` Section 27 for MVP decisions.
- Use a pnpm TypeScript monorepo with Next.js web, NestJS API, NestJS worker and shared contracts.
- Use fixture/fake providers for local and CI; real Dictionary/OpenAI credentials are not required for Gate 0.
- Do not commit, push or deploy automatically.

## Changed in Phase 0

- Added root workspace/package/tooling configuration.
- Added local PostgreSQL and Redis Docker Compose services.
- Added `.env.example` without real secrets and local `.env` values.
- Added API/web/worker/contracts package skeletons, Prisma foundation schema, baseline migration SQL and seed.
- Added fail-fast Zod environment validation, exact-origin local CORS and a pinned local configuration contract.
- Added server-generated request IDs, global success/error envelopes and structured JSON logging with sensitive-field/value redaction.
- Added shared Prisma/Redis lifecycle services plus live/readiness checks against both dependencies.
- Added a real TypeScript Jest transform and focused tests for environment validation and log redaction.
- Made `@ekms/contracts` emit consumable JavaScript, declarations and source maps into `dist`.

## Verification

- `pnpm install --frozen-lockfile` — PASS (2026-09-02).
- `pnpm lint` — PASS across 4 workspaces.
- `pnpm typecheck` — PASS across 4 workspaces.
- `pnpm test` — PASS: 9 tests total across API, web, worker and contracts.
- `pnpm build` — PASS across 4 workspaces; contracts now emits `dist` without Turbo output warnings.
- `docker compose ps` — PASS: PostgreSQL 17 and Redis 7 healthy.
- `prisma migrate status` — PASS: 1 migration found and local schema up to date.
- Fresh database migration rehearsal — PASS: `0001_init` applied to temporary empty database and created 15 public tables; temporary database removed afterwards.
- `pnpm --filter @ekms/api prisma:seed` — PASS and remains idempotent with 2 ownership-test users.
- Built API runtime check — PASS: `/api/v1/health/live` and `/api/v1/health/ready` returned HTTP 200; readiness reported database/Redis `ok`.
- Error/request context check — PASS: unknown route returned the documented error envelope and ignored an untrusted client-supplied request ID.

## Blockers / TODO

- No Gate 0 or Gate 1 blocker remains.
- Rate limiting and broader security-header hardening remain intentionally scheduled for Phase 5.

## Phase 1 outcome

Authentication now works end to end through the API and minimal web UI.

### Changed

- Added normalized-email registration, generic-error login and safe `/me` serialization.
- Added 10-minute JWT access tokens containing only `sub`, `sessionId`, `iat`, `exp`, `iss` and `aud`.
- Added 256-bit opaque refresh tokens stored only as HMAC-SHA-256 hashes.
- Added transactional row-locked refresh rotation, family revocation and security-event recording on reuse.
- Added logout, logout-all, active-session list and owner-scoped session revocation.
- Added exact Origin protection for every auth mutation and environment-aware HttpOnly refresh-cookie options.
- Added memory-only web auth, initial refresh loading state, in-tab single-flight refresh and BroadcastChannel coordination.
- Added register/login/session-management UI with responsive and keyboard-visible states.
- Added `0002_phase1_auth` migration for refresh constraints and `security_events`.

### Gate 1 verification

- `pnpm install --frozen-lockfile` — PASS.
- `pnpm lint` — PASS across 4 workspaces.
- `pnpm typecheck` — PASS across 4 workspaces.
- `pnpm test` — PASS: API 13, web 3, contracts 4 and worker 1 unit tests.
- `pnpm test:integration` — PASS: all workspaces; API ran 5 PostgreSQL auth scenarios.
- `pnpm build` — PASS across 4 workspaces.
- Auth integration — PASS: register/login, generic login failure, rotation, reuse-family revoke, security event, logout/logout-all, cookie flags, Origin rejection, `/me`, session list and cross-user 404 isolation.
- Migration rehearsal — PASS: `0001_init` and `0002_phase1_auth` applied to an empty temporary database; 16 public tables including `security_events`; temporary database removed.

### Acceptance gate

- [x] Register/login/refresh/logout/logout-all run through API and minimal web.
- [x] Rotation, reuse detection, cookie flags, Origin rejection and cross-user isolation are tested.
- [x] Access/refresh tokens and password hashes are absent from public user DTOs and sensitive logs are redacted.

## Next exact task

Begin Phase 2 with the vocabulary vertical slice: deterministic dictionary fixture, manual fallback, owner-scoped CRUD/archive/restore/tags, cursor pagination and web states.
