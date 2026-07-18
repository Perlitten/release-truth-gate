# Product

## Register

product

## Users

Engineering and release-governance teams shipping software under a formal
evidence gate: engineers, reviewers, and release/eng managers working inside
a shared workspace with roles (owner, admin, contributor, reviewer, viewer).
They arrive under time pressure, at the moment a release is about to go out,
needing to answer one question fast: is this claim still true, and what
changed that might have broken it? Hackathon judges are a secondary audience
who land on the same screens cold and must understand the product's value
inside the length of a short demo, without a guided tour.

## Product Purpose

Release Truth is a server-authoritative evidence gate for release decisions.
Teams record material claims about a release, attach evidence (manual or
imported from GitHub), and the server computes a deterministic, fail-closed
verdict — GO or NO-GO — from the current state of that evidence. Success
looks like: a reviewer or judge can look at a release and immediately see
what is proven, what contradicts what, and why the verdict is what it is,
with the causal chain (claim → code → tests → decision) visible rather than
buried in separate record lists.

## Brand Personality

Confident enterprise engineer. Precise, unhurried, competent — the tone of
someone who has read the incident report and knows exactly what broke and
when. Not decorative, not friendly-startup, not bureaucratic. Every visual
choice should read as *earned* clarity: nothing is rounded, gradiented, or
softened just to look modern. Confidence is expressed through restraint and
exactness (exact revisions, exact hashes, exact timestamps), not through
big gestures.

## Anti-references

- **Generic SaaS dashboard**: gradient hero-metric cards, oversized
  `border-radius`, soft glow shadows, identical icon+heading+text card
  grids. Reads as templated, undermines the "this is authoritative evidence"
  claim.
- **Jira/Confluence corporate tool**: dense gray chrome, cluttered nav,
  low-contrast secondary text, generic corporate blue. Reads as bureaucratic
  process theater, the opposite of a sharp, fast evidence read.

## Design Principles

1. **Evidence over vibes.** Every claim, number, and status on screen must
   trace to a specific record (revision, hash, actor, timestamp). Don't
   summarize away the specifics that make the product trustworthy.
2. **Causality is visible, not reconstructed.** The relationship between a
   claim, the code/tests that support or contradict it, and the human
   decision must be readable directly from layout and color — not something
   the viewer has to piece together by clicking through separate tabs.
3. **Fail closed, visually too.** NO-GO and contradicted states must
   dominate the frame over GO/verified states of equal size. An uncertain or
   incomplete state should never look calm or "probably fine."
4. **Restraint reads as confidence.** No gradients, no side-stripe borders,
   no soft 20px+ shadows, no decorative rounding. Precision typography,
   exact data, deliberate color — the interface should look like it was
   built by people who trust their own evidence.
5. **Judge-legible in one screen.** Anyone landing cold (a judge, a new
   reviewer) must be able to read the current state of a release — what's
   proven, what's broken, what's pending — without a tour, inside the first
   viewport.

## Accessibility & Inclusion

WCAG 2.1 AA. Status must never be conveyed by color alone (verified /
contradicted / pending on the timeline and elsewhere always pair an icon
and a text label with the color). Standard `prefers-reduced-motion` support
for any transition or reveal animation added.
