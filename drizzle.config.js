import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env", override: false });

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.js",
  out: "./drizzle",
  dbCredentials: url ? { url } : undefined,
  migrations: {
    table: "__release_truth_migrations",
    schema: "drizzle",
  },
  strict: true,
  verbose: true,
});

