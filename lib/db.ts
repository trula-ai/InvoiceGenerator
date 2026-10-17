import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

/**
 * Database access layer: Drizzle ORM over the postgres.js driver.
 *
 * - Server-only. Never import this module from Client Components.
 * - Lazy: importing this module never touches `DATABASE_URL`. The client is
 *   created on the first query, so `next build` (which evaluates every route
 *   module while collecting page data) succeeds in environments that do not
 *   have the variable, such as Vercel preview builds. A missing variable
 *   still fails loudly, on the first query, with a clear message.
 * - The driver itself connects lazily on first query, so creation is cheap.
 */

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a PostgreSQL connection string.",
    );
  }
  return url;
}

type PostgresClient = ReturnType<typeof postgres>;
type Drizzle = ReturnType<typeof createDrizzle>;

// In development, Next.js hot-reloads server modules. Caching the client on
// `globalThis` prevents a new connection pool being created on every reload.
const globalForDb = globalThis as typeof globalThis & {
  __invoiceGeneratorPgClient?: PostgresClient;
  __invoiceGeneratorDb?: Drizzle;
};

function createClient(): PostgresClient {
  return postgres(getDatabaseUrl(), {
    // Disable prepared statements so the client works behind transaction-mode
    // connection poolers (PgBouncer, Supabase/Neon poolers), which is the
    // common setup for serverless and edge-adjacent Next.js deployments.
    prepare: false,
  });
}

function createDrizzle() {
  const client = globalForDb.__invoiceGeneratorPgClient ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForDb.__invoiceGeneratorPgClient = client;
  return drizzle(client, { schema, casing: "snake_case" });
}

function getDb(): Drizzle {
  if (process.env.NODE_ENV !== "production") {
    return (globalForDb.__invoiceGeneratorDb ??= createDrizzle());
  }
  return (instance ??= createDrizzle());
}

let instance: Drizzle | undefined;

/**
 * The shared Drizzle instance. It behaves exactly like `drizzle(...)` but is
 * created on first property access, so modules can import it freely.
 */
export const db: Drizzle = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver === undefined ? real : real);
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return prop in getDb();
  },
});

export type Database = Drizzle;
