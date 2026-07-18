import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

const { Client } = pg;

export class DatabaseUnavailableError extends Error {
  constructor(message = "The PostgreSQL database is not configured.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export async function resolveDatabaseConnectionString() {
  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = getCloudflareContext();
      if (env.HYPERDRIVE?.connectionString) {
        return env.HYPERDRIVE.connectionString;
      }
    } catch {
      // A production Node test/build has no Cloudflare request context.
    }
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (process.env.NODE_ENV !== "production") {
    return "postgresql://release_truth:release_truth_local@127.0.0.1:54329/release_truth";
  }

  throw new DatabaseUnavailableError();
}

export async function openDatabase(connectionString) {
  const client = new Client({
    connectionString: connectionString || (await resolveDatabaseConnectionString()),
  });
  await client.connect();

  return {
    client,
    db: drizzle({ client, schema }),
    async close() {
      await client.end();
    },
  };
}

export async function withDatabase(callback, options = {}) {
  const connection = await openDatabase(options.connectionString);
  try {
    return await callback(connection.db, connection.client);
  } finally {
    await connection.close();
  }
}

