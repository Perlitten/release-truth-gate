# Release Truth — demo video script

Target: 2:40–2:55 total (hard ceiling 3:00). Screen recording of
`https://release-truth.167.86.91.77.nip.io` in a clean browser window,
1440×900 or larger. Voiceover recorded separately or live — pace notes
assume roughly 150 words/minute; read a little slower than feels natural,
it always sounds faster on tape.

Before recording: reload the page once so the timeline auto-scroll and
animations run fresh, and close any browser extensions that inject UI
(password managers etc. — they show up as stray icons in recordings).

---

## 0:00–0:15 — Hook (landing page, no clicks yet)

**Screen:** Land on the auth screen. Let the hero text sit for a beat before
talking.

**Voiceover:**
> "Teams ship releases based on a green checkmark and a gut feeling.
> Release Truth is an evidence gate: every release claim has to be backed
> by current code, current tests, and a human decision — or the server
> itself blocks the ship."

## 0:15–0:30 — Enter the demo

**Screen:** Click **"Explore the Nova 2.4 demo"**. Wait for the timeline to
load and auto-scroll to the latest day.

**Voiceover:**
> "This is a live release, seeded with a real conflict: a telemetry
> refactor that quietly broke a privacy promise."

## 0:30–1:05 — The timeline tells the story

**Screen:** Point out, in order: the red **SERVER VERDICT · NO-GO** banner
at the top, then the four lanes (Claim / Code / Tests / Decisions), then
click the **"Current privacy boundary test"** card (red, CONTRADICTS).

**Voiceover:**
> "The verdict isn't a status someone typed in — it's computed server-side
> from the evidence ledger every time. Here's why it's NO-GO: the current
> privacy test is failing. Selecting it shows exactly why — the source,
> the revision, the confidence, and the excerpt: the telemetry payload now
> includes message text, which directly contradicts the claim."

## 1:05–1:40 — GPT-5.6 does the reasoning, not the deciding

**Screen:** With that event still selected, click **"Assess with GPT-5.6"**.
Let the live response render fully before moving on.

**Voiceover:**
> "This is where GPT-5.6 comes in. It reads the claim and the full
> evidence set — not just this one test — and returns a grounded
> assessment: what contradicts, what it supersedes, what's still missing,
> and a recommended fix. Every citation is a verified exact quote from the
> evidence; the model never sees or touches the actual verdict. That's
> still a deterministic policy engine on the server. GPT-5.6 explains the
> evidence — it doesn't get a vote."

## 1:40–2:05 — A blocker gets an owner, a decision gets a real review

**Screen:** Open **"Record decision"**. Show the **evidence considered**
checklist with the excerpt text visible, then the **required
acknowledgment checkbox** — try to submit without it checked to show it's
blocked, then check it and submit. (Optional, if time allows: show
assigning the blocker to a teammate instead, via the "Assign to a
teammate for resolution" decision type.)

**Voiceover:**
> "Reviewers can't sign off blind. The form shows the actual evidence
> content, not just a title, and won't submit until you confirm you've
> read it. Blockers can also be assigned directly to a teammate to fix —
> that ownership shows up anywhere this claim appears on the timeline."

## 2:05–2:30 — Re-run, export, verify

**Screen:** Click **"Run verdict"**, then **"Signed export"**. If quick to
show, paste the downloaded JSON into `/api/exports/verify` (or just state
it) and mention tamper detection.

**Voiceover:**
> "Every decision is append-only — nothing is edited in place, only
> superseded. The verdict recalculates from the live ledger, and the
> signed export is Ed25519-signed by the server: change one byte of the
> verdict and verification fails. This is a real Postgres-backed,
> multi-user, role-based product — reviewer, contributor, admin, owner —
> not a static mockup."

## 2:30–2:50 — Close

**Screen:** Back to the timeline overview, verdict banner in frame.

**Voiceover:**
> "Release Truth: don't ship on vibes. Show the evidence, let the model
> explain it, and let the server decide. Built with Codex and GPT-5.6 —
> link and repo in the description."

---

## Shot list (quick reference)

1. Auth screen (idle 2–3s)
2. Click demo button → timeline loads
3. NO-GO banner in frame
4. Click contradicted test event → detail panel
5. Click "Assess with GPT-5.6" → full response visible
6. Open Record decision → evidence excerpts visible → blocked submit →
   checked submit
7. (Optional) Assign to teammate → owner shown on timeline
8. Run verdict → Signed export → (optional) verify call
9. Wide shot on verdict banner, end card

## After recording

- Upload to YouTube as **Public** (required by the rules), title mentioning
  "Release Truth" and the hackathon.
- Paste the video URL and the `/feedback` Codex session ID into the
  submission form and into the README's demo section.
