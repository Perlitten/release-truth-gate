# Design QA

## Ground truth and artifacts

- Source: `design-reference.png`
- Desktop: `qa-desktop-2026-07-18.png`
- Tablet: `qa-tablet-2026-07-18.png`
- Mobile: `qa-mobile-2026-07-18.png`
- Source/implementation comparison: `qa-comparison-2026-07-18.png`
- Live AI state: `qa-ai-2026-07-18.png`

The source and implementation were compared side by side at the same 1536 × 1024 viewport and selected privacy-conflict state. The existing visual system, lane hierarchy, typography, borders, status language, and Phosphor icon set were retained.

## Measured viewports

- Desktop 1536 × 1024: the selected blocker, exact source excerpt, and all core actions are visible in the fixed detail panel.
- Tablet 1024 × 768: document width equals viewport width; the detail panel becomes an inline first section and the timeline remains independently scrollable.
- Mobile 390 × 844: document width equals viewport width; all five navigation controls fit, have accessible names, and the timeline scrolls horizontally to the current evidence head.

## Functional checks

- Timeline event selection updates the detail panel.
- Summary, Evidence, Risks, and Decisions open the expected records.
- Exact-revision search returns the one matching source.
- Compare revisions shows the exact approved and current excerpts.
- A review proposal appends a scoped decision while evidence remains contradicted and the verdict remains `NO-GO`.
- The gate explanation dialog supports focus trapping, Escape, and focus return.
- Live AI review returned HTTP 200, `LIVE · NOT STORED`, four grounded citations, model metadata, and no model-owned verdict.
- AI failure is a persistent error state; no demo assessment replaces it.
- Export includes all evidence content and a SHA-256 checksum with an explicit non-signature warning.
- Share produces a schema-validated URL-fragment snapshot.

## Visual decisions

- The stricter `NO-GO` banner is intentional and follows the deterministic policy.
- Unknown/no-change states are neutral `Unproven`, not green.
- One causal privacy conflict is displayed as one deduplicated blocker with two current evidence sources.
- The synthetic dataset and browser-local decision limitations are visible in the interface.

## Runtime checks

- Application console errors: 0. Grammarly and 1Password extension messages were excluded as browser-extension noise.
- `/api/analyze`: HTTP 200 with validated and grounded structured output.
- Unit/security/schema test suite and exact Worker build are gated by `npm run check`.
- A clean `npm ci` and the moderate-or-higher production audit complete with zero known vulnerabilities.
- Production browser paths and security headers are covered by `npm run test:e2e`.
- Local Cloudflare preview smoke on `http://localhost:8787` passed after `npm run preview:e2e`: root `200`, CSP nonce present, no `unsafe-inline`/`unsafe-eval`, `X-Frame-Options: DENY`, session gate enabled, access POST `200`, signed cookie replay authenticated.

## Remaining production prerequisites

No unresolved visual or code-level P0/P1 defect was found in the audited demo. Multi-user identity, server-side append-only signed persistence, real source connectors, and accessible production deployment are external production prerequisites rather than claims made by this demo.
