# ADR 0003 — Runtime and interface policy

Status: Accepted for Phase 01, 2026-10-21.

## Decision

Pin Node 24.13.1, pnpm 11.25.0, exact dependency versions, and immutable PostgreSQL/Redis image digests. Commit the frozen lockfile. Keep API and worker runtime configuration server-side and validate it at startup. The browser uses a same-origin `/api/v1` client; Next.js forwards requests to the API. The web shell uses semantic HTML and a small token palette drawn from the approved UI concept, with no fake learning actions.

The Docker build sets `API_INTERNAL_URL=http://api:3001` before Next.js compilation because rewrite destinations are embedded at build time. Turbo explicitly passes `API_INTERNAL_URL` to web build and development tasks; otherwise it filters the value and embeds the localhost fallback. Host builds default to `http://localhost:3001` for a hybrid workflow. This full-workspace image uses standard Next.js output with `next start`. Health routes are `/api/v1/health/live` and `/api/v1/health/ready`. Readiness checks PostgreSQL and Redis. API responses use `{data}` or a safe `{error:{code,message,requestId}}` envelope. Every request receives a new server-generated ID; logs omit bodies, headers, queries, credentials, and connection strings.

## Alternatives and consequences

Publishing the API directly to browser code would complicate origin controls. Floating image tags reduce reproducibility. An always-green readiness probe would mislead operations. The Docker stack exposes only loopback-bound API/Web ports and uses a new project-specific database volume; it does not touch older EKMS volumes.
