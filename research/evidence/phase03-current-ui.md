# Phase 03 current-state UI assessment

Date: 2026-10-21. Base: `dcb96502cdd02d0e96cbb9dd4b339c8dd57417ac`.

The official Google Docs UI Concept v0.1 was read from its native tab `04 · Giao diện toàn bộ`. It approves the seven-area visual direction as an initial MVP concept, allows later redesign, and treats sample data and decorative actions as illustration only. Chapter 8 requires presentation, UI state, API client, and backend authority boundaries.

- Working routes are `/`, `/auth`, `/app`, and `/account`. No business module route exists.
- `AuthProvider` and `auth-client.ts` isolate session restoration, JWT-in-memory handling, same-origin API requests, and server-authoritative navigation. These boundaries should remain intact.
- `ProtectedShell` withholds protected children until session restoration completes; it redirects anonymous users to `/auth`.
- `styles.css` contains a few palette variables but page-specific CSS, generic button/input rules, and repeated card/action treatments. There is no full semantic token scale or reusable UI component layer.
- Landing, auth, app, and account each construct their own layout. The protected pages have no shared navigation shell. Existing mobile rules cover only the centered page and session list.
- Auth and account provide basic labels, loading/error text, focus styles, and responsive form width. Account actions lack a confirmation step; the session error state can also show an empty-session message.
- Seven frontend tests cover auth flow, protected routing, session restoration, and foundation content. Existing tests use visible labels and behavior rather than CSS selectors, which supports a presentation redesign.

Implementation direction: central CSS tokens, a small reusable component layer, one responsive authenticated shell, and refreshed page composition. Existing auth contracts and backend remain unchanged. Future modules remain explanatory text until their functionality exists.
