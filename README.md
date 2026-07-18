# Release Truth

Release Truth is a multi-user evidence gate for software releases. Teams record
material claims, attach manual or GitHub evidence, capture reviewer decisions,
and run a deterministic server-side policy before shipping.

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
