# Production operations

The Contabo deployment uses an isolated Docker Compose project:

- the application is published only on `127.0.0.1:3187`;
- PostgreSQL is reachable only on the private Compose network;
- host nginx terminates TLS and proxies to the application;
- `.env.production` is created on the server with mode `0600` and is never committed;
- the app runs migrations before accepting traffic;
- production data is not seeded automatically.

Run a backup with `ops/backup.sh`. Restore into a stopped database only after
testing the dump in a disposable PostgreSQL instance.
