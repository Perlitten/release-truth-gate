# Evidence Gate MVP audit

Date: 2026-07-18  
Audited commit: `180b8ce7c7faf67f7281447c298be295a37a4eca`

## Executive finding

The repository is a hardened synthetic demo, not a shared release-governance
product. Its deterministic evidence policy and visual workspace are reusable,
but all authoritative release data, decisions, verdict computation, sharing,
and export still live in the browser. The existing access-code session only
protects the advisory AI route; it is not user identity or workspace RBAC.

The MVP migration must keep the current Next.js/React/OpenNext stack and visual
language while moving the trust boundary behind authenticated server routes
backed by PostgreSQL.

## Baseline verification

The unmodified audited commit was verified before migration:

- `npm run test`: 34/34 tests passed.
- `npm run audit:prod`: zero known production vulnerabilities.
- `npm run check`: passed, including the exact OpenNext Worker build, bundle
  verification, and Wrangler dry-run.
- The app was opened at `http://127.0.0.1:3100`; the runtime shows a fixed
  `Nova 2.4 Launch` synthetic workspace with no project/release creation path.
- Next.js reports the known Edge Middleware deprecation warning. The file must
  remain `middleware.js` until OpenNext supports the Node Proxy artifact.

## Current architecture

### Framework and deployment

- Next.js 16 App Router with React 19.
- JavaScript ESM, Zod runtime schemas, Vitest and Playwright.
- OpenNext Cloudflare Worker deployment through `wrangler.jsonc`.
- Strict CSP nonces and browser security headers are already applied.
- No ORM, database, migration system, background queue, or object storage.

### Server surface

- `POST /api/session` exchanges one shared access code for a signed cookie.
- `GET /api/session` exposes whether advisory AI access is available.
- `POST /api/analyze` calls OpenAI after origin, schema, size, auth, timeout,
  grounding, and in-process rate-limit checks.
- There are no server routes for workspaces, memberships, projects, releases,
  claims, evidence, decisions, verdict runs, GitHub, invitations, or exports.

### Client-owned product state

- `src/data.js` hard-codes Nova 2.4, claims, evidence, historical decisions,
  and timeline events.
- `src/App.jsx` combines hard-coded and browser-local decisions, calls
  `calculateVerdict`, and owns the displayed verdict.
- Browser-local decisions are persisted under
  `release-truth:nova-2.4:draft:v1`.
- Share links serialize untrusted state into the URL fragment.
- Export is assembled and checksummed in the browser.
- AI output is advisory and in-memory, but its request payload is still built
  from the hard-coded dataset.

## Reusable components

- `src/lib/verdict.js`: preserve the current verdict status names and policy
  semantics, move the pure engine into a server-safe core, and adapt database
  snapshots into its input.
- `api/schema.mjs`: reuse strict advisory-AI request/response grounding rules.
- `api/security.mjs`: reuse constant-time helpers, bounded body reads,
  same-origin validation, no-store responses, and security-response patterns.
- `src/App.jsx` and `src/styles.css`: preserve the dense timeline, detail
  panel, summary cards, empty/error/loading conventions, and responsive visual
  language while replacing demo data with API state.
- Exact OpenNext build verification and production-preview E2E harness.

## Trust-boundary debt

1. The browser can currently choose the inputs and calculate the verdict.
2. Product records have no shared persistence, actor identity, tenancy, or
   database-enforced immutability.
3. IDs are demo strings and have no workspace ownership checks.
4. The shared access code cannot represent users or roles.
5. The in-memory rate limiter is not distributed.
6. GitHub is not connected and external evidence has no immutable snapshot.
7. The export checksum is not a digital signature.
8. Nova data is production UI source code instead of an explicit seed.

## Target architecture and ADR

### PostgreSQL and ORM

Use PostgreSQL 16+ with Drizzle ORM and parameterized `node-postgres`.

Reasons:

- the existing repository has no database layer to preserve;
- Drizzle keeps generated SQL migrations reviewable and works with both a
  normal local PostgreSQL connection and Cloudflare Hyperdrive;
- `pg` is Cloudflare's recommended PostgreSQL driver for Hyperdrive;
- the same schema and transaction code can run in Next.js local development,
  integration tests, and the deployed Worker.

Runtime connection policy:

- local Next.js and migration commands use `DATABASE_URL`;
- migrations use a direct, non-pooled `DATABASE_URL_DIRECT`;
- production Worker requests use a cache-disabled `HYPERDRIVE` binding;
- database code remains server-only and never enters the client bundle.

### Identity

Replace the shared access-code product identity with database-backed email and
password accounts:

- passwords are salted and derived server-side with Web Crypto PBKDF2;
- the browser receives only an opaque, rotating `HttpOnly` session cookie;
- only a hash of the session token is stored in PostgreSQL;
- invitation acceptance requires both an authenticated matching email and the
  single-use invitation token.

The old access-code path may remain temporarily only for the advisory AI demo
while the UI migration is in progress; it cannot authorize product mutations.

### Authorization

Every data access resolves the resource's workspace and membership on the
server. Mutation routes call a centralized capability check. Client button
visibility is UX only. Public resource IDs use UUIDs. Cross-workspace ID
substitution must return 404 or 403 without leaking data.

### Immutability

Claims, evidence, decisions, verdict runs, audit events, integration imports,
and export artifacts are append-only. PostgreSQL triggers reject `UPDATE` and
`DELETE` on immutable tables. Corrections append a new row with
`supersedes_id`, actor, reason, timestamp, and content hash. Release/project
metadata changes are recorded as audit events.

### GitHub

Use a GitHub App with installation tokens rather than user OAuth:

- installation lifecycle belongs to a workspace;
- callback state is short-lived, single-use, server-stored, and hashed;
- private keys and installation tokens remain server-only;
- imports re-check repository installation access every time;
- normalized snapshots are content-addressed and idempotent;
- changed upstream objects create new immutable revisions.

### Verdict

The existing deterministic engine becomes a pure server module:

`claims + active evidence snapshots + active decisions + engine version -> result`

The recompute route loads all inputs from PostgreSQL, validates ownership and
append-only chains, computes a canonical input digest, stores the full immutable
run, and returns the stored result. No client-supplied result is accepted. AI
remains advisory and cannot produce `GO`.

### Export

The server builds a canonical JSON manifest from a stored verdict run, signs it
with Ed25519, stores the artifact hash/signature metadata, and exposes a public
key plus verification endpoint. The private key is an environment secret and
there is no arbitrary-payload signing endpoint.

## Migration order and affected areas

1. Database foundation:
   `db/schema.js`, `db/client.js`, `drizzle.config.js`, `drizzle/`,
   `compose.yaml`, seed/migration scripts, `.env.example`, test DB helpers.
2. Identity and tenancy:
   session/auth modules, `/api/auth/*`, `/api/workspaces/*`, invitation routes,
   centralized RBAC, login/onboarding UI.
3. Core CRUD:
   project/release/claim/evidence routes and replacement of fixed client data.
4. Governance:
   append-only decision routes, audit timeline, server verdict core and stored
   verdict runs.
5. GitHub:
   installation callback/webhook, repository selection, manual sync/import UI.
6. Export:
   signed generation, artifact download, public-key and verification routes.
7. Hardening:
   distributed Cloudflare rate-limit bindings, payload caps, structured logs,
   health/readiness, CI database job, production smoke, deployment runbook.
8. Remove production dependencies on `src/data.js`, browser decision storage,
   fragment snapshots, client verdict computation, and client export.

## Migration safety rules

- Each vertical stage must leave the previous audited tests green.
- New mutations require runtime validation, same-origin/CSRF protection,
  server-side authentication, capability checks, and an audit event.
- No fake GitHub response, fallback verdict, auto-seed, or production test
  identity may exist in a production path.
- Missing database, GitHub, AI, signing, or deployment configuration is shown as
  unavailable and must never become optimistic data or a successful verdict.
- Nova 2.4 moves to a manual demo seed and the application boots correctly in
  an empty database.

## Expected external blockers

Code can fully prepare the vertical slice locally. A real GitHub App connection
requires a GitHub App ID, client ID/secret, webhook secret, and private key. A
public deployment additionally requires an authenticated Cloudflare account,
a production PostgreSQL connection/Hyperdrive binding, signing key secret, and
canonical production origin. If any are absent, the final report must name the
specific missing credential and must not claim deployment or GitHub completion.

## Deployment target update

After this audit the product owner explicitly selected the existing Contabo VPS
as the production target. The primary production topology is therefore a
versioned Docker image running the standard Next.js Node server, an isolated
PostgreSQL container/volume, and the host's existing nginx/Let's Encrypt edge.
The audited OpenNext Cloudflare build remains a portability check but is no
longer the primary production runtime. No existing service or occupied host
port may be reused.
