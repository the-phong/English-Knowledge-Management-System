# Phase 03 visual review

Captured on 2026-10-21 from the final EKMS production-mode web container at `http://127.0.0.1:3000`, using headless Chromium. The account identity in protected screenshots was a temporary `@example.test` test user deleted after the run. No password, access token, refresh token, or cookie value appears in these images.

| Screenshot | Width | Screen |
|---|---:|---|
| `desktop-landing-1440.png` | 1440px | Public landing |
| `desktop-login-1440.png` | 1440px | Login |
| `desktop-register-1440.png` | 1440px | Registration |
| `desktop-app-1280.png` | 1280px | Protected starting page |
| `desktop-account-1440.png` | 1440px | Account and sessions |
| `mobile-landing-375.png` | 375px | Public landing |
| `mobile-login-375.png` | 375px | Login |
| `mobile-register-390.png` | 390px | Registration |
| `mobile-app-375.png` | 375px | Protected starting page |
| `mobile-account-390.png` | 390px | Account and sessions |
| `tablet-account-768.png` | 768px | Account and sessions |

Visual inspection found legible headings, readable form fields, visible primary actions, useful whitespace, and mobile navigation with the brand above its two working links. Long temporary-account addresses wrap without horizontal scrolling. The account session rows and confirmation actions remain visible at narrow widths. No overlap, clipped action, or unintended horizontal overflow was found in the checked screenshots. The initial mobile header placed navigation above the brand; it was corrected before these final screenshots.

The browser script checked `/`, Login, Register, `/app`, and `/account` at 375, 390, 768, 1280, and 1440px: 25 layout checks passed. It ran nine axe-core WCAG A/AA scans with zero reported violations and observed zero page errors. It also exercised reload restoration, session revocation, logout-all, and protected-route denial. The script's keyboard checks covered form tab order and focus movement into session confirmation. Manual screenshot inspection supplements these automated checks; full WCAG conformance and other-browser support remain unverified.

Calculated foreground/background contrast ratios for core tokens: primary button 6.39:1, body 12.27:1, muted text on white 6.17:1, success 7.08:1, warning 6.93:1, error 6.92:1, info 7.10:1, disabled text 4.73:1. Values were calculated from the committed CSS hex tokens using the WCAG relative-luminance formula. These ratios are token-pair checks, not a complete pixel-level contrast audit.
