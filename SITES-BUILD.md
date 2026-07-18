# Sites build provenance

Production artifacts are generated in a Linux container with Node.js 22 and `npm ci`.

OpenNext documents that Windows builds may be runtime-incompatible. The Sites archive therefore uses the Linux-generated `.open-next` directory for reproducible Cloudflare Worker output.

The release gate for that artifact is `npm run check`, followed by `npm run preview:e2e` or `npm run test:e2e` against the exact OpenNext Worker preview. The `e2e` Wrangler environment uses committed test values only. Production runtime configuration must include `APP_ORIGIN`, `OPENAI_API_KEY`, `RELEASE_TRUTH_ACCESS_CODE`, and `RELEASE_TRUTH_SESSION_SECRET` as deployment secrets or variables.
