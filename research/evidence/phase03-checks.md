# Phase 03 verification evidence

Date: 2026-10-21. Repository: `/mnt/d/Personal/English-Knowledge-Management-System`. Branch: `feature/ekms-p03-ui`, created from the approved Phase 02 commit `dcb96502cdd02d0e96cbb9dd4b339c8dd57417ac`. The initial tree was clean. Remote Phase 02 matched that commit; remote `master` was `89e4c6b1defea5bf6c89c7a71f450e3abd491e8a`.

## UI and browser

- Baseline web tests before UI changes: `pnpm --filter @ekms/web test` exited 0 (7 tests).
- Final `pnpm --filter @ekms/web typecheck` and `pnpm --filter @ekms/web test` exited 0; the web suite has 11 tests after adding UI component coverage.
- The first host web build compiled and generated all pages but stalled during finalization; it was stopped (exit 143), so it was not counted as a pass. A later root `pnpm test` completed the same web build and all tests successfully; `pnpm build` then exited 0. The final `docker compose build web` also exited 0 with a fresh five-package build and image export/unpack. Final web image ID: `sha256:7b9da6d4df44d9432e3db67925b48b13510a2b476037312faeed7039c4311327`.
- A prior Docker build attempt failed while fetching npm metadata during a temporary registry connection problem. Registry access recovered; one subsequent targeted web build completed. No Docker prune, volume deletion, database reset, or unrelated container action was used.
- The owned `web` container was recreated from the final image. PostgreSQL, Redis, and API were healthy; worker and web were running. `GET /`, `/auth`, `/app`, `/account`, proxied `/api/v1/health/ready`, direct API liveness, and direct API readiness returned HTTP 200. `/app` and `/account` are client-protected routes: a raw document HTTP 200 does not establish authorization; the browser smoke below verified redirect and private-content withholding.
- Isolated browser tools: `npm install --prefix /tmp/ekms-p03-browser --no-save --no-package-lock --ignore-scripts playwright@1.63.0 axe-core@4.11.0` exited 0 after WSL cleared an earlier `/tmp` install. No project dependency or lockfile was changed. The cached compatible Chromium binary was used.
- `NODE_PATH=/tmp/ekms-p03-browser/node_modules node research/evidence/phase03-visual-smoke.cjs` exited 0 on the final production-mode web container. It passed 25 layout checks covering five screens at 375, 390, 768, 1280, and 1440px; nine axe-core WCAG A/AA scans reported zero violations; no browser page errors occurred. It registered a temporary test user, logged in, verified the scoped HttpOnly/Lax refresh cookie, restored after reload through `/auth/refresh` and `/me`, revoked a second session, used logout-all, and confirmed protected navigation was denied. Temporary test-user cleanup returned `DELETE 1`.
- Keyboard checks confirmed Auth email-to-password tab order and focus on both session confirmation actions. Visual screenshots were inspected for grouping, legibility, mobile navigation, wrapping, and clipped controls. See `research/evidence/phase03-visual/README.md` and 11 PNG files. These checks do not establish complete WCAG conformance or non-Chromium behavior.

## Final quality commands

| Command | Exit | Result | Relevant evidence |
| --- | ---: | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | PASS | Six workspace projects; already up to date |
| `pnpm format:check` | 0 | PASS | All matched files use Prettier style |
| `pnpm lint` | 0 | PASS | ESLint completed without diagnostics |
| `pnpm typecheck` | 0 | PASS | Seven of seven Turborepo tasks |
| `pnpm test` | 0 | PASS | Ten of ten tasks; API 8, web 11, config 5, contracts 1, worker 1 tests |
| `docker compose run --rm --no-deps -e REDIS_URL=redis://redis:6379/1 -e AUTH_LOGIN_IP_LIMIT=100 -e AUTH_LOGIN_ACCOUNT_LIMIT=7 -e AUTH_REGISTER_IP_LIMIT=100 -e AUTH_REFRESH_IP_LIMIT=100 api sh -lc 'export DATABASE_URL="${DATABASE_URL%/*}/ekms_p02_test?schema=public"; pnpm test:integration'` | 0 | PASS | Isolated EKMS test DB; eight of eight tasks, API 5 HTTP/PostgreSQL tests and web 11 tests |
| `pnpm build` | 0 | PASS | Five of five tasks; cached result from successful web build during root test run |
| `docker compose build web` | 0 | PASS | Fresh five-package build and final image export completed |
| `pnpm db:validate` | 0 | PASS | Prisma schema valid |
| `docker compose exec -T api pnpm db:status` | 0 | PASS | Owned `ekms_dev`, two migrations, schema up to date |
| `docker compose config --quiet` | 0 | PASS | Compose configuration valid |
| `git diff --check` | 0 | PASS | No whitespace errors before delivery review |
| `NODE_PATH=/tmp/ekms-p03-browser/node_modules node research/evidence/phase03-visual-smoke.cjs` | 0 | PASS | 25 viewport checks, nine axe scans, auth/session/proxy flow, cleanup |

The final integration run had 8/8 tasks and no failed tests. Earlier integration output was truncated by the tool; the suite was rerun with an explicit captured exit code. Generated test logs remained outside the repository at `/tmp/ekms-p03-integration.log` and `/tmp/ekms-p03-browser-final.log` and are not committed.

## Security and scope

- Authentication provider, API contracts, server guards, database models, migrations, and security settings were not changed.
- Only the four working routes are actionable. No fictional progress statistics or unavailable business workflows were added.
- Screenshot account data used a generated `@example.test` identity; no credentials, token, cookie values, or personal account data are in the screenshots or report.
- The known Phase 02 proxy IP bucket and browser Web Locks fallback remain as documented in the Phase 02 report; this UI phase did not alter those security controls.
- Remote branch delivery and protected-branch comparison are recorded in the final Phase 03 chat report after commit and push.
