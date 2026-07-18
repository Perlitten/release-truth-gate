# Release Truth

Release Truth is an evidence-gated launch decision workspace for small, AI-assisted product teams. It connects claims, code revisions, test runs, policies, and human approvals on one timeline, then highlights when newer evidence invalidates an older decision.

## Why it can win

Most launch checklists record a decision but lose the evidence state that justified it. Release Truth keeps each approval attached to exact revisions and detects supersession. The product is deliberately human-in-the-loop: AI assembles and cites the evidence; accountable owners resolve the conflict.

The demo centers on one judge-friendly moment:

1. A privacy promise is approved on July 16.
2. A telemetry refactor lands after approval.
3. The current schema and test run contradict the promise.
4. Release Truth changes the verdict, explains why, and lets the owner compare revisions or record a resolution.

## Product surface

- Five-day release timeline with Claim, Code, Tests, and Decisions lanes
- Deterministic fail-closed verdict logic for high-confidence privacy, security, data-integrity, and core-workflow conflicts
- Structured OpenAI evidence analysis with cited source IDs and bounded excerpts
- Explicit supersession and risk-acceptance workflow
- Summary, evidence, risk, and decision views
- JSON evidence export and share-link action
- Responsive desktop and mobile layouts

## Architecture

```text
Browser
  ├─ React release workspace
  ├─ Deterministic verdict engine
  └─ POST /api/analyze
         ├─ Zod request validation
         ├─ Evidence isolation / prompt-injection boundary
         ├─ OpenAI Responses API structured output
         └─ Zod response validation
```

The API key is server-only. Evidence text is treated as untrusted data, source IDs are preserved, and the model cannot approve a release or mutate a human decision.

## Local development

Requirements: Node.js 20+ and an OpenAI API key.

The current workspace reads the key from `../.env.local`. For another checkout, create `.env.local` in the project root or provide the environment variables to the runtime:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
```

Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run test
npm run build
npm run build:worker
```

The design source is `design-reference.png`. The completed visual and interaction audit is documented in `design-qa.md`.

## Deployment

The app uses Next.js App Router and includes an OpenNext Cloudflare build configuration. Production must provide `OPENAI_API_KEY` as a secret runtime variable and may optionally override `OPENAI_MODEL`.
