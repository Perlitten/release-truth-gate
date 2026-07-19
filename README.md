# Release Truth

Release Truth is a multi-user evidence gate for software releases. Teams record
material claims, attach manual or GitHub evidence, capture reviewer decisions,
and run a deterministic server-side policy before shipping.

## The problem

Releases usually ship on a green checkmark and a gut feeling. The claim that
mattered — "we don't collect message content," "this endpoint is
idempotent" — quietly stops being true somewhere between the promise and the
ship, and nobody notices until an incident. Release Truth makes that gap
visible and blocks the release until it's closed: every material claim needs
current, linked evidence, every reviewer decision is attributed and
append-only, and the ship/no-ship verdict is computed by the server from the
live evidence ledger, not typed in by a person.

## Where Codex accelerated the build

The evidence-gate architecture — the PostgreSQL append-only schema for
claims, evidence, decisions and verdict runs, workspace RBAC, the
deterministic fail-closed verdict engine, Ed25519-signed exports, and the
Contabo production deployment pipeline — was built end to end in a single
primary Codex session (commits `99e2fb7`…`80efb2e`, 2026-07-18 09:58–20:57
UTC+3, ~11 hours). That session also wrote the GPT-5.6 evidence-assessment
engine described below (`app/api/analyze/route.js`, `api/schema.mjs`) from
the first commit. `/feedback` session ID: `019f73c6-2d3c-71b1-aade-b6c5044c8480`.

Everything after that timestamp — reconnecting the GPT-5.6 endpoint to the
live UI (it existed but nothing called it, and it was still gated behind a
dead single-tenant auth path from before the multi-user rewrite), the
Claim/Code/Tests/Decisions release timeline, an accessibility and RBAC
hardening pass driven by two independent UX audits, and closing a real gap
where "reviewer confirms they read the evidence" was only enforced in the
browser and not on the server — was iterative debugging and hardening on top
of that Codex-built foundation.

## Where GPT-5.6 does meaningful work

Selecting any evidence or decision on the release timeline exposes an
"Assess with GPT-5.6" action. It sends the claim, the full current evidence
set for that claim (not just the one item selected), and the most recent
prior approval to `gpt-5.6-terra` via the Responses API with a structured
schema (`evidenceAssessmentSchema`), and gets back a relation
(`supports`/`contradicts`/`unproven`), a finding, an impact statement, cited
excerpts, missing-evidence gaps, and a recommended action.

Two things are load-bearing, not decorative:

- **Grounding is enforced server-side.** Every cited excerpt is checked to be
  an exact, contiguous substring of the source it claims to quote
  (`groundAssessment` in `api/schema.mjs`); a hallucinated citation is
  rejected before the response ever reaches the client.
- **The model has no authority over the verdict.** It explains evidence. The
  GO/NO-GO decision is computed by a separate deterministic policy engine
  (`src/lib/verdict.js`) that never reads the model's output, so a bad or
  unavailable model call degrades explanation quality, not release safety —
  the endpoint fails closed with a 503 if `OPENAI_API_KEY` isn't configured,
  never with a fabricated assessment.

## What is authoritative

- PostgreSQL stores users, workspaces, roles, projects, releases, claims,
  evidence, decisions, verdict runs, audit events, integrations, and exports.
- Claims, evidence, decisions, verdict runs, imports, audit events, and signed
  exports are append-only at the database layer.
- The server loads the full evidence head and calculates the verdict. It rejects
  client-supplied verdict results.
- Every verdict run stores its normalized input snapshot, SHA-256 digest, engine
  version, policy version, reason codes, result, actor, and timestamp.
- Release exports are canonical JSON signed with a server-held Ed25519 key.
  `/api/exports/verify` detects changed manifests or signatures.
- Browser storage is not an authority and the product does not use `localStorage`.

Nova 2.4 remains available only as an explicit synthetic seed. It is never
loaded automatically.

## Roles

Workspace roles are `owner`, `admin`, `contributor`, `reviewer`, and `viewer`.
Every resource lookup and mutation enforces the corresponding server-side
capability. Unauthorized workspace resources are hidden with a `404`.

## GitHub App

Owners and admins can connect a GitHub App installation, link an installation
repository to a project, and import:

- issues as claims;
- pull requests, commits, check runs, and commit statuses as evidence.

The connection uses a hashed, expiring, single-use state. The setup callback is
followed by GitHub user authorization, and the server confirms that the user can
administer the selected installation. Imports use short-lived installation
tokens, verify repository access on every call, store normalized source payloads
and hashes, return the existing record for exact retries, and append a correction
when upstream content changes.

Required GitHub App permissions are read-only metadata, issues, pull requests,
contents, checks, and commit statuses. Configure its setup/callback URL as
`https://YOUR_ORIGIN/api/github/callback` and webhook URL as
`https://YOUR_ORIGIN/api/github/webhook`.

## Local development

Requirements: Node.js 22+, Docker, and PostgreSQL via the included Compose file.

```bash
cp .env.example .env.local
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`.

The application works with an empty migrated database. To load the explicit
Nova demo:

```bash
npm run db:seed:nova
```

The seed refuses production unless `ALLOW_NOVA_SEED=true` is deliberately set.

## Guided demo access

Once the Nova seed is installed, the sign-in screen shows an
"Explore the Nova 2.4 demo" button. One click signs the visitor in as a
shared reviewer-role judge account (`judge@nova-demo.local`, reachable only
through this button) inside the seeded workspace, so reviewers and hackathon
judges can browse claims, record decisions, run the server verdict, and
generate signed exports without registering. The button is always available
in development; on production it additionally requires `DEMO_MODE=true`.

## Verification

```bash
npm run test
npm run test:db
npm run build
npm run test:e2e
npm run audit:prod
```

The E2E path resets only a database whose name ends in `_test`. It creates two
users, shares a workspace, records evidence and reviewer approval, reproduces a
`GO`, downloads a signed export, verifies it, and confirms that a modified
manifest fails verification. GitHub Actions runs the same checks against
PostgreSQL 17.

## Production

`Dockerfile` produces a non-root Next.js standalone image.
`compose.production.yaml` runs it with an isolated PostgreSQL 17 volume; the
database has no host port and the app binds only to `127.0.0.1:3187` for a host
reverse proxy. Migrations run before the server starts. Production is never
seeded automatically.

Runtime secrets and variables:

```dotenv
APP_ORIGIN=https://release-truth.example.com
DATABASE_URL=postgresql://...
SESSION_TTL_HOURS=24
EXPORT_SIGNING_PRIVATE_KEY_BASE64=...base64 of Ed25519 PKCS8 PEM...
EXPORT_SIGNING_PUBLIC_KEY_BASE64=...base64 of Ed25519 SPKI PEM...
EXPORT_SIGNING_KEY_ID=production-ed25519
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
```

If GitHub credentials are absent, the integration reports itself unavailable;
manual claims, evidence, decisions, verdicts, collaboration, and signed exports
remain fully operational. See [ops/README.md](./ops/README.md) for deployment
and backup details and [SECURITY.md](./SECURITY.md) for the security boundary.
