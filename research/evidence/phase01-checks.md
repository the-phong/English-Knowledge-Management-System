# Phase 01 check summary — 2026-10-21

Commands ran from `/mnt/d/Personal/English-Knowledge-Management-System` unless noted. No secret values are recorded here. The named Compose project is `ekms-p01-foundation`; it created `ekms-p01-foundation_postgres_data` and did not use older EKMS volumes.

| Command | Exit | Observed result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0 | Lockfile current; final local install up to date. |
| `pnpm format:check` | 0 | All matched files formatted. |
| `pnpm lint` | 0 | Source and test lint passed. |
| `pnpm typecheck` | 0 | All five workspace package checks passed. |
| `pnpm test` | 0 | All ten Turbo tasks passed; unit tests passed. |
| `pnpm test:integration` | 0 | Eight Turbo tasks passed; API HTTP integration tests passed (4/4), worker and web checks passed. |
| `pnpm build` | 0 | All five packages built; Next.js generated `/` and `/_not-found`. |
| `pnpm db:validate` | 0 | Empty Phase 01 Prisma schema valid. |
| `pnpm --filter @ekms/api db:generate` | 0 | Prisma Client 6.19.3 generated locally. |
| `docker compose config --quiet` | 0 | Compose configuration valid. |
| `docker compose build` | 0 | Initial full application image built from frozen lockfile. |
| `docker compose up -d --no-build` | 0 | PostgreSQL, Redis, API, worker, and web started in the isolated project. |
| `docker compose exec -T postgres psql ... SELECT current_database(), current_user` | 0 | `ekms_dev|ekms_dev`. |
| `docker compose exec -T redis redis-cli ping` | 0 | `PONG`. |
| `docker compose exec -T api pnpm --filter @ekms/api exec prisma migrate deploy` | 0 | Applied empty `20261021_p01_baseline` to the new database. |
| `docker compose exec -T api pnpm --filter @ekms/api db:status` | 0 | Database schema up to date; only `_prisma_migrations` exists in `public`. |
| `curl -i http://127.0.0.1:3001/api/v1/health/live` | 0 | HTTP 200, `{data:{status:"ok"}}`. |
| `curl -i http://127.0.0.1:3001/api/v1/health/ready` | 0 | HTTP 200, `{data:{status:"ready"}}`. |
| `docker compose stop redis` then health requests, then `docker compose start redis` | 0 | With Redis stopped, readiness HTTP 503 and liveness HTTP 200; after restart, readiness HTTP 200. Only this project's Redis container was manipulated. |
| `docker compose logs --tail=18 worker` | 0 | Worker logged `worker_ready` and remained up. It logged connection errors during the controlled outage. No jobs were enqueued. |
| `curl -I http://127.0.0.1:3000/` | 0 | Docker web shell returned HTTP 200. |
| `curl -i http://127.0.0.1:3000/api/v1/health/ready` | 0 | **HTTP 500 on the old web container**; its build-time rewrite incorrectly targeted localhost. The Dockerfile build argument was corrected and the new image built. |
| `docker compose build web` | 0 | Image metadata included `API_INTERNAL_URL=http://api:3001`; the generated rewrite was later found to retain localhost because Turbo filtered the variable. |
| `docker compose up -d --no-build --no-deps --force-recreate web` | 1 | Docker Desktop containerd refused snapshot metadata write: `read-only file system`. The old web container remained running. |
| `docker system df` | 1 | Docker Desktop containerd snapshot returned `input/output error`; the corrected web image cannot be runtime-verified in Compose until Docker storage is repaired. |
| `docker system df --format '{{.Type}} {{.TotalCount}} {{.Size}}'` | 126 | On the continuation check, `/usr/bin/docker` itself returned `Input/output error`; Docker runtime verification remains blocked. |
| `pnpm --filter @ekms/web exec next start --hostname 127.0.0.1 --port 3002` with host curl checks | 0 for requests | Separate host web process returned HTTP 200 for `/` and proxied `/api/v1/health/ready`; process then stopped. This does not prove the corrected Docker container. |

At the end of the interrupted execution, initial worker typecheck mismatch, Prisma root `.env` lookup, CommonJS test lint policy, worker startup Redis connection order, and the Docker build argument had been addressed. Docker Desktop storage was still blocked at that time. No database reset, volume deletion, Docker prune, or production operation was run.

## Phase 01 continuation — Docker recovery and final verification

The Product Owner restored Docker Desktop. Preflight found the original feature branch and base SHA unchanged. `tar -tzf /mnt/d/Personal/EKMS-P01-source-backup.tar.gz >/dev/null` exited 0; all 65 archived source files checked (excluding a generated TypeScript build-info file) matched the working tree byte-for-byte. The archive covers `apps/`, `packages/`, `package.json`, and `compose.yaml`. It does not include Git history or database volumes.

Docker Client/Server 29.4.3 and Compose v5.1.3 were accessible. All five active EKMS containers carried `com.docker.compose.project=ekms-p01-foundation`; unrelated containers were not touched. The project volume remained `ekms-p01-foundation_postgres_data`. Only EKMS web used host port 3000 and only EKMS API used host port 3001.

The first recreated web container used the previously built image but crash-looped: `/app/package.json` contained NUL bytes. Its SHA-256 differed from the host file; the API container's copy matched the host. After stopping only the EKMS web container, `docker compose build --no-cache web` succeeded. The fresh image started, exposing the remaining proxy defect: the generated Next.js rewrite still targeted `localhost:3001` because Turborepo had filtered `API_INTERNAL_URL` from its build task. `turbo.json` now passes that variable to build and development tasks. The final image also removes unused Next.js standalone output, which had produced a startup warning with `next start`. No Docker storage or I/O error recurred during the continuation.

| Command or check | Exit | Observed result |
| --- | ---: | --- |
| `tar -tzf /mnt/d/Personal/EKMS-P01-source-backup.tar.gz >/dev/null` | 0 | Archive readable; expected source paths present. |
| Archived source SHA-256 comparison | 0 | 65 checked source files; zero missing or different before corrective edits. |
| `docker version --format '{{.Client.Version}}|{{.Server.Version}}'` | 0 | `29.4.3|29.4.3`. |
| `docker compose version` | 0 | v5.1.3. |
| `docker system df --format '{{.Type}} {{.TotalCount}} {{.Size}}'` | 0 | Docker storage metadata accessible after recovery. |
| Initial `docker compose up -d --no-build --no-deps --force-recreate web` | 0 | Container recreated; then crash-looped due corrupt prior image. |
| `docker compose build --no-cache web` | 0 | Fresh image built; image corruption cleared. |
| `docker compose build web` after Turbo environment correction | 0 | Image built; generated rewrite targets `http://api:3001`. |
| Final `docker compose build web` and web-only recreation | 0 each | Removed unsupported standalone/start mismatch; clean web startup. |
| `curl http://127.0.0.1:3000/` | 0 | HTTP 200, HTML body, 6260 bytes. |
| `curl http://127.0.0.1:3001/api/v1/health/ready` | 0 | HTTP 200, `{"data":{"status":"ready"}}`. |
| `curl http://127.0.0.1:3000/api/v1/health/ready` | 0 | HTTP 200, same JSON response and API-generated `x-request-id`; no proxy 500. |
| `docker compose ps` and relevant logs | 0 | PostgreSQL, Redis, and API healthy; worker up with `worker_ready`; web up with clean Next.js startup. |
| `docker compose exec -T api pnpm --filter @ekms/api db:status` | 0 | One baseline migration; database schema up to date. No migration rerun. |
| `pnpm install --frozen-lockfile` | 0 | Already up to date. |
| `pnpm format:check` | 0 | Passed after formatting `turbo.json`. |
| `pnpm lint` | 0 | Passed. |
| `pnpm typecheck` | 0 | Seven Turbo tasks successful. |
| `pnpm test` | 0 | Ten Turbo tasks successful. |
| `pnpm test:integration` | 0 | Eight Turbo tasks successful; four API HTTP integration tests passed. |
| `pnpm build` | 0 | Five Turbo build tasks successful. |
| `pnpm db:validate` | 0 | Prisma schema valid. |
| `docker compose config --quiet` | 0 | Compose configuration valid. |
| `git diff --cached --check` | 0 | Staged diff has no whitespace errors; 65 intended Phase 01 files reviewed. |
| Staged secret and size scan | 0 | No private keys/provider tokens, real environment files, generated output, or file over 1 MB; credential-shaped strings belong to local CI/test fixtures and `.env.example`. |

The first formatting check after editing `turbo.json` exited 1. `pnpm exec prettier --write turbo.json` corrected formatting, and the required check then exited 0. The initial fresh-image proxy check returned HTTP 500 and exposed the Turbo environment filtering defect; the final image and HTTP 200 check above supersede that result. No unrelated container, old EKMS volume, or database state was changed.
