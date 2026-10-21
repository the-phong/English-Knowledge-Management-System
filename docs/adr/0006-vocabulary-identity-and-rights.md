# ADR 0006 — Vocabulary identity, ownership, and dictionary rights

Status: Accepted for Phase 04. Business authority: EKMS Appendix D v1.4, V3–V6 and TECH-V3–V6; Appendix C v1.3, V1–V2.

## Decision

- A lexeme is a global, normalized English lemma. Normalize with Unicode NFKC, trim, collapse internal whitespace, and lowercase. Keep meaning text separate; do not remove Vietnamese diacritics.
- A vocabulary item is a private, user-owned target sense. `UNIQUE(user_id, sense_key)` applies across active and archived items. `sense_key` for a recognized fixture sense is `provider:<providerId>:<sourceSenseId>`. For a manual sense it is a SHA-256 digest of normalized lemma, part of speech, and normalized exact definition text. This detects deterministic exact duplicates; it does **not** claim semantic equivalence for differently worded meanings or across sources. Such meanings remain separate until a later explicit, reviewed mapping policy exists.
- Shared `DictionarySense` rows contain only content whose rights permit persistence. Manual definitions, context, notes, and tags stay on owner-scoped tables. Composite `(id,user_id)` foreign keys prevent cross-owner tag links at the database layer as well as in services.
- Manual add works with no provider. Missing live provider returns an explicit unavailable result. The small `ekms-original-fixture` is original educational test content, selected only with `provider=fixture` in non-production environments. It is not a Cambridge/Oxford response or the Phase 05 IELTS catalog.
- Rights metadata explicitly records display, persistent storage, cache, AI processing, quiz reuse, and attribution permissions. Unspecified rights are denied. A future network adapter must have reviewed licensing, bounded response size, abortable timeout, and retry policy before activation. API keys alone do not grant content rights.
- Important POST mutations require a UUID `Idempotency-Key`. A serializable PostgreSQL transaction stores the request fingerprint and response alongside the resource mutation. Unique keys and retry of serialization/unique races protect concurrent retries. Reusing a key with a changed payload returns 409. Existing canonical senses return the existing item with HTTP 200; new items return HTTP 201. Records carry a 30-day expiry timestamp; operational pruning remains future work and must preserve the promised replay window.
- Updates use an expected version and atomic conditional write. Stale edits, archive, and restore return 409. Archive keeps the same canonical identity and can be restored. Tag rename is owner-scoped and versioned; deletion removes tag assignments but preserves items.
- Lists default to active items, limit 20 (max 100), ordered by creation time then UUID. The one-hour cursor is HMAC signed, scoped to owner and filters, and rejected when forged, expired, or incompatible. Search uses parameterized Prisma queries. The API rejects client-supplied ownership fields.
- `sourceContext` is optional: absent, null, or empty becomes null; nonempty input is limited to 3000 characters. User-authored context is never fabricated from a dictionary example.

## Alternatives and consequences

Lemma plus part of speech was rejected as a sense key because polysemy is common. Similarity-based deduplication was rejected because it could silently merge distinct meanings. Shared global manual senses were rejected because private definitions would cross account boundaries. A live unlicensed dictionary was rejected; manual add and original fixtures provide a truthful development path.

The Phase 05 curated catalog can map its stable source IDs to canonical senses after its own review. It must not infer equivalence to existing manual items from a matching lemma alone. Production dictionary lookup remains unavailable until licensing and provider configuration are approved. Database lookups on every owner-scoped request have a measurable cost; a future cache must retain the same server-authoritative ownership checks.
