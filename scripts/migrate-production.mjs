import { migrate } from "drizzle-orm/node-postgres/migrator";

import { openDatabase } from "../db/connection.js";

const connection = await openDatabase();
try {
  await migrate(connection.db, {
    migrationsFolder: "drizzle",
    migrationsSchema: "drizzle",
    migrationsTable: "__release_truth_migrations",
  });
  console.log(
    JSON.stringify({
      event: "release_truth_migrations_complete",
    }),
  );
} finally {
  await connection.close();
}
