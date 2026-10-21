# EKMS — PHASE 01 FOUNDATION BOOTSTRAP REPORT

## 1. Executive Summary

**Technical verification: PASS; feature-branch delivery pending at report freeze.** The TypeScript monorepo, Next.js web shell, NestJS API and worker, PostgreSQL/Redis infrastructure, Prisma baseline, tests, CI, Compose configuration, and documentation are implemented. Docker Desktop recovered; the corrected Compose web container now serves the homepage and successfully proxies the healthy NestJS API. All mandatory quality checks passed after the final source changes. The final chat report will record the commit and remote push needed for F14.

The implementation intentionally excludes Authentication and every business workflow. The previous Docker storage incident and subsequent recovery are preserved in the evidence history.

## 2. Git Baseline

- Repository: `/mnt/d/Personal/English-Knowledge-Management-System`.
- Base branch and SHA: `master`, `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`.
- Implementation branch: `feature/ekms-p01-foundation`, created from a clean base.
- Initial status: `## master...origin/master`, no changes.
- Pre-commit status: implementation files remain on the feature branch at the base SHA. Commit SHA and push confirmation will be recorded in the final chat report. No `master` change.

## 3. Architecture and Monorepo

```text
apps/{web,api,worker}
packages/{config,contracts}
apps/api/prisma/{schema.prisma,migrations/}
docs/adr/
research/{PHASE_REPORTS,evidence}/
.github/workflows/ci.yml
Dockerfile, compose.yaml, package.json, pnpm-workspace.yaml, turbo.json
```

Web is presentation only and calls same-origin `/api/v1`. NestJS API owns HTTP contracts, dependency health, and future authority. A separate NestJS worker connects to BullMQ without processing business jobs. PostgreSQL is durable authority; Redis is queue/cache infrastructure. Shared packages contain environment parsing and transport contracts. ADRs 0001–0003 record boundaries, data/queue policy, and runtime/interface policy.

## 4. Technology Versions

Node.js 24.13.1; pnpm 11.25.0; TypeScript 5.9.3; Turborepo 2.11.10; Next.js 16.4.2; React 19.3.1; NestJS 11.2.7; Prisma 6.19.3; BullMQ 5.81.5; PostgreSQL 17 and Redis 7 images pinned by digest; Docker Engine 29.4.3; Compose 5.1.3. Dependencies are exact-versioned and locked in `pnpm-lock.yaml`.

## 5. Implemented Components

- **Web:** App Router shell, semantic layout, responsive CSS tokens, accessible heading structure, same-origin API client and rewrite. No fake product actions.
- **API:** NestJS module, `/api/v1` prefix, liveness/readiness routes, DTO validation foundation, `{data}` success and safe `{error}` envelopes, server-generated request ID, JSON request logging, graceful shutdown.
- **Worker:** Independent NestJS process with BullMQ worker scaffold and Redis lifecycle. No AI call or job claim.
- **Database:** `pg` connection pool for readiness, Prisma schema/client tooling and an empty baseline migration. No domain model or business table.
- **Redis:** Validated URL, lazy connection, readiness PING, bounded connection attempt and clean shutdown. Worker uses a separate BullMQ-compatible connection.
- **Contracts/config:** Shared response schemas and Zod environment validation.

## 6. Files Changed

Modified: `README.md`. Created: root manifests/configuration, `.env.example`, `.gitignore`, Dockerfile/Compose, `apps/web`, `apps/api`, `apps/worker`, `packages/config`, `packages/contracts`, CI workflow, three ADRs, this report, and evidence summary. Removed: none. Migration: `apps/api/prisma/migrations/20261021_p01_baseline/migration.sql` plus provider lock. Real `.env` is ignored and untracked.

## 7. Database and Migration Status

The target was the newly created, isolated `ekms-p01-foundation_postgres_data` volume and `ekms_dev` database. Before migration, `public` had no tables. The empty baseline migration applied with exit 0 and created only `_prisma_migrations`; `prisma migrate status` then returned exit 0 and “Database schema is up to date.” No reset, seed, or domain migration was run. Phase 02 must add its first reviewed Auth models/migration and generate the corresponding Prisma Client.

## 8. Runtime Verification

The initial Compose project started PostgreSQL and Redis healthy, API healthy, web reachable, and worker with `worker_ready`. PostgreSQL read-only identity query and Redis PING succeeded. API live/ready returned HTTP 200. Stopping only this project's Redis changed API readiness to HTTP 503 while liveness remained 200; readiness recovered to HTTP 200 after Redis restart.

The previous Docker Desktop containerd error was resolved externally. The first recreated web container exposed corruption in the previously built image (`/app/package.json` contained NUL bytes); a single no-cache rebuild cleared that problem. A fresh-image proxy test then exposed Turborepo filtering `API_INTERNAL_URL` from the Next.js build. `turbo.json` now passes the variable, and the generated rewrite points to `http://api:3001`. The unused standalone output setting was removed because this image runs `next start`. The final web container starts cleanly, serves `/` with HTTP 200, and proxies `/api/v1/health/ready` with HTTP 200 and the same JSON body as the direct API route. PostgreSQL, Redis, API, worker, and web remained operational; no Docker storage error recurred.

## 9. Test Evidence

| Command                                                  | Exit code | Result | Evidence                                            |
| -------------------------------------------------------- | --------: | ------ | --------------------------------------------------- |
| `pnpm install --frozen-lockfile`                         |         0 | PASS   | Lockfile current.                                   |
| `pnpm format:check`                                      |         0 | PASS   | All matched files formatted.                        |
| `pnpm lint`                                              |         0 | PASS   | Source/test lint passed.                            |
| `pnpm typecheck`                                         |         0 | PASS   | Workspace typechecks passed.                        |
| `pnpm test`                                              |         0 | PASS   | Ten Turbo tasks passed.                             |
| `pnpm test:integration`                                  |         0 | PASS   | Eight Turbo tasks passed; API HTTP integration 4/4. |
| `pnpm build`                                             |         0 | PASS   | Five workspace builds passed.                       |
| `pnpm db:validate`                                       |         0 | PASS   | Prisma schema valid.                                |
| `pnpm --filter @ekms/api db:generate`                    |         0 | PASS   | Local Prisma Client generated.                      |
| `docker compose config --quiet`                          |         0 | PASS   | Compose config valid.                               |
| `docker compose build web`                               |         0 | PASS   | Corrected image built.                              |
| Final `docker compose build web` and web-only recreation |         0 | PASS   | Fresh image and web container started.              |
| Homepage and proxied readiness HTTP checks               |         0 | PASS   | HTTP 200 for both; proxy returns API JSON.          |

Command detail, earlier failed attempts, backup integrity, and non-sensitive runtime observations are in `research/evidence/phase01-checks.md`. The final quality checks were rerun after the source changes. No Authentication, Vocabulary, or Writing tests were claimed.

## 10. Acceptance Gate F01–F14

| Gate | Status  | Evidence / remaining issue                                                                           |
| ---- | ------- | ---------------------------------------------------------------------------------------------------- |
| F01  | PASS    | Strict TypeScript monorepo, exact manifests and frozen lockfile.                                     |
| F02  | PASS    | pnpm workspace and Turbo build/test/typecheck tasks executed.                                        |
| F03  | PASS    | Next.js built; container and separate host web process served `/` with HTTP 200.                     |
| F04  | PASS    | API built, started, and served HTTP health routes.                                                   |
| F05  | PASS    | Worker built, started independently, logged `worker_ready`, remained up.                             |
| F06  | PASS    | Isolated PostgreSQL healthy and queried; migration applied.                                          |
| F07  | PASS    | Redis PING and outage/recovery behavior verified.                                                    |
| F08  | PASS    | Prisma validate/generate, empty baseline deploy, and status succeeded.                               |
| F09  | PASS    | Live 200; ready 200 healthy, 503 during controlled Redis outage, 200 after recovery.                 |
| F10  | PASS    | Format, lint, typecheck, unit/integration tests, and build passed.                                   |
| F11  | PASS    | Final Docker web container runs; homepage and proxied API readiness return HTTP 200.                 |
| F12  | PASS    | No business workflows, provider calls, real secret commits, or unauthorized operations.              |
| F13  | PASS    | README, ADRs, CI, report, and evidence summary exist.                                                |
| F14  | PARTIAL | Work remains on the authorized feature branch; commit and push occur after this report is finalized. |

## 11. Security and Safety

Real `.env` is untracked and ignored; `.env.example` contains placeholders. The staged inventory contains 65 intended Phase 01 files, including the lockfile and report, with no generated outputs, large transient files, or real credentials. The only credential-shaped strings are local CI/test fixtures and the documented example placeholder. Database/Redis have no host ports. API/web bind host ports to loopback. The API creates request IDs rather than trusting client IDs; logs omit request bodies, headers, queries, and connection strings. The controlled outage affected only the new project Redis container. Continuation operations recreated only the EKMS web container and rebuilt its application image; no older volume, production database, secret, or unrelated container was changed. Git `master` was not updated.

## 12. Technical Decisions / ADRs

ADR 0001 keeps a modular monolith with replaceable Web/API/worker boundaries. ADR 0002 makes PostgreSQL authoritative, Redis ephemeral, and records an empty Prisma baseline instead of fake business tables. ADR 0003 pins runtime and dependency versions, defines health/error/logging conventions, and records the Next.js build-time internal API target. The continuation ensures Turbo passes that build variable and uses Next.js output compatible with `next start`. Auth models, queue jobs, dictionary rights, and production deployment remain for later phases.

## 13. Problems, Risks, and Blockers

Resolved in scope: worker type mismatch, Prisma CLI environment lookup, CommonJS lint scope, worker Redis connection-order failure, Turbo environment filtering, and Next.js startup mode. The previous Docker Desktop storage blocker was resolved by the Product Owner; `docker system df` now exits 0. The pre-recovery image had a corrupt package file and was replaced by a clean build. Final Compose verification passed. Remaining risk: the development Dockerfile installs and builds the full workspace, yielding a larger image and slower rebuilds; image optimization is deferred. No immediate Product Owner action is required for technical verification.

## 14. Git Delivery Evidence

Branch: `feature/ekms-p01-foundation` from `master` SHA `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`. At this pre-commit report freeze, commit and push are pending the final staged-file review. The final chat report will contain the commit SHA, push result, remote tracking verification, and final tree status. Direct push or merge to `main`/`master`: none.

## 15. Phase 02 Readiness

API, configuration, request IDs, database connection, migration history, Redis, worker lifecycle, contracts, CI, and the verified web proxy provide a technical base for Authentication. Phase 02 is **not authorized to start** by this report. The first future Auth task should add owned User and refresh-session models and a reviewed migration, followed by scoped NestJS Auth endpoints and negative tests.

## 16. Mandatory Stop Statement

This repository report freezes technical evidence before the Phase 01 feature-branch commit. Final delivery metadata and the mandatory stop statement are supplied in the chat report after push verification. No Phase 02 work was started, and no direct push or merge to `main`/`master` was performed.
