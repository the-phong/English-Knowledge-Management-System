# ADR 0004 — Authentication and session security

Status: accepted for Phase 02 implementation.

## Decision

Registration validates and normalizes the email, hashes the unchanged password with Argon2id (19 MiB, two iterations, one lane), and creates the user without signing them in. Login is a separate step. The database unique index is the final concurrent duplicate defense.

The API issues a 10-minute HS256 access JWT containing `sub`, `sessionId`, `iat`, `exp`, `iss`, and `aud`. Verification pins the algorithm, issuer, audience, and lifetime. Every protected request also checks the referenced session in PostgreSQL. A revoked, expired, or consumed session immediately loses access, at the cost of one database lookup per protected request. Signing and refresh HMAC keys are independent, server-only, canonical base64 values of at least 32 bytes.

The 30-day refresh credential is 32 random bytes encoded as base64url. Only HMAC-SHA-256 with a server pepper is stored. It is sent only in the `ekms_refresh` cookie (`HttpOnly`, `SameSite=Lax`, path `/api/v1/auth`, `Secure` in production). A transaction locks the owning user row and then the matched refresh row before rotation. Consumed-token reuse revokes that family and records security events in the same committed transaction. Session revocation locks the same user row, so it serializes with rotation. A failed transaction returns no replacement token and rolls back its writes. Historical consumed rows remain for replay detection. The user row lock serializes all session mutations for one account; high account-wide refresh rates may require a narrower lock design later.

Logout accepts a valid refresh cookie even if the access JWT expired. Logout-all and session listing require an active access session. Individual revocation is scoped to the authenticated user and returns 404 for another user's ID. Public responses omit token hashes, passwords, and security event internals.

The browser talks to `/api/v1` through the Next.js same-origin proxy. Authentication mutations require an exact allowed `Origin`; missing Origin is rejected. CORS permits credentials only for exact configured origins. `SameSite=Lax` adds browser CSRF resistance but does not replace Origin checking. Non-browser clients must send an allowed Origin on these endpoints. Production requires HTTPS origins and Secure cookies. The API uses the socket address for IP limits and does not trust `X-Forwarded-For` until a named proxy trust boundary is configured. Redis atomic counters apply fixed-window limits: register 5/IP/hour, login 20/IP and 5/account/15 minutes, refresh 30/IP/5 minutes. Keys are HMAC pseudonyms. Redis failure denies sensitive authentication attempts with 503. Login failure messages are generic, including for unknown users; unknown-user attempts perform Argon2 work.

In the local Compose topology, proxied requests reach the API from the web container, so browser users share one IP bucket. That conservative limit is suitable for isolated local verification but could throttle unrelated users in a multi-user deployment. A deployment must define its trusted ingress and forward the client address through a narrowly trusted proxy boundary before relying on per-client IP limits. The API must continue to ignore arbitrary client-supplied `X-Forwarded-For` values.

The web app keeps access tokens in memory and restores state through the refresh cookie. It serializes refresh within a tab and uses Web Locks across tabs where supported. The server remains authoritative. Browsers without Web Locks can race across tabs and trigger replay revocation; users must sign in again. No token is stored in Web Storage.

## Alternatives and deferred work

Stateless access JWTs were rejected because revocation would take up to 10 minutes. Storing raw refresh tokens was rejected. `localStorage` token persistence was rejected. A Redis session cache is deferred because it complicates invalidation. Proxy-aware IP extraction and cross-browser multi-tab coordination need deployment-specific review. Password recovery and MFA are outside Phase 02.
