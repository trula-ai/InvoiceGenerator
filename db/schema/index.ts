/**
 * Drizzle schema barrel.
 *
 * Every table definition lives in its own file under `db/schema/` and is
 * re-exported from here. Both the runtime client (`lib/db.ts`) and Drizzle Kit
 * (`drizzle.config.ts`) read the schema through this single entry point.
 *
 * Conventions:
 * - Property names are camelCase in TypeScript; columns are mapped to
 *   snake_case automatically via `casing: "snake_case"`.
 * - MONEY: all monetary columns use PostgreSQL `numeric(precision, scale)`
 *   (Drizzle `numeric()`), never `real`/`double precision`/JS floats.
 * - TENANCY: every domain table carries `businessId`; queries must filter on it.
 */

export * from "./businesses";
export * from "./users";
export * from "./password-reset-tokens";
export * from "./clients";
export * from "./items";
export * from "./invoices";
export * from "./payments";
export * from "./email-logs";
export * from "./exchange-rates";
export * from "./notifications";
export * from "./invoice-reminders";
