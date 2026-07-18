---
type: "query"
date: "2026-07-18T14:33:42.555653+00:00"
question: "What makes the final Release Truth snapshot reproducible and deployable?"
contributor: "graphify"
source_nodes: ["package.json", "middleware.js", "verify-worker-build.mjs", "ci.yml"]
---

# Q: What makes the final Release Truth snapshot reproducible and deployable?

## Answer

The repository uses npm ci with a lockfile, React 19.2.7, a global PostCSS 8.5.19 override that yields zero npm audit findings, 34 unit tests, 6 Worker-preview E2E tests, an exact OpenNext Worker build verification, and a Wrangler dry run. Edge Middleware remains intentionally until OpenNext supports Next.js Node Proxy.

## Source Nodes

- package.json
- middleware.js
- verify-worker-build.mjs
- ci.yml