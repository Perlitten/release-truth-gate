import { generateKeyPairSync } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL_TEST ||
  "postgresql://release_truth:release_truth_local@127.0.0.1:54329/release_truth_test";
const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  throw new Error(`Refusing to reset non-test database "${databaseName}".`);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
} finally {
  await client.end();
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const env = {
  ...process.env,
  NODE_ENV: "production",
  RELEASE_TRUTH_DISABLE_RATE_LIMIT: "1",
  APP_ORIGIN: "http://localhost:8787",
  DATABASE_URL: databaseUrl,
  DATABASE_URL_DIRECT: databaseUrl,
  EXPORT_SIGNING_PRIVATE_KEY: privateKey.export({
    format: "pem",
    type: "pkcs8",
  }),
  EXPORT_SIGNING_PUBLIC_KEY: publicKey.export({
    format: "pem",
    type: "spki",
  }),
  EXPORT_SIGNING_KEY_ID: "e2e-ed25519",
};

const migration = spawnSync("npx", ["drizzle-kit", "migrate"], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});
if (migration.status !== 0) process.exit(migration.status ?? 1);

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "8787"],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}
next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
