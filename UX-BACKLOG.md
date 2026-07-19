# UX backlog — reconciled

Merges two independent audits of the live Contabo demo plus what this
session's own investigation found and fixed along the way. Severity scale
follows both audits' convention: S0 blocking, S1 high, S2 medium, S3 low.

- **Audit A ("Antigravity")** — `C:\Users\37529\.gemini\antigravity\brain\acf42e70-2e5f-422d-a5ee-fd3c3898fa08\ux-audit\` — ISSUE-001..010, dated 2026-07-19 morning.
- **Audit B ("Cursor")** — `ux-audit/` in this repo — UX-01..06, dated 2026-07-19, read-only against production, taken after Audit A's remediation had already landed.

Where both audits describe the same underlying gap, the item is merged and
both IDs are cited.

## 🔴 Open

| ID(s) | Summary | Status |
|---|---|---|
| **A:ISSUE-010 (S3)** | Possible text/element crowding on tablet (1024×768) with the detail panel open. Not clearly reproduced in this session (only the `WORKFLOW: IN REVIEW` pill wraps to two lines) — low confidence either way, lowest priority in either audit. | Deferred. Re-check with the current build before spending effort. |

## 🟢 Resolved this session

| ID(s) | Fix | Commit |
|---|---|---|
| **A:ISSUE-001 (S0, full)** | Client acknowledgment checkbox (`05ccd05`) plus real server-side enforcement: `POST /api/releases/{id}/decisions` now rejects any non-assignment decision with `reviewedEvidence !== true` (`evidence_not_reviewed`, 400). e2e test posts directly to the API bypassing the UI to confirm the block holds. | this commit |
| **B:UX-01 (S1)** | Verdict banner now lists each blocking claim with its contradiction count as a clickable chip; clicking jumps to the Timeline tab and selects/scrolls to that claim's contradicting evidence. Backed by a new `blockingClaims` array computed in `evaluateVerdict()` (server) from data already derived for reason codes — no new schema. | this commit |
| **A:ISSUE-007 + B:UX-05 (S2)** | Export button label now includes the live verdict ("Export signed NO-GO record"); clicking it when the verdict isn't GO opens a confirm dialog stating the signature certifies data integrity, not ship readiness, before the download proceeds. | this commit |
| **B:UX-02 (S2)** | Evidence tab now sorts contradicts → missing → supports (newest first within each group) and shows a "N blocking contradictions shown first" summary line when any exist. | this commit |
| **B:UX-03 (S2)** | Mobile tab strip gets a right-edge fade mask (`mask-image`) signaling there's more to scroll to, distinct from the timeline day-grid's own auto-scroll-to-latest. | this commit |
| **B:UX-04 (S2)** | Audit events now render as a human sentence ("Jordan Lee generated a signed export") via a phrase map with a sensible fallback for unmapped actions, using an actor-name join added to the release snapshot query. Entries with a known target type (claim/evidence/decision/verdict run/export) are clickable and jump to that tab. | this commit |
| **A:ISSUE-004 (S1)** | Every timestamp (timeline chips, day headers, detail panel, audit list) now carries a `title` tooltip with the full date, year, and timezone via a new `formatFullTimestamp` helper. Visible short labels are unchanged. | this commit |
| **B:UX-06 (S3)** | Auth screen now shows a 3-step "claim → evidence → verdict" preview under the trust badges. | this commit |
| A:ISSUE-003 (S1) | Verdict-history strip (GO/NO-GO chips in order) on the Audit tab. | `6eb9528` |
| A:ISSUE-006 (S2) | Blocker owner/assignee, modeled as an append-only `decisions.type = "assignment"` record (not a mutable column — keeps the append-only guarantee intact). Timeline shows "Assigned to X" and a persistent Owner row on related events. | `6eb9528` |
| A:ISSUE-008 (S2) | Per-event-type status vocabulary (Supports/Contradicts/Missing, Approved/Rejected/Assigned, GO/NO-GO) replacing one overloaded "Verified/Contradicted" pair. | `6eb9528` |
| A:ISSUE-009 (S2) | Synchronous `if (busy) return` guard against double-submitting any creation dialog, on top of the existing `disabled={busy}`. | `05ccd05` |
| A:ISSUE-005 (S2) | **Not reproduced.** A real keyboard `Tab`-walk on production showed the workspace select, project buttons, and Sign out are the first 4 stops in tab order, all with a visible focus ring. Closed as invalid. | — |
| — | Focus-ring regression: `transition: .15s ease` (unqualified) on `.rt-primary`/`.rt-secondary`/`.rt-timeline-event` caused Chromium to fall back to its own default outline instead of the app's accent token on real keyboard focus. Found during this session's own verification, not in either audit. | `05ccd05` |
| — | e2e suite silently broken by the `role="tab"` accessibility change in a separate commit (`ce9be76`) — `getByRole("button", ...)` locators stopped matching. Found via live production diagnosis since Docker couldn't run the suite locally. | `7973f80` |
| — | Dead parallel design system (`src/styles.css` + `src/App.jsx`, ~2000 lines, unused since `ProductApp.jsx` replaced `App.jsx`) still loaded globally, silently overriding some focus-visible styling. Deleted. | `4a6d39d` |
| — | GPT-5.6 (`/api/analyze`) was fully built but unreachable: gated on a legacy single-tenant session system nothing in the current UI ever authenticates against, and never called from `ProductApp.jsx` at all. Wired into the timeline's "Assess with GPT-5.6" action, live-verified against the real OpenAI key. | `22d9a10` |

## Verification notes

Docker Desktop crashed repeatedly this session (three separate occasions)
while trying to start the local Postgres test database, so the e2e suite
could not be run locally for this batch either. Verified instead by:
`npx vitest run` (49/49), a clean `next build`, and live Playwright checks
against `https://release-truth.167.86.91.77.nip.io` after deploy. The new
e2e scenario for the S0 server enforcement is written and committed
(`tests/e2e/release-truth-hardening.spec.js`) for the next CI run or the
next time Docker cooperates.
