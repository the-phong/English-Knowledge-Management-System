# ADR 0005 — UI foundation and replaceable presentation

Date: 2026-10-21. Status: accepted for Phase 03 implementation.

## Context

UI Concept v0.1 is the approved initial visual direction and may later be redesigned. Chapter 8 keeps presentation, UI state, API clients, and backend authority separate. Phase 02 already provides working authentication and session boundaries. Phase 03 needs a coherent interface for the four available routes without suggesting that future learning modules already operate.

## Decision

- Use CSS custom properties in `apps/web/src/app/tokens.css` for semantic colors, typography, spacing, radii, shadows, widths, and motion. Consuming CSS refers to semantic tokens. The reference blue `#4E77F4` remains a visual accent; the darker primary `#3156C7` provides stronger contrast for white button text.
- Keep one CSS styling system. `styles.css` defines compositional page and component classes; React components supply semantic structure and typed states. No UI framework or remote font dependency is added. The system font stack supports English and longer Vietnamese text without a network request.
- Use a compact internal component layer for Button, TextField, Card, Alert, LoadingState, EmptyState, PageHeader, AppContainer, Brand, and AppShell. These components hold presentation behavior only. `AuthProvider`, `auth-client.ts`, shared contracts, and NestJS remain unchanged.
- Use one authenticated navigation structure with only working `/app` and `/account` routes. It is a desktop rail and a horizontal touch-friendly navigation on narrow screens. Future Vocabulary, Writing, Learning, Progress, and Dashboard features remain descriptive, non-interactive text until implemented.
- Use inline, keyboard-reachable confirmation panels for session revocation and logout-all. Focus moves to the confirm action when opened and returns to the trigger or session heading when closed. This avoids adding a dialog dependency for the current two confirmation flows.
- Apply visible focus, associated input errors, textual status, 44px minimum control height, reduced-motion support, and responsive layouts. Target WCAG 2.2 AA for implemented patterns; automated tests and local browser review do not constitute a complete conformance audit.

## Alternatives considered

A large UI framework would increase bundle and styling complexity for four existing routes. Tailwind or another parallel styling system would duplicate the existing CSS approach. A modal dialog library would add a dependency for two short confirmations. Hosted fonts would add a runtime request and a possible failure point. These remain options for a future approved redesign if requirements justify them.

## Consequences

Most visual redesigns can change tokens, components, layout, and page composition while retaining the existing auth API and backend rules. Workflow or API changes still require normal product and architecture review. The current system deliberately has no dark theme and no active links to unavailable modules. Browser compatibility beyond the tested Chromium environment remains to be verified later.
