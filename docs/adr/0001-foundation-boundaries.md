# ADR 0001 — Foundation boundaries

Status: Accepted for Phase 01, 2026-10-21.

## Decision

Use a TypeScript pnpm monorepo with Next.js for presentation, a versioned NestJS REST API for server authority, and a separate NestJS worker process. Shared packages contain configuration parsing and transport contracts only. Future business modules belong in the API or worker behind explicit module boundaries. Browser components must not access PostgreSQL or decide learning scores.

## Alternatives and consequences

Separate services per business domain would add distributed coordination before the MVP needs it. A single web/server process would couple UI and background processing. The chosen modular monolith keeps deployment simple while preserving replaceable interfaces. The Phase 01 shell has no business endpoints.
