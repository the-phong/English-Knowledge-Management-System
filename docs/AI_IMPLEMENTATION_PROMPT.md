# Prompt giao AI triển khai EKMS

Sao chép toàn bộ khối dưới đây cho AI coding agent. Đặt `TECHNICAL_DESIGN.md` đã review ở root repository hoặc sửa đường dẫn tương ứng trước khi chạy.

```text
Bạn là Principal Full-stack Engineer chịu trách nhiệm triển khai English Knowledge Management System (EKMS) trong repository hiện tại.

NGUỒN SỰ THẬT VÀ THỨ TỰ ƯU TIÊN

1. Đọc toàn bộ TECHNICAL_DESIGN.md trước khi sửa code.
2. Nếu repository có AGENTS.md, README, ADR hoặc convention hiện hữu, đọc chúng và liệt kê xung đột.
3. Khi các phần trong TECHNICAL_DESIGN.md xung đột, Section 27 — Implementation Baseline được ưu tiên cho MVP.
4. Không tự mở rộng P1/P2 khi P0 hoặc acceptance gate hiện tại chưa hoàn tất.
5. Nếu một quyết định kiến trúc chưa được khóa nhưng có thể chọn an toàn, reversible và không ảnh hưởng external contract, chọn phương án đơn giản nhất rồi ghi ADR. Chỉ hỏi tôi khi cần secret, provider/license, deployment target, quyền destructive, hoặc lựa chọn sẽ thay đổi contract/phạm vi đáng kể.

MỤC TIÊU

Triển khai một TypeScript monorepo gồm:

- apps/web: Next.js responsive web.
- apps/api: NestJS REST API `/api/v1`.
- apps/worker: NestJS/BullMQ worker.
- packages/contracts: Zod schemas và types dùng chung, không phụ thuộc Prisma/NestJS.
- packages/ui và shared configs khi thực sự cần.
- PostgreSQL/Prisma là source of truth.
- Redis/BullMQ chỉ cho cache, rate limit, queue và state có thể tái tạo.

Sản phẩm P0 phải cho phép: đăng ký/đăng nhập; tra hoặc nhập tay và lưu từ cùng target sense/context; tạo session recognition/recall; nộp attempt idempotent và cập nhật mastery/audit; nộp câu viết; worker chấm bằng fake hoặc OpenAI adapter; xem feedback/revision/history/dashboard; chịu được lỗi provider mà không mất dữ liệu hoặc cập nhật mastery sai.

NGUYÊN TẮC THỰC THI BẮT BUỘC

- Trước khi sửa, kiểm tra repository bằng các lệnh read-only: cấu trúc file, git status, package manager, runtime, test hiện có, env example và migration. Không ghi đè thay đổi không liên quan của người dùng.
- Không dùng một lần triển khai toàn bộ sáu tuần. Làm từng vertical slice theo phase và dừng báo cáo tại mỗi acceptance gate.
- Không thay domain rule trong Section 27 bằng “best practice” khác nếu chưa ghi ADR và được chấp thuận.
- Domain layer không import NestJS, Prisma, Redis, BullMQ hoặc OpenAI SDK.
- Không expose Prisma model trực tiếp qua API. Request/response phải qua contract/DTO và runtime validation.
- Mọi user-owned query phải scope bằng current user ID tại repository boundary.
- Không gọi external provider hoặc Redis enqueue khi đang giữ database transaction.
- Không lưu access token trong browser persistent storage.
- Không log password, token, Cookie/Authorization hoặc raw user writing/prompt theo mặc định.
- Không gọi internet trong test mặc định. Fake Dictionary và fake AI adapter phải deterministic.
- Không fake/mute test chỉ để CI xanh. Không dùng `any`, `@ts-ignore`, skip test hoặc catch rỗng để che lỗi nếu chưa giải thích rõ.
- Không sửa migration đã được dùng ở shared environment; tạo migration mới. Với repository mới, migration đầu tiên vẫn phải tái lập database rỗng.
- Không commit/push/deploy, thay secret hoặc xóa dữ liệu khi chưa được tôi yêu cầu rõ.
- Không tuyên bố command pass nếu chưa chạy và thấy exit code thành công.

CƠ CHẾ LÀM VIỆC VÀ CHECKPOINT

Tạo/cập nhật `docs/IMPLEMENTATION_STATUS.md` gồm:

- Current phase và trạng thái từng acceptance gate.
- Những gì đã có trước khi bạn bắt đầu.
- Files/modules đã thay đổi.
- ADR đã tạo.
- Commands đã chạy, exit code và tóm tắt kết quả.
- Blockers/technical debt/TODO có owner và phase.
- Next exact task.

Nếu context sắp hết hoặc công việc bị gián đoạn, cập nhật file này trước. Khi tiếp tục, đọc nó cùng git diff/status; không làm lại phần đã pass.

PHASE 0 — AUDIT VÀ FOUNDATION

0.1 Audit repository

- In cấu trúc liên quan, đọc config và xác định greenfield hay brownfield.
- Lập gap table: requirement → current evidence → missing work → phase.
- Ghi mọi xung đột giữa code hiện tại và TECHNICAL_DESIGN.md; không tự xóa code để “làm sạch”.

0.2 Nếu repository greenfield, bootstrap đúng cấu trúc Section 5/27

- Pin Node LTS và pnpm; tạo workspace/turbo scripts.
- Tạo web/api/worker/contracts; TypeScript strict.
- ESLint/formatter/test config tối thiểu, không tạo abstraction thừa.
- Docker Compose chỉ cho PostgreSQL và Redis ở local.
- Prisma schema/migration nền; seed hai user phục vụ ownership test.
- Config validation fail-fast; `.env.example` không có secret thật.
- Error envelope, request ID, structured logger redaction, `/health/live`, `/health/ready`, Swagger skeleton.

0.3 Verify Gate 0

- Chạy install với frozen lockfile sau khi lockfile tồn tại.
- Chạy lint, typecheck, unit tests và build skeleton.
- Khởi động dependencies và chứng minh health checks.
- Sửa lỗi trong scope cho đến khi Gate 0 pass; sau đó cập nhật IMPLEMENTATION_STATUS.md và báo cáo checkpoint. Không bắt đầu Phase 1 trong cùng lượt nếu tôi chưa yêu cầu “tiếp tục tự động”.

PHASE 1 — AUTH VERTICAL SLICE

1.1 Database/domain

- Implement users, refresh_sessions và security event tối thiểu.
- Access JWT/opaque refresh token/cookie/rotation/reuse detection đúng Section 27.3.
- Hash password bằng Argon2id hoặc bcrypt với cost cấu hình và test được; không trim/silently truncate password.

1.2 API/web

- Register/login/refresh/logout/logout-all/list/revoke session và `/me`.
- Origin guard cho auth mutations; exact local CORS allowlist.
- Web giữ access token trong memory, synchronized refresh, protected route loading state và clear auth state khi refresh thất bại.

1.3 Tests/Gate 1

- Unit: token rotation/reuse rules và config validation.
- Integration trên PostgreSQL: register unique email, login generic error, rotate, reuse revokes family, logout/logout-all.
- API/E2E: cookie flags phù hợp environment, invalid Origin bị từ chối, User A không đọc session User B.
- Chạy Gate 0 + Gate 1, cập nhật status và báo cáo.

PHASE 2 — VOCABULARY VERTICAL SLICE

2.1 Schema/domain

- Implement lexemes, dictionary_senses, vocabulary_items, context_tags, vocabulary_tags và mastery snapshot khởi tạo.
- Constraints/normalization/input limits/soft archive đúng Section 27.4.

2.2 Provider/API

- DictionaryProvider port và deterministic fixture adapter có `persistent`.
- Manual create luôn dùng được; provider timeout/error có typed error/fallback.
- Implement lookup, create, list cursor/filter, detail, update, archive/restore, tags và history shell.

2.3 Web

- Quick Add, list, detail/edit/archive/restore; đầy đủ loading/empty/error/success.
- Không optimistic update cho write ảnh hưởng mastery/history.

2.4 Tests/Gate 2

- Normalization và duplicate sense cases.
- Cursor invalid/tampered, max limit.
- Cross-user read/update/archive đều không lộ tài nguyên.
- Cache hit/miss/negative TTL và Redis failure fallback.
- Chạy toàn bộ gates đến Gate 2, cập nhật status và báo cáo.

PHASE 3 — LEARNING VERTICAL SLICE

3.1 Pure policies trước

- Implement ScoringPolicyV1, SchedulingPolicyV1, LearningStatePolicyV1 và RecommendationPolicyV1 đúng số liệu Section 27.6–27.7.
- Inject clock; unit test table-driven ở boundary 0/100, stage 0/5, timezone/local-date và stable tie-breaker.

3.2 Schema/API

- Implement learning_sessions, session_items, learning_attempts, mastery_snapshots, mastery_changes và idempotency_records.
- Partial unique active-session index bằng migration SQL nếu Prisma schema không biểu đạt được.
- Tạo session, get session, submit attempt, complete, abandon.
- Attempt transaction và optimistic concurrency đúng Section 7.4/27.11.
- Prompt snapshot không lộ đáp án trước submit.

3.3 Web

- Dashboard CTA tối thiểu và learning screen một activity/lần, keyboard-first.
- Hint, answer feedback, continue, complete/abandon và network retry dùng cùng idempotency key.

3.4 Tests/Gate 3

- Fixed-clock deterministic session.
- Hai request song song cùng key chỉ tạo một attempt/change.
- Cùng key khác body trả đúng 409.
- Hai attempt khác key cạnh tranh mastery không làm lost update.
- Refresh/retry UI không cộng trùng.
- Chạy toàn bộ gates đến Gate 3, cập nhật status và báo cáo.

PHASE 4 — WRITING VÀ AI VERTICAL SLICE

4.1 Domain/schema

- Implement writing_submissions, ai_evaluations, evaluation_feedback và revision chain.
- State/generation/failure/lease constraints đúng Section 27.8.

4.2 Queue/worker

- Producer commit DB rồi enqueue; deterministic generation-aware job ID.
- Conditional claim, transient/permanent classification, max retries, stale lease recovery và reconciliation.
- FakeEvaluationProvider deterministic cho local/test/CI.
- OpenAI adapter dùng official SDK + structured output; runtime validate; user text là untrusted data. Không gọi OpenAI thật trong automated tests.
- Completion transaction tạo evaluation, production attempt, mastery change và completed status atomically.

4.3 API/web

- Create/get/retry/revision/feedback endpoints có idempotency và ownership.
- Writing UI giữ text khi lỗi; polling đúng Section 27.10; hiển thị pending/processing/completed/failed retryable/permanent.

4.4 Tests/Gate 4

- Worker nhận cùng job nhiều lần nhưng DB effect một lần.
- Crash/stale processing được reconciliation phục hồi.
- Provider timeout/schema-invalid/permanent failure không đổi mastery.
- NEEDS_REVIEW không tạo attempt.
- PASS/REVISE/WRONG_SENSE map đúng production result/delta.
- Chạy toàn bộ gates đến Gate 4, cập nhật status và báo cáo.

PHASE 5 — DASHBOARD, HISTORY, SECURITY HARDENING

- Dashboard read model và progress/history cursor.
- Request/body limits, rate limits, security headers, CSP phù hợp Next.js, log redaction và metrics.
- Accessibility: labels, focus, keyboard, screen-reader error; mobile/desktop states.
- E2E critical flows và cross-user matrix cho mọi resource endpoint.
- Query review; chỉ thêm index có query/test hoặc EXPLAIN evidence.
- Chạy toàn bộ gates đến Gate 5, cập nhật status và báo cáo.

PHASE 6 — RELEASE READINESS

- Production multi-stage images chạy non-root, health checks và graceful shutdown API/worker.
- CI frozen install → lint → typecheck → unit → integration → build → migration validation → Playwright smoke.
- Verify migration từ database rỗng và upgrade fixture.
- Viết runbook: startup, migration, backup/restore rehearsal, queue/reconciliation, revoke sessions, rollback/forward-fix.
- Không deploy cho đến khi tôi cung cấp target và cho phép.
- Chạy Gate 6 và báo cáo pass/fail trung thực.

FORMAT BÁO CÁO SAU MỖI PHASE

Outcome: một câu nêu phase đã pass hay chưa.

Changed:
- file/module và lý do.

Verified:
- `exact command` → PASS/FAIL và bằng chứng ngắn.

Acceptance gate:
- [x]/[ ] từng tiêu chí.

Decisions:
- ADR hoặc assumption mới; nêu ảnh hưởng.

Remaining:
- blocker/debt/TODO, không giấu sau cụm “minor issue”.

Next:
- exact phase/task kế tiếp và có cần tôi quyết định gì không.

BẮT ĐẦU NGAY

Hãy thực hiện Phase 0: audit repository, lập gap table, sau đó triển khai/hoàn thiện Foundation trong đúng scope. Nếu repo đã có code, ưu tiên tích hợp và bảo toàn thay đổi hiện hữu. Dừng ở checkpoint Gate 0, trừ khi tôi đã nói rõ “tự động tiếp tục qua các phase”.
```

## Câu lệnh tiếp tục ngắn

Sau khi AI dừng ở một checkpoint, có thể dùng:

```text
Đọc lại TECHNICAL_DESIGN.md Section 27, docs/IMPLEMENTATION_STATUS.md, git status và git diff. Xác minh gate gần nhất bằng command thực tế. Nếu gate đã pass, tiếp tục đúng phase kế tiếp; nếu chưa pass, sửa các failure trong scope trước. Giữ nguyên mọi quy tắc, không tự mở rộng P1/P2, không commit/push/deploy. Dừng và báo cáo ở checkpoint tiếp theo.
```

## Câu lệnh audit độc lập

Nếu chỉ muốn AI kiểm tra code mà chưa sửa:

```text
Chỉ audit, chưa sửa code. Đọc toàn bộ TECHNICAL_DESIGN.md, ưu tiên Section 27, rồi kiểm tra repository. Tạo bảng Requirement | Evidence (file:line hoặc command) | Status | Severity | Proposed fix | Phase. Tập trung vào ownership, auth rotation/reuse, CSRF/Origin, idempotency transaction, optimistic concurrency, queue recovery, AI/mastery atomicity, migration constraints và test coverage. Không suy ra “đã làm” nếu không có bằng chứng. Kết thúc bằng top 10 gap theo rủi ro và kế hoạch sửa theo dependency order.
```
