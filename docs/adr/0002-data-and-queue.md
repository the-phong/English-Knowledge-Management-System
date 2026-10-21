# ADR 0002 — PostgreSQL, Prisma, Redis, and BullMQ

Status: Accepted for Phase 01, 2026-10-21.

## Decision

PostgreSQL is the durable source of truth. Prisma owns future schema migrations and typed domain access. Phase 01 has an empty Prisma schema because no domain model is authorized yet; a `pg` pool performs the read-only connectivity probe. An empty baseline migration establishes Prisma migration history without inventing business tables. Redis is ephemeral infrastructure for cache and BullMQ. The worker connects to an empty foundation queue; no job is enqueued or claimed as completed. Later Writing work must persist submission state in PostgreSQL before enqueueing and reconcile lost jobs.

## Alternatives and consequences

Creating placeholder tables would require misleading migrations. Using Redis for durable learning state would violate the approved authority boundary. The first business phase must add a reviewed domain migration and generated Prisma Client model. The empty baseline migration may be applied only to the isolated EKMS development database after confirming it has no existing tables.
