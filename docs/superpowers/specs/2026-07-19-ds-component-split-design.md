# Design: split ProductApp monolith into a design-system component library

Date: 2026-07-19
Status: approved (structure option A — mirror the design system taxonomy)
Branch: `refactor/ds-component-split`

## Goal

Refactor `src/ProductApp.jsx` (2565 lines, 13 co-located components) into a
componentized library whose folder taxonomy mirrors the **Release Truth Design
System** (claude.ai/design project `2875d8ca-0c45-4983-b3d1-c342c7d66de7`), and
extract the CSS `:root` variables into a dedicated token layer.

This is a **behavior- and pixel-preserving refactor**. Success = identical
rendered UI and identical behavior, verified by the existing test ladder plus a
visual QA pass. No feature, copy, API, styling-value, or logic change.

## Context / ground truth

- The design system was **built from this app**: the DS file `product/app.css`
  is `src/product.css` lifted verbatim (only `:root` moved to `tokens/colors.css`
  and 4 descendant-`span` selectors hardened to child combinators, plus an
  icon-font adaptation block that does **not** apply to the app). So there is no
  visual gap to close — the value delivered here is structural (maintainability,
  reuse, a real token layer), not cosmetic.
- The DS defines the target component taxonomy and names (its `components/`,
  `templates/`, `tokens/` trees). We follow those names.
- Stack: Next.js 16, React 19, plain global CSS (no Tailwind, no CSS modules),
  icons via `@phosphor-icons/react@^2.1.10` (real SVG components).

## Non-goals

- No switch to CSS modules, Tailwind, or CSS-in-JS. Global `.rt-*` classes stay.
- No adoption of the DS web-font `<i class="ph …">` Icon wrapper (that is a
  sandbox-only adaptation; the app keeps `@phosphor-icons/react` SVGs).
- No verbatim copy of the DS `.jsx` files (sandbox-adapted). They are a
  **structural reference only**; working React is extracted from the monolith.
- No changes to API routes, the verdict engine, data layer, auth, or `src/data.js`.
- No behavior, copy, layout, spacing, color, or radius value changes.

## Current state — monolith inventory (`src/ProductApp.jsx`)

Components (line = declaration):

| Component        | Line | Approx size |
|------------------|------|-------------|
| `Field`          | 163  | small |
| `Dialog`         | 173  | small |
| `SubmitButton`   | 247  | small |
| `AuthScreen`     | 255  | ~140 |
| `EmptyWorkspace` | 397  | ~40 |
| `CreationDialog` | 437  | ~300 |
| `TeamDialog`     | 739  | ~110 |
| `GitHubDialog`   | 852  | ~190 |
| `RecordSection`  | 1045 | small |
| `EmptyState`     | 1061 | small |
| `TimelineTab`    | 1192 | ~342 |
| `ReleaseWorkspace` | 1534 | ~508 |
| `ProductShell`   | 2042 | ~523 |

Shared module-level constants to relocate: `EVIDENCE_RELATION_PRIORITY` (103),
`AUDIT_ACTION_PHRASES` (111), `AUDIT_TARGET_TAB` (134), `TIMELINE_LANES` (1076),
`TIMELINE_STATUS` (1083), `LANE_TO_FOCUS` (1132).

Icon set imported (24): ArrowClockwise, ArrowRight, BracketsCurly, CaretDown,
CheckCircle, ClipboardText, ClockCounterClockwise, Database, DownloadSimple,
Flask, Folder, GithubLogo, LockKey, Plus, RocketLaunch, Scales, ShieldCheck,
SignOut, Sparkle, SpinnerGap, UserPlus, UsersThree, WarningCircle, X, XCircle.

CSS: `src/product.css` (196 lines) — line 1 is the `:root` token block; the rest
is component styles. Imported once from `app/layout.jsx` alongside
`@fontsource-variable/inter`.

## Target structure

```
src/
  styles/
    index.css         # single ordered entry: @imports tokens/* then product.css
    tokens/
      colors.css        # :root color vars (from DS tokens/colors.css)
      typography.css    # type scale / weight vars (from DS tokens/typography.css)
      foundations.css   # radii, shadows, motion, blur vars (DS tokens/foundations.css)
      fonts.css         # @font-face / Inter wiring (DS tokens/fonts.css)
    product.css         # component styles; hardcoded values kept, tokens referenced where DS already does
  components/
    core/        Logo, Kicker, Button, Badge, StateChip, Avatar, DemoBadge
    forms/       Field, FieldRow, Check, CheckboxList, ErrorMessage, Notice, Form
    feedback/    Dialog, EmptyState, VerdictBanner, MetricCard, VerdictHistory
    records/     RecordSection, RecordCard, AuditTrail
    timeline/    TimelineBoard, TimelineDetail, AIAssessment
    navigation/  Sidebar, ProjectBar, Tabs, ReleasePicker
    dialogs/     CreationDialog, TeamDialog, GitHubDialog
  screens/       AuthScreen, EmptyWorkspace, ReleaseWorkspace
  lib/           timeline-constants.js, audit-constants.js, (existing helpers stay)
  ProductApp.jsx # slim ProductShell: state orchestration + screen routing
```

Notes:
- `Button` absorbs the current `.rt-primary` / `.rt-secondary` styling and the
  `SubmitButton` busy/spinner behavior via a `busy` prop.
- `core/` components that do not exist as standalone functions in the monolith
  today (Logo, Kicker, Badge, StateChip, Avatar, DemoBadge) are currently inline
  markup + `.rt-*` classes; they are extracted into thin presentational
  components with the same markup and classes.
- `dialogs/` holds the three app-specific feature dialogs; the generic `Dialog`
  shell lives in `feedback/`.

## Key decisions

1. **Icons**: keep `@phosphor-icons/react`. Do not introduce the DS web-font Icon.
2. **CSS**: keep global `.rt-*` classes and exact values; only split `:root`
   into `styles/tokens/*` and keep the rest in `styles/product.css`. A single
   `src/styles/index.css` `@import`s `tokens/colors.css`, `tokens/typography.css`,
   `tokens/foundations.css`, `tokens/fonts.css` (in that order) then
   `product.css`; `app/layout.jsx` imports only `../src/styles/index.css` in
   place of the current `../src/product.css`.
3. **Reference, not copy**: extract React from the monolith; use DS `.jsx` /
   `.prompt.md` only to confirm component boundaries and prop shapes.
4. **State**: stays in the shell (`ProductApp.jsx`). Components receive data and
   callbacks via props. Introduce a small `ReleaseContext` only if prop-drilling
   through `ReleaseWorkspace` → tabs becomes unwieldy; decided during the plan.
5. **`"use client"`**: preserved — extracted client components keep the directive
   where React hooks / browser APIs are used.

## Incremental plan (leaf-first, verified per layer, one commit per layer)

1. **Tokens + scaffold**: create `styles/tokens/*` from DS token files, move
   `:root` out of `product.css`, wire imports. No component moves yet.
   Gate: app renders unchanged; `npm run test`.
2. **core/ + forms/**: extract leaf components (Button, Badge, StateChip, Logo,
   Kicker, Avatar, DemoBadge, Field, FieldRow, Check, CheckboxList, ErrorMessage,
   Notice, Form). Gate: `npm run test`.
3. **feedback/ + records/ + timeline/ + navigation/**: Dialog, EmptyState,
   VerdictBanner, MetricCard, VerdictHistory, RecordSection, RecordCard,
   AuditTrail, TimelineBoard/Detail/AIAssessment, Sidebar, ProjectBar, Tabs,
   ReleasePicker. Split `TimelineTab` and the presentational parts of
   `ReleaseWorkspace`/`ProductShell` here. Gate: `npm run test`.
4. **screens/ + dialogs/**: AuthScreen, EmptyWorkspace, ReleaseWorkspace,
   CreationDialog, TeamDialog, GitHubDialog. Gate: `npm run test`.
5. **Slim shell**: reduce `ProductApp.jsx` to state + screen routing. Final gate:
   `npm run check` + `npm run test:e2e` + visual QA.

Bulk extraction is delegated to the Codex worker with tight per-layer boundaries
(explicit file list, "no value changes", output schema); the validation ladder,
integration, and commits are done by the main agent.

## Verification

- **Behavior**: `npm run test` (vitest) after every layer; `npm run check`
  (test + prod audit + worker build + verify) and `npm run test:e2e` (Playwright)
  at the end. Any red gate blocks the commit for that layer.
- **Visual**: capture auth, timeline (Nova 2.4 NO-GO), overview, creation/team/
  GitHub dialogs, AI panel, and the 390px mobile layout; diff against existing
  `prod-*.png` / `release-truth-prod-*.png` references. Zero intended diff.
- **Import hygiene**: no remaining imports from the old monolith paths; no dead
  code left in `ProductApp.jsx`.

## Risks & mitigations

- **Shared state / prop-drilling** (ReleaseWorkspace ↔ tabs ↔ dialogs): mitigate
  with a scoped `ReleaseContext` if props exceed ~6 threaded values.
- **Volume of mechanical edits** (2565 lines): delegate per-layer to the worker,
  keep layers small, run vitest between layers to localize regressions.
- **Hydration boundaries**: keep `"use client"` on interactive components; verify
  no server/client boundary is crossed by an extraction.
- **CSS import order**: tokens must load before `product.css`; enforce a single
  ordered entry point.

## Out of scope / follow-ups

- Full tokenization of every hardcoded hex in `product.css` (beyond what the DS
  already tokenizes) — optional later pass.
- Pushing any refined components back up to the design-system project via
  DesignSync `/design-sync` — separate task if desired.
