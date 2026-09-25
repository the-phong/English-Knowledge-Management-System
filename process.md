# EKMS — Implementation Checkpoint

Last updated: 2026-09-03 (Asia/Bangkok)

## 1. Cách tiếp tục ở phiên sau

Không cần đọc lại toàn bộ repository. Trước khi làm, chỉ cần:

1. Đọc file này.
2. Đọc `TECHNICAL_DESIGN.md` Section 27 nếu phase kế tiếp cần rule nghiệp vụ chi tiết.
3. Chạy `git status --short` để bảo toàn thay đổi hiện hữu.
4. Chạy đúng các command trong mục **Việc cần làm ngay**.
5. Chỉ chuyển phase khi acceptance gate hiện tại pass.

Nguồn ưu tiên khi có xung đột:

1. Yêu cầu mới nhất của người dùng.
2. `TECHNICAL_DESIGN.md` Section 27.
3. `AI_IMPLEMENTATION_PROMPT.md`.
4. Các phần còn lại của tài liệu kỹ thuật.

Không tự commit, push, deploy, thay secret thật hoặc xóa dữ liệu ngoài database kiểm thử tạm.

## 2. Trạng thái tổng quan

| Phase | Trạng thái | Ghi chú |
| --- | --- | --- |
| Phase 0 — Foundation | Hoàn thành | Gate 0 đã pass đầy đủ |
| Phase 1 — Authentication | Code hoàn thành; cần chạy lại 1 integration gate | Lần xác minh cuối bị chặn vì Docker Desktop/WSL Integration đang tắt |
| Phase 2 — Vocabulary | Chưa bắt đầu | Chỉ bắt đầu sau khi Gate 1 pass lại |
| Phase 3 — Learning | Chưa bắt đầu | Phụ thuộc Vocabulary |
| Phase 4 — Writing/AI | Chưa bắt đầu | Phụ thuộc Vocabulary và mastery foundation |
| Phase 5 — Hardening | Chưa bắt đầu | Dashboard, history, security, accessibility |
| Phase 6 — Release | Chưa bắt đầu | CI, images, runbook; chưa được phép deploy |

## 3. Phase 0 đã hoàn thành

- pnpm monorepo với Turbo, TypeScript strict, ESLint, Jest/Vitest và build scripts.
- Apps/packages: `apps/api`, `apps/web`, `apps/worker`, `packages/contracts`.
- PostgreSQL 17 và Redis 7 bằng Docker Compose.
- Prisma schema, baseline migration `0001_init` và seed 2 user.
- Zod environment validation fail-fast.
- Global response/error envelope, server-generated request ID và JSON logger redaction.
- `/api/v1/health/live` và `/api/v1/health/ready` kiểm tra PostgreSQL/Redis.
- README chứa exact local setup commands.
- Migration `0001_init` đã được thử từ database rỗng.

Gate 0 từng pass:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- PostgreSQL/Redis health và API health qua HTTP

## 4. Phase 1 đã triển khai

### Database

- Mở rộng `refresh_sessions` cho token hash unique, rotation chain và family index.
- Thêm bảng `security_events`.
- Migration: `apps/api/prisma/migrations/0002_phase1_auth/migration.sql`.
- Database local trước đây đã apply đủ `0001_init` và `0002_phase1_auth`.
- Hai migration đã được thử thành công trên database tạm hoàn toàn rỗng; database tạm đã được xóa.

### Backend API

Các endpoint đã có:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:id`
- `GET /api/v1/me`

Security đã triển khai:

- Email NFKC/trim/lowercase và unique bằng `normalized_email`.
- Password 8–128 ký tự, không trim và không truncate; bcrypt cost cấu hình được.
- Login trả lỗi generic để không lộ email tồn tại.
- Access JWT mặc định 10 phút, chỉ chứa `sub`, `sessionId`, `iat`, `exp`, `iss`, `aud`.
- Refresh token opaque 256-bit, raw token chỉ nằm trong cookie.
- Database chỉ lưu HMAC-SHA-256 bằng `REFRESH_TOKEN_PEPPER`.
- Refresh rotation dùng transaction và `SELECT ... FOR UPDATE`.
- Dùng lại token replaced/revoked sẽ revoke toàn family và ghi security event.
- Cookie `ekms_refresh`: HttpOnly, SameSite=Lax, path `/api/v1/auth`; Secure ở production.
- Exact Origin guard cho mọi auth mutation; thiếu Origin mặc định bị từ chối.
- Access guard kiểm tra JWT và session vẫn active.
- Session query/revoke luôn scope theo `userId`; tài nguyên user khác trả 404.
- Public response không trả password hash hoặc refresh token.

Code chính nằm trong:

- `apps/api/src/auth/`
- `apps/api/src/common/http/configure-api-app.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/0002_phase1_auth/migration.sql`

### Frontend

- UI đăng ký/đăng nhập/đăng xuất/logout-all và quản lý active sessions.
- Access token chỉ giữ trong memory; không dùng localStorage/sessionStorage/IndexedDB.
- Reload trang gọi refresh trước khi hiển thị protected state.
- Refresh requests trong một tab được single-flight.
- BroadcastChannel giảm race refresh giữa nhiều tab.
- Refresh thất bại sẽ xóa auth state.
- Có loading/error/authenticated/anonymous states và responsive CSS.

Code chính nằm trong:

- `apps/web/src/auth/auth-client.ts`
- `apps/web/src/auth/auth-panel.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/styles.css`

### Contracts và tests

- Auth Zod schemas/types đã thêm vào `packages/contracts/src/index.ts`.
- Unit tests gồm duration/cookie policy, refresh lifecycle classification, config, logger redaction, contracts và web refresh synchronization.
- PostgreSQL integration tests nằm tại `apps/api/test/auth.integration-spec.ts`.
- Integration scenarios:
  - Origin missing/invalid rejection.
  - Register/login và normalized unique email.
  - Generic login errors.
  - JWT claims và không lộ secret trong response.
  - Refresh HMAC storage, rotation và reuse-family revocation.
  - Security event.
  - Logout/logout-all.
  - Session list/revoke và cross-user isolation.
  - Local cookie flags.
  - Production Secure cookie flag (assertion mới nhất, chưa được chạy lại do Docker tắt).

## 5. Bằng chứng kiểm tra gần nhất

Trước assertion production cookie cuối cùng, toàn bộ các gate sau đã pass:

- `pnpm install --frozen-lockfile` — PASS.
- `pnpm lint` — PASS, 4 workspaces.
- `pnpm typecheck` — PASS, 4 workspaces.
- `pnpm test` — PASS: API 13, web 3, contracts 4, worker 1.
- `pnpm test:integration` — PASS; API có 5 PostgreSQL scenarios.
- `pnpm build` — PASS, 4 workspaces.
- Fresh database migration rehearsal với 2 migrations — PASS, tạo 16 public tables.

Thay đổi cuối cùng sau gate trên:

- Bổ sung integration assertion kiểm tra cookie có `Secure` khi `APP_ENV=production`.
- API typecheck sau thay đổi này đã PASS.
- Integration rerun chưa hoàn tất: PostgreSQL không chạy vì Docker Desktop/WSL Integration đang tắt.

Failure gần nhất không phải lỗi code:

```text
PrismaClientInitializationError: Can't reach database server at localhost:5432
docker: command could not be found in this WSL 2 distro
```

## 6. Blocker hiện tại

1. Mở Docker Desktop trên Windows.
2. Vào **Settings → Resources → WSL Integration**.
3. Bật distro WSL đang sử dụng và chọn **Apply & Restart**.
4. Bảo đảm phiên Codex có quyền `workspace-write`; phiên ngày 2026-09-03 đang là `read-only`.
5. Kiểm tra:

```bash
docker version
docker compose version
```

## 7. Việc cần làm ngay

Sau khi Docker hoạt động:

```bash
docker compose up -d
docker compose ps
docker compose exec -T postgres pg_isready -U ekms -d ekms
docker compose exec -T redis redis-cli ping
pnpm db:migrate:status
pnpm --filter @ekms/api typecheck
pnpm --filter @ekms/api test:integration
```

Nếu integration pass, chạy gate cuối:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Sau đó:

1. Cập nhật `docs/IMPLEMENTATION_STATUS.md` nếu kết quả thực tế khác nội dung hiện tại.
2. Đánh dấu Gate 1 hoàn thành chính thức.
3. Dừng tại checkpoint và báo cáo cho người dùng.
4. Chỉ bắt đầu Phase 2 khi người dùng yêu cầu tiếp tục.

## 8. Phase tiếp theo sau Gate 1

Phase 2 — Vocabulary vertical slice:

1. Hoàn thiện schema/constraints cho lexeme, senses, vocabulary, tags và initial mastery.
2. Tạo deterministic Dictionary fixture có từ `persistent`.
3. Manual create phải hoạt động khi provider/Redis lỗi.
4. API lookup/create/list/detail/update/archive/restore/tags/history shell.
5. Cursor pagination có ký/opaque và ownership ở repository boundary.
6. Web Quick Add, list, detail/edit/archive/restore với loading/empty/error/success states.
7. Test duplicate normalization, invalid cursor, provider/cache fallback và cross-user isolation.

Không bắt đầu Learning trong Phase 2. Learning là Phase 3.

## 9. Trạng thái Git và dữ liệu

- Chưa commit, push hoặc deploy.
- Repository hiện có nhiều file untracked vì dự án ban đầu là greenfield.
- Không được xóa/reset các thay đổi hiện tại.
- `.env` local được ignore; `.env.example` không chứa secret thật.
- Integration tests tự xóa user test mà chúng tạo.
- PostgreSQL/Redis local có thể dừng khi Docker Desktop đóng; đây không đồng nghĩa code hoặc volume bị mất.
