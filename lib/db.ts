import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

/**
 * Database access layer: Drizzle ORM over the postgres.js driver.
 *
 * - Server-only. Never import this module from Client Components.
 * - Fails fast: importing this module without `DATABASE_URL` throws, so a
 *   misconfigured deployment is caught at startup rather than on first query.
 * - The driver connects lazily on first query, so importing is cheap.
 */

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a PostgreSQL connection string.",
    );
  }
  return url;
}

type PostgresClient = ReturnType<typeof postgres>;

// In development, Next.js hot-reloads server modules. Caching the client on
// `globalThis` prevents a new connection pool being created on every reload.
const globalForDb = globalThis as typeof globalThis & {
  __invoiceGeneratorPgClient?: PostgresClient;
};

function createClient(): PostgresClient {
  return postgres(getDatabaseUrl(), {
    // Disable prepared statements so the client works behind transaction-mode
    // connection poolers (PgBouncer, Supabase/Neon poolers), which is the
    // common setup for serverless and edge-adjacent Next.js deployments.
    prepare: false,
  });
}

const client = globalForDb.__invoiceGeneratorPgClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__invoiceGeneratorPgClient = client;
}

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Database = typeof db;
