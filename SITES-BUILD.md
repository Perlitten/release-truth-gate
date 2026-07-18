# Sites build provenance

Production artifacts are generated in a Linux container with Node.js 22 and `npm ci`.

OpenNext documents that Windows builds may be runtime-incompatible. The Sites archive therefore uses the Linux-generated `.open-next` directory for reproducible Cloudflare Worker output.
