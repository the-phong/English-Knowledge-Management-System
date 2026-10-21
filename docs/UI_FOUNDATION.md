# EKMS UI foundation

Phase 03 styles only the functional routes `/`, `/auth`, `/app`, and `/account`. The approved UI Concept v0.1 guides the initial presentation. Illustrative statistics, scores, and unavailable module actions are not rendered as live features.

## Token use

`apps/web/src/app/tokens.css` is the source for semantic theme values. Use `--color-foreground`, `--color-surface`, `--color-primary`, `--space-*`, `--radius-*`, and type-scale variables in component CSS. Keep contrast decisions in tokens so a future theme can replace the visual language without changing auth contracts. The current CSS convention uses `54rem` for authenticated mobile navigation and `45rem` for narrow single-column layouts; these thresholds are documented here for future components.

## Component inventory

| Component      | Purpose and current consumer             | States and accessibility                                                                     |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Button`       | Auth submit/switch and Account mutations | Primary, secondary, quiet, danger; disabled/loading; native button semantics and `aria-busy` |
| `TextField`    | Auth email/password                      | Explicit label; helper and field error IDs; `aria-invalid` and `aria-describedby`            |
| `Card`         | App and Account content grouping         | Plain, lavender, mint, peach surfaces; semantic section                                      |
| `Alert`        | Auth and Account feedback                | Text plus error/success/info/warning tone; alert/status role                                 |
| `LoadingState` | Session restoration and session list     | Textual live status and decorative spinner                                                   |
| `EmptyState`   | Empty Account session list               | Heading and explanation, not color alone                                                     |
| `PageHeader`   | App and Account headings                 | One page heading plus optional eyebrow, description, action                                  |
| `AppContainer` | Responsive content width                 | Shared max-width and fluid gutters                                                           |
| `Brand`        | Public, Auth and App shell identity      | Accessible home link with text identity                                                      |
| `AppShell`     | Protected App and Account layout         | One working navigation set, current-page indication, skip link, mobile layout                |

The component layer is presentation only. `AuthProvider` owns UI auth state, `auth-client.ts` owns same-origin API calls, and NestJS remains the security authority. Keep future module view models between these layers rather than adding scoring or ownership rules to components.

## Local verification

Run `pnpm --filter @ekms/web test`, `pnpm --filter @ekms/web typecheck`, and `pnpm --filter @ekms/web build`. The complete project commands remain in the root README. Browser screenshots and viewport observations are in `research/evidence/phase03-visual/`. Confirmations can be opened with Enter/Space and navigated by keyboard; the focus ring must remain visible.
