import { defineConfig } from "drizzle-kit";

// Drizzle Kit runs outside Next.js and does not inherit its automatic .env
// loading. Load the same files Next.js uses. `.env.local` is loaded first so it
// takes precedence (loadEnvFile never overrides variables that are already set).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present; skip.
  }
}

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  // Column names are generated as snake_case from camelCase TS properties.
  // Must match the `casing` option passed to drizzle() in lib/db.ts.
  casing: "snake_case",
  // Credentials are only required for commands that talk to a database
  // (migrate, push, studio, pull). `generate` and `export` work offline.
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
  strict: true,
  verbose: true,
});
