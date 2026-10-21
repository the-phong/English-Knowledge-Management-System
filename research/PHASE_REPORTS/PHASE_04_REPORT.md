# EKMS — PHASE 04 VOCABULARY MANAGEMENT IMPLEMENTATION REPORT

## 1. Executive Summary and Overall Status

Implementation, technical verification, and implementation-commit delivery: **PASS**. The final chat report records the documentation sync commit SHA as well. Phase 04 adds owner-scoped personal vocabulary, manual add, sense identity, tags, search, cursor pagination, archive/restore, a rights-aware local dictionary fixture, and a responsive Vocabulary Hub. No IELTS catalog, Learning, Mastery, Writing, AI, or deployment was added.

The real PostgreSQL/HTTP suite, browser flow, quality checks, migrations, latest API image export, runtime checks, and synthetic benchmark passed. A create-with-tag defect was found by a newly added integration case and fixed before final verification.

## 2. Git Baseline and Branch Safety

Repository: `/mnt/d/Personal/English-Knowledge-Management-System`. Initial working tree was clean on `feature/ekms-p03-ui` at the accepted Phase 03 SHA `e7b269d71349d086933168aa295487e22a8b6dca`; remote Phase 03 matched. Created `feature/ekms-p04-vocabulary` from that exact commit. Remote `master` before delivery was `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`. No reset, stash, rebase, merge, force push, or unrelated branch change occurred.

## 3. Existing System Assessment

Phase 03 supplied four working routes, a semantic-token design system, AppShell, reusable controls, protected AuthProvider, and a same-origin API proxy. Phase 02 supplied AuthGuard, OriginGuard, request IDs, safe error envelopes, and user sessions. Prisma contained only User, RefreshSession, and SecurityEvent; two migrations were current. The Phase 04 module reuses those boundaries. The worker and Redis remain foundation infrastructure without vocabulary jobs.

## 4. Vocabulary Domain and Sense Identity

`Lexeme` stores a normalized English lemma; `DictionarySense` stores permitted shared fixture identities; `VocabularyItem` stores the private owner-specific target sense. Lemmas use NFKC, trim, internal whitespace collapse, lowercase, and a 1–100 character post-normalization limit. Manual identity hashes normalized lemma, part of speech, and canonical exact definition text. Recognized fixture identity uses provider and stable source sense ID. Exact recognized/manual duplicates return the existing owner item, including archived items; different meanings of one lemma remain separate. The design does not infer semantic equivalence from lemma, POS, or similar wording. Source context is optional and never fabricated. See ADR 0006.

## 5. Database Schema and Migrations

New tables: `lexemes`, `dictionary_senses`, `vocabulary_items`, `context_tags`, `vocabulary_tags`, `idempotency_records`. The additive `20261021_p04_vocabulary` migration has unique `(user_id,sense_key)`, normalized lexeme/tag uniqueness, composite owner-safe tag foreign keys, source/provenance checks, version/bound checks, owner-list indexes, and idempotency uniqueness. Existing auth tables and migrations remain intact.

Before migration, the owned `ekms_dev` database had one user and two migrations; the isolated `ekms_p02_test` database had no users and two migrations. SQL was reviewed, deployed to the test database first and then to development. A private development dump was validated with `pg_restore -l` before deployment; path and SHA are in `research/evidence/phase04-checks.md`. Final status: three migrations current in both databases. No reset, unknown table deletion, or volume deletion occurred. After temporary-account cleanup, development has one pre-existing user and no vocabulary/tag rows; test has no users/items/tags.

## 6. REST API Contract and Responses

All routes are under `/api/v1` and require a validated server session. Success is `{ "data": ... }`; error is `{ "error": { "code", "message", "requestId" } }`.

| Method and route                                | Behavior                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /dictionary/lookup?q=…[&provider=fixture]` | Returns unavailable when no licensed provider is configured; explicit fixture only in non-production. |
| `POST /vocabulary`                              | Manual definition or selected fixture sense; UUID Idempotency-Key; 201 new, 200 existing/replay.      |
| `GET /vocabulary`                               | Active by default; `q`, `status`, `tag`, `limit`, `cursor`; 20 default/100 max.                       |
| `GET /vocabulary/:id`                           | Owner-scoped private detail; foreign/unknown ID returns 404.                                          |
| `PATCH /vocabulary/:id`                         | Owner-scoped edit with `expectedVersion`; stale version 409.                                          |
| `POST /vocabulary/:id/archive` and `/restore`   | Owner-scoped, versioned, idempotent-keyed state transitions.                                          |
| `GET /tags`, `POST /tags`                       | Private list/create; create requires UUID Idempotency-Key.                                            |
| `PATCH /tags/:id`, `DELETE /tags/:id`           | Owner-scoped rename/version or delete. Deletion detaches tags and keeps words.                        |

Validation rejects server-owned fields, oversized inputs, invalid UUIDs/cursors/keys, and malformed JSON. Missing/malicious Origin on mutations is rejected by the existing guard. Private foreign IDs return 404. The baseline JSON body parser remains at its existing stricter 100 KiB default.

## 7. Canonicalization, Deduplication and Idempotency

`UNIQUE(user_id,sense_key)` protects canonical identity across active and archived records. Important POSTs store user, operation, UUID key, canonical request fingerprint, response, and expiry in a serializable transaction with bounded retry for uniqueness/serialization races. Replayed same request returns its original result; changed payload with the same key returns 409. Item creation and owned-tag join insertion occur in one transaction. Versioned conditional update prevents stale edits and archive/restore races. Records currently carry a 30-day expiry but no pruning worker; a later maintenance task must preserve the replay window.

## 8. Dictionary Adapter, Fixture and Licensing Policy

`DictionaryProvider` describes provider ID/version, sense ID, lemma/POS, definition, attribution/provenance, and rights. Missing rights deny display/storage/cache/AI/quiz reuse by default. The original three-sense `ekms-original-fixture` is development-only and is explicitly labelled. It is locally authored content, not Cambridge/Oxford content or the Phase 05 IELTS catalog. No live provider request, scraping, third-party example storage, or OpenAI call was introduced. Lookup responses are bounded/validated and timed out. A future network adapter needs abortable timeout, response-size limits, a retry policy, and legal review before activation. Manual Add works without lookup.

## 9. Vocabulary Hub UI and User Workflows

Protected `/vocabulary` uses Phase 03 AppShell/components and the Phase 02 in-memory-token AuthProvider request layer. It provides active/archived library views, search, tag filter, cursor next/previous, Quick Add manual/fixture selection, optional context/note/tags, detail, edit, archive/restore confirmation, and personal tag management. It handles loading, empty/no-match, provider unavailable, error, success, duplicate, conflict, and pending states. Duplicate add opens the original item. No invented learning statistics or active IELTS catalog link appears. `/`, `/auth`, `/app`, and `/account` remain functional.

## 10. Tags, Search, Pagination, Archive and Restore

Tag names are NFKC/trim/space-collapsed, unique per owner in lowercase form, and limited to 50 characters. Assignment checks the owner in service logic and composite FKs. Search is parameterized through Prisma, never string-built SQL. The list uses descending `createdAt` plus UUID tie-breaker and a one-hour HMAC-signed cursor bound to owner and filters. Archive preserves the canonical sense key and its data; restore returns it to active results. Tag deletion removes joins only.

## 11. Ownership, Security and Negative Tests

HTTP/PostgreSQL integration tests exercise Alice/Bob isolation for read, patch, archive, restore, tag assignment/rename/delete, malformed/foreign cursors, and client-supplied ownership fields. Foreign private IDs return 404. Other negative cases include invalid UUID/key/body, oversized context, changed idempotency payload, stale version, missing Authorization, malicious/missing Origin, unavailable provider, and safe error envelope. Existing Auth tests cover revoked sessions, JWT/session authority, refresh replay, login rate limiting, and Origin protection. No raw tokens or private meanings are logged by the new module.

## 12. PostgreSQL Integration and Concurrency Tests

The six-test API HTTP/PostgreSQL suite passed against `ekms_p02_test`. Its Vocabulary scenario asserts normalized-email users, same/different sense behavior, Bob's independent copy, concurrent same-sense creation, same-key retry and changed-payload conflict, concurrent tag normalization, stale/concurrent edit conflicts, archive/restore, events/rollback behavior where applicable, and post-operation row counts. A dedicated owned-tag creation case caught and drove the transaction fix. Test accounts were deleted; final test DB counts are zero.

## 13. Browser E2E, Accessibility and Screenshots

Real Chromium against the running same-origin web/API stack passed registration/login, protected navigation, empty state, keyboard Quick Add activation, context-free save, edit/tag/filter/search, duplicate-open, second sense, archive/restore, reload, second-account isolation, logout, and protected-route denial. Fifteen layout checks covered 375/390/768/1280/1440px; nine axe A/AA scans reported zero violations; zero page errors occurred. Eight sanitized desktop/mobile screenshots are in `research/evidence/phase04-visual/` and were visually inspected. Manual assistive-technology and non-Chromium audits remain future QA work.

## 14. Benchmark and Performance Evidence

Sequential local HTTP workload used 25 requests per operation and one temporary account, removed after the run. Millisecond p50/p95/p99: Quick Add 14.76/21.9/24.6; list 6.14/7.49/9.71; search 5.08/6.55/6.86; detail 4.46/5.51/6.68; tag filter 6.59/8.58/9.22; archive 11.2/12.96/13.9; restore 10.99/14.52/15.11. `EXPLAIN` on the tiny post-cleanup dataset chose an owner index plus sort; the dedicated owner/status/date index exists but its large-data benefit remains unverified. These are local measurements, not a production SLA.

## 15. Phase 01–03 Regression Results

Root unit tests passed API 12/12 and web 13/13 plus existing config/worker/contracts suites. Root integration tasks passed 8/8 including the existing authentication HTTP/PostgreSQL suite. Compose PostgreSQL/Redis/API are healthy; worker/web run; web `/`, `/auth`, `/account` and direct/proxied readiness return HTTP 200. The browser confirmed session restoration and logout protection through the same-origin proxy. No Auth security architecture or Prisma auth table was changed.

## 16. Full Quality Check Evidence with Exit Codes

`pnpm install --frozen-lockfile` 0; `pnpm format:check` 0; `pnpm lint` 0; `pnpm typecheck` 0 (7/7); `pnpm test` 0 (10/10); isolated Compose `pnpm test:integration` 0 (8/8, API 6/6); `pnpm build` 0 (5/5); `pnpm db:validate` 0; dev/test migration status both 0; `docker compose config --quiet` 0; final `docker compose build api` 0 with image export/unpack; browser 0; benchmark 0; `git diff --check` 0. See `research/evidence/phase04-checks.md` for exact commands, failure corrections, HTTP results, and backup evidence.

## 17. Acceptance Gates V01–V18

| Gate | Status | Evidence                                                                                                                                                                                                |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01  | PASS   | Exact Phase 03 ancestry and isolated Phase 04 branch.                                                                                                                                                   |
| V02  | PASS   | Existing schema assessed; additive migration and backup reviewed.                                                                                                                                       |
| V03  | PASS   | Lexeme/sense split, canonicalization unit and integration tests.                                                                                                                                        |
| V04  | PASS   | Owner fields, scoped queries and composite tag FKs.                                                                                                                                                     |
| V05  | PASS   | Manual Add with provider unavailable, browser and HTTP tests.                                                                                                                                           |
| V06  | PASS   | Absent/null/empty context and max-bound tests.                                                                                                                                                          |
| V07  | PASS   | Same-sense duplicate and distinct-sense/owner cases.                                                                                                                                                    |
| V08  | PASS   | Serializable idempotency and version/concurrency tests.                                                                                                                                                 |
| V09  | PASS   | Owner-scoped list/detail/edit/archive/restore tests.                                                                                                                                                    |
| V10  | PASS   | Tag CRUD, assignment, and cross-user negatives.                                                                                                                                                         |
| V11  | PASS   | Search/filter/signed-cursor tests.                                                                                                                                                                      |
| V12  | PASS   | Rights-aware fixture/no-provider/timeout/malformed tests.                                                                                                                                               |
| V13  | PASS   | Real responsive Vocabulary Hub and browser workflow.                                                                                                                                                    |
| V14  | PASS   | Five viewport checks, keyboard activation, axe scans, screenshots.                                                                                                                                      |
| V15  | PASS   | Isolated real PostgreSQL/HTTP security suite.                                                                                                                                                           |
| V16  | PASS   | Root quality, latest API image, runtime, prior-phase regressions.                                                                                                                                       |
| V17  | PASS   | ADR, contracts, benchmark, README and reproducible evidence.                                                                                                                                            |
| V18  | PASS   | Implementation commit `d0537a3907a6d1e4fefccce0f804cddd6a7d6ea8` pushed to the Phase 04 branch; remote SHA matched and `master` remained unchanged. The final documentation commit is reported in chat. |

## 18. Files Changed, ADRs and Documentation

New: Prisma migration; `apps/api/src/vocabulary/*`; API vocabulary unit/integration tests; `apps/web/src/app/vocabulary/page.tsx`; `apps/web/src/lib/vocabulary-client.ts`; web Vocabulary tests; `packages/contracts/src/vocabulary.ts`; ADR 0006; browser/benchmark scripts; eight screenshots and visual README; Phase 04 evidence and report. Updated: Prisma schema, API module/guard exports/error handling/package manifest, lockfile, shared contracts index, web AuthProvider request exposure, AppShell navigation, `/app` entry, styles, existing navigation test, and root README. No file was removed. `zod@4.6.7` was added as a direct API dependency (already present transitively) and locked.

## 19. Git Commits, Push, Remote Verification and Working Tree

The staged review found 42 intended files, no secret/environment files or generated builds, and `git diff --cached --check` exited 0. Implementation commit `d0537a3907a6d1e4fefccce0f804cddd6a7d6ea8` (`feat(vocabulary): add owner-scoped vocabulary management`) was pushed with `git push -u origin HEAD:refs/heads/feature/ekms-p04-vocabulary`, exit 0. Independent `git ls-remote` returned the same feature SHA. Protected `master` remained `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`. This report update is delivered in a separate documentation commit; its final SHA and clean working-tree verification appear in chat. No PR, merge, deployment, or protected-branch push occurred.

## 20. Remaining Risks and Phase 05 Readiness

No licensed live dictionary is configured; manual add remains available. Differently worded manual definitions are kept separate even when semantically similar. Idempotency pruning is deferred. The current cursor signing key is derived from the existing validated server signing key; rotation invalidates outstanding one-hour cursors. Postgres text search is suitable for the current small local dataset but large-scale index/query tuning needs realistic lawful data. Automated accessibility scans do not prove full WCAG conformance. Phase 05 may reuse lexeme/sense/provenance abstractions, but must separately authorize and implement a curated IELTS catalog and explicit identity mapping. Phase 05 has not started.

## 21. Mandatory Stop Statement

Phase 04 execution has stopped. No Phase 05 implementation was started. No direct push or merge to main/master was performed. I am awaiting the Product Owner and Project Controller's review.
