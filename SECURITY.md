# Security model

## Protected assets

- The OpenAI API key and session-signing secret are server-only.
- Evidence content may contain confidential product, customer, or policy data.
- Release verdicts and human decisions are governance records and must not be silently mutated.

## Implemented controls

- Production AI access is disabled unless an exact HTTPS origin, access code, and strong session secret are configured.
- The access code is exchanged for a signed, short-lived `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Analysis requests require the same origin and a custom request marker, have a 48 KB body limit, and are rate limited.
- Request and response schemas are validated. Source IDs and decision IDs are allowlisted, and citations must be exact contiguous source excerpts.
- Evidence is serialized as data inside the model prompt. Evidence text cannot supply system instructions.
- OpenAI requests use `store: false`, a bounded output size, one retry, and a 25-second abort timeout.
- Application logs contain request metadata and status only, not secrets, evidence text, access codes, or model output.
- CSP nonces, `strict-dynamic`, frame denial, MIME sniffing protection, a restrictive permissions policy, HSTS, COOP, and CORP are applied.
- Client-side drafts and shared snapshots are schema validated and explicitly treated as untrusted demo state. Imported AI assessments are discarded and can only be recreated by a live authenticated server request.

## Residual production requirements

- Replace the in-memory rate limiter with an edge-distributed limiter for a multi-instance deployment.
- Migrate the CSP nonce boundary from Edge Middleware to Next.js Node Proxy only after OpenNext Cloudflare supports Node Proxy; renaming it earlier would remove the deployable adapter path.
- Add organizational authentication and authorization with audit-ready identities.
- Store evidence and decisions in server-side append-only storage and sign or attest exported bundles.
- Add source-specific authorization and redaction before ingesting real repositories, CI logs, tickets, or customer data.
- Define retention, deletion, incident-response, and data-residency policies for the chosen deployment.

## Dependency and incident practice

`npm run check` fails on moderate-or-higher production dependency advisories. The locked tree currently audits with zero known vulnerabilities.

If a server secret may have leaked: revoke it at the provider, rotate the session secret and access code, invalidate active sessions by redeploying, review metadata logs, and rerun the full verification gate.
