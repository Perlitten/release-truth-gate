# Release Truth

Release Truth is an evidence-gated launch workspace for small, AI-assisted product teams. It connects claims, exact code revisions, test runs, and human decisions, then fails closed when the current evidence no longer supports a material claim.

The bundled Nova 2.4 dataset is explicitly synthetic. It demonstrates the core case: a privacy promise was approved, a later telemetry change introduced full message content, the current privacy test failed, and the deterministic gate changed the release to `NO-GO`.

## Trust model

- The verdict is calculated locally from structured claims, current evidence, and decisions. Missing or ambiguous required evidence produces `NOT EVALUABLE`, never an optimistic pass.
- AI is advisory. It may classify an evidence relation and explain it, but it cannot approve a release, mutate evidence, or override the deterministic policy.
- AI citations must reference allowlisted source IDs and quote exact contiguous source excerpts. Unsupported model output is rejected.
- Review actions append scoped decision proposals. They never rewrite source evidence or silently clear a blocker.
- Exported bundles contain the full evidence content, findings, decisions, assessments, and a SHA-256 checksum. The checksum helps detect accidental changes; it is not tamper-proof or a server signature.
- Share links use the URL fragment, so the snapshot is not sent in the HTTP request. Browser drafts and shared snapshots are validated, but remain untrusted client-side demo state. Imported AI assessments are always discarded.

## Product surface

- Five-day Claim, Code, Tests, and Decisions timeline
- Fail-closed material-claim coverage and one deduplicated blocker per causal issue
- Summary, evidence, risk, and append-only decision views
- Exact current-versus-approved revision comparison
- Live, cited OpenAI evidence review with explicit failure states
- Portable share snapshot and full JSON evidence export
- Keyboard-accessible dialogs and responsive desktop, tablet, and mobile layouts

## Security boundary

`POST /api/analyze` applies bounded request reads, Zod validation, same-origin checks, a custom request marker, per-client rate limiting, an optional signed `HttpOnly` session, an upstream timeout, and no-store responses. OpenAI requests use `store: false`; the server logs metadata only.

Production fails closed unless `APP_ORIGIN`, `RELEASE_TRUTH_ACCESS_CODE`, and a strong `RELEASE_TRUTH_SESSION_SECRET` are configured. CSP nonces and strict browser hardening headers are applied at the edge. See [SECURITY.md](./SECURITY.md).

Next.js 16's deprecated Edge Middleware convention is retained intentionally because the current OpenNext Cloudflare adapter does not yet support Node Proxy. Migrate the boundary to `proxy.js` only after adapter support is verified.

## Local development

Requirements: Node.js 22+ and an OpenAI API key.

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. A parent `../.env.local` is accepted only as a local-development convenience.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Verification

```bash
npm run test
npm run check
npm run preview:e2e
npm run test:e2e
```

`npm run check` runs unit/security tests, a production dependency audit that fails on moderate-or-higher findings, the exact OpenNext Worker build, bundle verification, and a Wrangler dry run. E2E tests use the same Worker artifact that is deployed.

`npm run preview:e2e` starts the built Worker with the non-production `e2e` Wrangler environment from `wrangler.jsonc`. The committed `e2e` values are test-only and are not used by the top-level production dry run or deployment.

The production build intentionally uses Next.js Webpack. OpenNext documents `ChunkLoadError` in Worker previews as a Turbopack-adapter compatibility failure and recommends Webpack as the supported fallback.

The design source is `design-reference.png`; measured visual and interaction QA is in [design-qa.md](./design-qa.md).

## Production configuration

Set these as runtime secrets or variables:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
APP_ORIGIN=https://release-truth.example.com
RELEASE_TRUTH_ACCESS_CODE=
RELEASE_TRUTH_SESSION_SECRET=
RELEASE_TRUTH_REVIEWER_NAME=Release reviewer
```

The current implementation is a secure synthetic demo, not yet a multi-user governance system. A production rollout still needs authenticated organizational identity, server-side append-only storage/signatures, source-system connectors, and deployment access configured outside this repository.
