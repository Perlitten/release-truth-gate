# Security model

## Trust boundary

PostgreSQL and authenticated server routes are authoritative. Browser state,
AI output, GitHub callback parameters, and imported source payloads are
untrusted inputs.

## Implemented controls

- Passwords use per-user salts and PBKDF2; opaque session tokens are stored only
  as SHA-256 hashes and sent in `HttpOnly`, `SameSite=Strict` cookies
  (`Secure` and `__Host-` in HTTPS production).
- Every tenant resource is resolved through centralized workspace RBAC.
  Cross-workspace access is hidden, and mutations require same-origin checks
  plus route-specific request markers.
- JSON and webhook bodies are bounded and schema validated. Authentication,
  GitHub import, and public export verification are rate limited in the app;
  production nginx also applies request controls.
- Claims, evidence, decisions, verdict runs, GitHub imports, audit events, and
  export artifacts reject database `UPDATE` and `DELETE`. Corrections append a
  record that points to the superseded record.
- The audit log is a workspace-scoped SHA-256 hash chain. Verdicts are calculated
  from database inputs, fail closed on invalid history, and persist their exact
  input digest and engine/policy versions.
- Exports are canonical JSON signed with Ed25519. The private key is server-only;
  the public key and bounded verification endpoint cannot sign arbitrary input.
- GitHub setup state is random, hashed at rest, expiring, and single use.
  A GitHub user token confirms administration of the chosen installation before
  it is attached. Repository data is fetched with short-lived installation
  tokens and normalized before storage. Webhook lifecycle changes require
  `X-Hub-Signature-256`.
- CSP nonces with `strict-dynamic`, frame denial, MIME-sniffing protection,
  HSTS, COOP/CORP, a restrictive permissions policy, and no-referrer policy are
  set on browser responses.
- Logs contain identifiers, action names, status, hashes, and provider request
  IDs—not passwords, session tokens, GitHub/OpenAI tokens, signing keys, or
  evidence payloads.
- The production container runs as a non-root user. PostgreSQL has no host port;
  the app is published only on loopback behind TLS nginx. No production seed is
  automatic.

## Operational requirements

- Keep `.env.production` mode `0600`, rotate signing/GitHub/session secrets on
  suspected exposure, and retain old public verification keys when historical
  exports must remain verifiable.
- Test database dumps by restoring them into an isolated instance. Define the
  required retention/deletion policy before storing regulated evidence.
- A future multi-instance deployment must replace process-local application rate
  buckets with a distributed limiter. The current single-app Contabo deployment
  is additionally protected at nginx.
- Configure the GitHub App with only read permissions required for metadata,
  issues, pull requests, contents, checks, and commit statuses.

## Verification and incident practice

`npm run audit:prod` fails on moderate-or-higher production advisories. CI also
runs unit tests, database integration tests, the production build, and a
two-user browser flow including signed-export tamper detection.

On suspected compromise: revoke provider credentials, rotate the user-session
and export-signing keys, restart the app, invalidate active sessions in
`user_sessions`, review the audit hash chain and server logs, and rerun the full
verification gate before reopening writes.
