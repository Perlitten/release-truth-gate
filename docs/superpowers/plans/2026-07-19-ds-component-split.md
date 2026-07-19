# DS Component Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/ProductApp.jsx` (2565-line monolith) into a component library mirroring the Release Truth Design System taxonomy, plus a token layer, with zero behavior or pixel change.

**Architecture:** Verbatim extraction refactor. Each internal component and inline presentational block is relocated into a focused file under `src/components/<category>/`, `src/screens/`, or `src/lib/`, following the DS taxonomy (option A). State stays in the slimmed shell (`ProductApp.jsx`) and flows down via props. CSS `:root` moves to `src/styles/tokens/*`; all other `.rt-*` rules stay untouched in `src/styles/product.css`, loaded through one ordered `src/styles/index.css`.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, `@phosphor-icons/react` 2.1.10, plain global CSS, Vitest 4, Playwright 1.61.

## Global Constraints

Every task implicitly includes all of these:

- **No value changes.** No copy, layout, spacing, color, radius, font, or behavior change. Extraction is verbatim relocation of existing JSX/logic; only `import`/`export` wiring is added.
- **Icons:** keep `@phosphor-icons/react` SVG components. Never introduce the DS web-font `<i class="ph …">` Icon wrapper.
- **CSS:** global `.rt-*` classes only. No CSS modules, Tailwind, or CSS-in-JS. Do not rename classes or edit rule values.
- **Client boundary:** preserve `"use client"` — any file using React hooks or browser APIs starts with `"use client";`.
- **DS `.jsx` are reference only** (sandbox-adapted); do not copy them. Each extracted component's prop shape is cross-checked against the DS `.d.ts` of the same name in project `2875d8ca-0c45-4983-b3d1-c342c7d66de7` (read via DesignSync `get_file` when the prop shape is non-obvious).
- **No API/logic/data changes:** API routes, verdict engine, `src/data.js`, auth untouched.
- **Regression gate, not new tests:** the existing suite is the safety net. Do not add characterization tests. Each task ends green on `npm run test` (from `release-truth-gate/`).
- **Branch:** `refactor/ds-component-split`. One commit per task.

Reference files (read-only): the DS token sources — `tokens/colors.css`, `tokens/typography.css`, `tokens/foundations.css`, `tokens/fonts.css` — and DS `.d.ts` prop specs, in project `2875d8ca-0c45-4983-b3d1-c342c7d66de7`.

---

## Extraction procedure (applies to every component task)

For each component listed in a task:

1. Create the target file with `"use client";` (if it uses hooks/handlers/browser APIs).
2. Cut the component's function (or the identified inline JSX block, named per the task) from `src/ProductApp.jsx` **verbatim** — same JSX, same `className`, same phosphor imports, same logic.
3. Add the phosphor icon imports the component actually uses to the new file; remove now-unused icon imports from `ProductApp.jsx`.
4. `export` the component (named export matching the file name).
5. In `ProductApp.jsx` (and any other consumer already extracted), add `import { X } from "…";` and delete the inline definition.
6. Run the gate. Commit.

Verbatim means: if the block currently reads `<div className="rt-verdict-banner …">…</div>`, the extracted component returns exactly that markup for the same props. Prop names follow current closure variables; where a value came from an enclosing scope, it becomes a prop.

---

### Task 0: Token layer + CSS entry point

**Files:**
- Create: `src/styles/tokens/colors.css`, `src/styles/tokens/typography.css`, `src/styles/tokens/foundations.css`, `src/styles/tokens/fonts.css`
- Create: `src/styles/index.css`
- Move: `src/product.css` → `src/styles/product.css` (git mv)
- Modify: `app/layout.jsx:2` (change the CSS import)

**Interfaces:**
- Produces: the `:root` custom properties `--rt-ink, --rt-ink-soft, --rt-muted, --rt-border, --rt-surface, --rt-accent, --rt-danger, --rt-warning, --rt-success` (colors) and the DS foundation vars (`--rt-radius-*`, `--rt-shadow-*`, `--rt-transition`, `--rt-spin-duration`, `--rt-blur-*`) available globally before `product.css` loads.

- [ ] **Step 1: Create token files from the DS sources.**
  Read the four DS token files via DesignSync `get_file` (project `2875d8ca-0c45-4983-b3d1-c342c7d66de7`, paths `tokens/colors.css`, `tokens/typography.css`, `tokens/foundations.css`, `tokens/fonts.css`) and write each verbatim to `src/styles/tokens/`. `colors.css` must contain exactly the 9 `:root` vars currently on line 1 of `src/product.css` (do not invent new tokens). `fonts.css` must reference `@fontsource-variable/inter` as already wired, not a vendored woff2 path.

- [ ] **Step 2: Move product.css and strip its `:root`.**
  `git mv src/product.css src/styles/product.css`. Delete line 1 (the `:root{…}` block) from `src/styles/product.css` — it now lives in `tokens/colors.css`. Leave every other line byte-identical.

- [ ] **Step 3: Create the ordered entry point.**
  `src/styles/index.css`:
  ```css
  @import "./tokens/fonts.css";
  @import "./tokens/colors.css";
  @import "./tokens/typography.css";
  @import "./tokens/foundations.css";
  @import "./product.css";
  ```

- [ ] **Step 4: Rewire the layout import.**
  In `app/layout.jsx`, replace `import "../src/product.css";` with `import "../src/styles/index.css";`. Keep `import "@fontsource-variable/inter";` on line 1.

- [ ] **Step 5: Gate.**
  Run: `npm run test`
  Expected: PASS (same test count as before; no snapshot/behavior change).
  Then `npm run dev` and confirm the app renders (auth screen paints with paper background, teal accents) — token split changed nothing visually.

- [ ] **Step 6: Commit.**
  ```bash
  git add -A && git commit -m "refactor(styles): extract token layer and single CSS entry point"
  ```

---

### Task 1: core/ components

**Files:**
- Create: `src/components/core/Logo.jsx`, `Kicker.jsx`, `Button.jsx`, `Badge.jsx`, `StateChip.jsx`, `Avatar.jsx`, `DemoBadge.jsx`
- Modify: `src/ProductApp.jsx` (remove `SubmitButton` at :247; replace inline logo/kicker/badge/state/avatar/demo-badge markup)

**Interfaces:**
- Produces:
  - `Button({ variant = "primary", busy = false, type = "button", disabled, onClick, children, ...rest })` — renders `.rt-primary`/`.rt-secondary`; when `busy`, shows `<SpinnerGap className="rt-spin"/>` and disables (absorbs the current `SubmitButton` at :247).
  - `Logo({ large = false })` → `.rt-logo` tile with fill-weight `Sparkle`.
  - `Kicker({ children })` → `.rt-kicker`.
  - `Badge`, `StateChip` → the pill/`.rt-state` markup currently inline in records/release head (cross-check `components/core/Badge.d.ts`, `StateChip.d.ts`).
  - `Avatar({ initials })` → `.rt-avatar`. `DemoBadge()` → `.rt-demo-badge`.

- [ ] **Step 1: Extract `Button`.** Follow the Extraction procedure. Move `SubmitButton` (ProductApp.jsx:247) logic into `Button` with a `busy` prop; also fold the two inline button styles (`.rt-primary`, `.rt-secondary`) so callers use `<Button variant=…>`. Replace every `<button className="rt-primary…">`/`rt-secondary` and `<SubmitButton>` usage with `<Button>`. Keep exact classes, `min-height`, gap, spinner.

- [ ] **Step 2: Extract the remaining leaf presentational components** (`Logo`, `Kicker`, `Badge`, `StateChip`, `Avatar`, `DemoBadge`) per the Extraction procedure, replacing their inline markup in `ProductApp.jsx`. Where prop shape is non-obvious, read the matching DS `.d.ts` first.

- [ ] **Step 3: Gate.** Run: `npm run test` → Expected: PASS.

- [ ] **Step 4: Commit.**
  ```bash
  git add -A && git commit -m "refactor(core): extract Button, Logo, Kicker, Badge, StateChip, Avatar, DemoBadge"
  ```

---

### Task 2: forms/ components

**Files:**
- Create: `src/components/forms/Field.jsx`, `FieldRow.jsx`, `Check.jsx`, `CheckboxList.jsx`, `ErrorMessage.jsx`, `Notice.jsx`, `Form.jsx`
- Modify: `src/ProductApp.jsx` (remove `Field` at :163; replace inline `.rt-field-row`, `.rt-check`, `.rt-checkbox-list`, `.rt-error`, `.rt-notice`, `.rt-form` markup)

**Interfaces:**
- Consumes: `Button` (Task 1) inside forms where submit buttons appear.
- Produces:
  - `Field({ label, hint, children })` — verbatim from ProductApp.jsx:163 (`.rt-field` + uppercase `<span>` label + `small` hint).
  - `FieldRow({ children })` → `.rt-field-row`. `Check({ label, ...inputProps })` → `.rt-check`.
  - `CheckboxList({ detailed = false, children })` → `.rt-checkbox-list`(`-detailed`).
  - `ErrorMessage({ children })` → `.rt-error` (with `WarningCircle`). `Notice({ children })` → `.rt-notice`.
  - `Form({ compact = false, onSubmit, children })` → `<form className="rt-form">`.

- [ ] **Step 1: Extract `Field` verbatim** (ProductApp.jsx:163) into `forms/Field.jsx`; replace all inline `.rt-field` usages that already used the `Field` function with the import.

- [ ] **Step 2: Extract the remaining form primitives** (`FieldRow`, `Check`, `CheckboxList`, `ErrorMessage`, `Notice`, `Form`) per the Extraction procedure, cross-checking DS `.d.ts` for prop names. Replace inline markup in auth, creation/team/github dialogs.

- [ ] **Step 3: Gate.** Run: `npm run test` → Expected: PASS.

- [ ] **Step 4: Commit.**
  ```bash
  git add -A && git commit -m "refactor(forms): extract Field, FieldRow, Check, CheckboxList, ErrorMessage, Notice, Form"
  ```

---

### Task 3: feedback/ + records/ components

**Files:**
- Create: `src/components/feedback/Dialog.jsx`, `EmptyState.jsx`, `VerdictBanner.jsx`, `MetricCard.jsx`, `VerdictHistory.jsx`
- Create: `src/components/records/RecordSection.jsx`, `RecordCard.jsx`, `AuditTrail.jsx`
- Modify: `src/ProductApp.jsx` (remove `Dialog` :173, `RecordSection` :1045, `EmptyState` :1061; extract inline `.rt-verdict-banner`, `.rt-metrics article`, `.rt-verdict-history`, `.rt-record`, `.rt-audit-list` blocks from `ReleaseWorkspace`)

**Interfaces:**
- Consumes: `Button` (Task 1).
- Produces:
  - `Dialog({ title, eyebrow, wide = false, onClose, children })` — verbatim from :173 (backdrop, focus trap, Escape, focus return — preserve exactly).
  - `EmptyState({ icon, title, body, action, actionLabel })` — verbatim from :1061 (`icon` is a phosphor component).
  - `VerdictBanner({ verdict, blockers, onBlockerClick })` → `.rt-verdict-banner.<verdict>` grid (cross-check `feedback/VerdictBanner.d.ts`).
  - `MetricCard({ tone, label, value, hint, icon })` → `.rt-metrics article.<tone>`.
  - `VerdictHistory({ entries })` → `.rt-verdict-history` chips.
  - `RecordSection({ title, description, action, actionLabel, children })` — verbatim from :1045.
  - `RecordCard({ relation, title, tag, body, meta, hash, sourceHref })` → `.rt-record` (relation ∈ supports|contradicts|missing).
  - `AuditTrail({ entries, onJump })` → `.rt-audit-list`.

- [ ] **Step 1: Extract the three existing functions verbatim** (`Dialog` :173, `RecordSection` :1045, `EmptyState` :1061) into their files; wire imports.

- [ ] **Step 2: Extract the inline presentational blocks** from `ReleaseWorkspace` into `VerdictBanner`, `MetricCard`, `VerdictHistory`, `RecordCard`, `AuditTrail`, keyed by their `.rt-*` classes. Each becomes a component taking the data currently read from closure as props; `ReleaseWorkspace` now maps its data to these components. Cross-check each DS `.d.ts`.

- [ ] **Step 3: Gate.** Run: `npm run test` → Expected: PASS. Manually verify the Nova 2.4 release still shows the NO-GO banner + 1 blocker.

- [ ] **Step 4: Commit.**
  ```bash
  git add -A && git commit -m "refactor(feedback,records): extract Dialog, EmptyState, VerdictBanner, MetricCard, VerdictHistory, RecordSection, RecordCard, AuditTrail"
  ```

---

### Task 4: timeline/ + navigation/ components

**Files:**
- Create: `src/components/timeline/TimelineBoard.jsx`, `TimelineDetail.jsx`, `AIAssessment.jsx`
- Create: `src/components/navigation/Sidebar.jsx`, `ProjectBar.jsx`, `Tabs.jsx`, `ReleasePicker.jsx`
- Create: `src/lib/timeline-constants.js` (holds `TIMELINE_LANES` :1076, `TIMELINE_STATUS` :1083, `LANE_TO_FOCUS` :1132)
- Modify: `src/ProductApp.jsx` (split `TimelineTab` :1192 into board/detail/AI; split sidebar/project-bar/tabs/release-picker markup out of `ProductShell` :2042 and `ReleaseWorkspace` :1534)

**Interfaces:**
- Consumes: `StateChip`, `Button` (Tasks 1), `AuditTrail`/`RecordCard` where reused.
- Produces:
  - `TimelineBoard({ lanes, days, events, selectedId, onSelect })` → `.rt-timeline-board` grid + legend.
  - `TimelineDetail({ event })` → sticky `.rt-timeline-detail` rail (status class from event).
  - `AIAssessment({ state, result, onRun })` → `.rt-ai-panel`/`.rt-ai-result` (LIVE · NOT STORED; persistent error state; no model-owned verdict — preserve exactly).
  - `Sidebar({ user, workspace, workspaces, projects, activeProjectId, onSelectProject, onSignOut, … })` → `.rt-sidebar`.
  - `ProjectBar({ breadcrumb, releases, selectedReleaseId, onSelectRelease })` → sticky `.rt-project-bar`.
  - `Tabs({ tabs, active, onChange })` → `.rt-tabs`.
  - `ReleasePicker({ releases, onPick })` → `.rt-release-picker`.

- [ ] **Step 1: Extract timeline constants** (`TIMELINE_LANES`, `TIMELINE_STATUS`, `LANE_TO_FOCUS`) into `src/lib/timeline-constants.js`; import where used.

- [ ] **Step 2: Split `TimelineTab`** (:1192) into `TimelineBoard` + `TimelineDetail` + `AIAssessment`. `TimelineTab` may remain as a thin composer in `screens/` (Task 5) or be inlined into `ReleaseWorkspace`; here just extract the three presentational pieces and have `TimelineTab` render them.

- [ ] **Step 3: Extract navigation** (`Sidebar`, `ProjectBar`, `Tabs`, `ReleasePicker`) from `ProductShell`/`ReleaseWorkspace` by their `.rt-*` classes, passing current closure data as props.

- [ ] **Step 4: Gate.** Run: `npm run test` → Expected: PASS. Verify timeline event selection updates the detail rail and the AI panel triggers.

- [ ] **Step 5: Commit.**
  ```bash
  git add -A && git commit -m "refactor(timeline,navigation): extract board/detail/AI and sidebar/project-bar/tabs/release-picker"
  ```

---

### Task 5: screens/ + dialogs/

**Files:**
- Create: `src/screens/AuthScreen.jsx`, `EmptyWorkspace.jsx`, `ReleaseWorkspace.jsx`
- Create: `src/components/dialogs/CreationDialog.jsx`, `TeamDialog.jsx`, `GitHubDialog.jsx`
- Create: `src/lib/audit-constants.js` (holds `EVIDENCE_RELATION_PRIORITY` :103, `AUDIT_ACTION_PHRASES` :111, `AUDIT_TARGET_TAB` :134)
- Modify: `src/ProductApp.jsx` (remove `AuthScreen` :255, `EmptyWorkspace` :397, `CreationDialog` :437, `TeamDialog` :739, `GitHubDialog` :852, `ReleaseWorkspace` :1534)

**Interfaces:**
- Consumes: everything from Tasks 1–4 (core, forms, feedback, records, timeline, navigation).
- Produces:
  - `AuthScreen({ invitation, bootError, onAuthenticated })` — verbatim from :255, now composing `forms/*`, `core/*`.
  - `EmptyWorkspace({ user, onCreate })` — verbatim from :397.
  - `ReleaseWorkspace({ … })` — composes `VerdictBanner`, `MetricCard`, `Tabs`, `TimelineBoard/Detail/AIAssessment`, `RecordSection/RecordCard`, `AuditTrail`, `VerdictHistory`.
  - `CreationDialog`, `TeamDialog`, `GitHubDialog` — verbatim from :437/:739/:852, composing `feedback/Dialog` + `forms/*`.

- [ ] **Step 1: Extract audit constants** into `src/lib/audit-constants.js`; import where used.

- [ ] **Step 2: Extract the three dialogs** (`CreationDialog`, `TeamDialog`, `GitHubDialog`) verbatim into `components/dialogs/`, each composing `Dialog` + form primitives.

- [ ] **Step 3: Extract the three screens** (`AuthScreen`, `EmptyWorkspace`, `ReleaseWorkspace`) verbatim into `src/screens/`, wiring imports to Tasks 1–4 components.

- [ ] **Step 4: Gate.** Run: `npm run test` → Expected: PASS. Exercise: create dialog opens/validates, team dialog invite link, github import dialog.

- [ ] **Step 5: Commit.**
  ```bash
  git add -A && git commit -m "refactor(screens,dialogs): extract Auth/EmptyWorkspace/ReleaseWorkspace and Creation/Team/GitHub dialogs"
  ```

---

### Task 6: Slim the shell + final verification

**Files:**
- Modify: `src/ProductApp.jsx` (reduce to state + screen routing)

**Interfaces:**
- Consumes: `AuthScreen`, `EmptyWorkspace`, `ReleaseWorkspace`, `Sidebar`, `ProjectBar` (Tasks 4–5).
- Produces: default export `ProductApp` (unchanged public entry used by `app/page.jsx`).

- [ ] **Step 1: Reduce `ProductApp.jsx`** to: imports, top-level state/effects/data-fetching, and the `ProductShell` render that routes between boot/auth/onboarding/app screens. No presentational JSX beyond the shell scaffold (`.rt-app` grid, `Sidebar`, `ProjectBar`, `.rt-main`). Confirm no orphaned inline component definitions or unused phosphor imports remain.

- [ ] **Step 2: Full behavior gate.**
  Run: `npm run check`
  Expected: PASS (vitest + prod audit + worker build + verify all green).
  Run: `npm run test:e2e`
  Expected: PASS (Playwright production paths + security headers).

- [ ] **Step 3: Visual QA.**
  Launch the app (`npm run dev` or Cloudflare preview) and screenshot: auth, timeline (Nova 2.4 NO-GO), overview, creation/team/GitHub dialogs, AI panel, and the 390px mobile layout. Diff against `../prod-*.png` / `../release-truth-prod-*.png`. Expected: zero intended difference.

- [ ] **Step 4: Import-hygiene check.**
  Run: `grep -rn "function \(Field\|Dialog\|AuthScreen\|CreationDialog\|TeamDialog\|GitHubDialog\|RecordSection\|EmptyState\|TimelineTab\|ReleaseWorkspace\)" src/ProductApp.jsx`
  Expected: no matches (all extracted).

- [ ] **Step 5: Commit.**
  ```bash
  git add -A && git commit -m "refactor(shell): slim ProductApp to state + screen routing; final gate"
  ```

---

## Self-review (spec coverage)

- Token layer + `styles/index.css` → Task 0. ✔
- core/forms/feedback/records/timeline/navigation/dialogs/screens → Tasks 1–5, names match spec tree. ✔
- `lib/` constants relocation → Tasks 4 (timeline) + 5 (audit). ✔
- Slim shell → Task 6. ✔
- Keep phosphor SVG / global `.rt-*` / `"use client"` / no value change → Global Constraints, enforced per task. ✔
- Verification: `npm run test` per task; `npm run check` + `test:e2e` + visual QA in Task 6. ✔
- `ReleaseContext` — deferred per spec; introduce only if prop-drilling in Task 4/5 exceeds ~6 threaded values (worker's judgment, noted in the task's commit if used). ✔
- Delegation: per-task extraction is a natural Codex-worker unit; main agent runs gates + commits. ✔
