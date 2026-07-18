import { spawnSync } from "node:child_process";

import pg from "pg";

const defaultTestUrl =
  "postgresql://release_truth:release_truth_local@127.0.0.1:54329/release_truth_test";
const databaseUrl = process.env.DATABASE_URL_TEST || defaultTestUrl;
const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, "");

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to reset database "${databaseName}"; DATABASE_URL_TEST must end in _test.`,
  );
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

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_DIRECT: databaseUrl,
  DATABASE_URL_TEST: databaseUrl,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["drizzle-kit", "migrate"]);
run("npx", ["vitest", "run", "--config", "vitest.db.config.js"]);
