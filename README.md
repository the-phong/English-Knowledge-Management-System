# EKMS

## Phase 0 quick start

Requirements: Node 24.13.1, Docker Desktop with WSL integration, and Corepack.

Install the pinned pnpm version without requiring a system-wide write:

```bash
mkdir -p ~/.local/bin
corepack enable --install-directory ~/.local/bin pnpm
corepack prepare pnpm@11.25.0 --activate
export PATH="$PATH:$HOME/.local/bin"
pnpm --version
```

Create the local environment and start the project:

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

API health: `http://localhost:3001/api/v1/health/live` and readiness: `http://localhost:3001/api/v1/health/ready`.

Open the web application at `http://localhost:3000`. Local seed accounts are `alice@example.test` and `bob@example.test`; both use `LocalOnly-Password-123!`.

Phase 1 auth endpoints:

- `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:id`
- `GET /api/v1/me`

Browser auth keeps the access token in memory. The opaque refresh token is stored only in the `ekms_refresh` HttpOnly cookie.

Useful checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm db:migrate:status`.

Use `pnpm db:migrate -- --name <migration-name>` only when intentionally creating a new development migration after changing `schema.prisma`.
