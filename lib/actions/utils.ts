import { z } from "zod";

import type { ActionResult } from "@/lib/validation/common";

/** Converts a zod failure into the ActionResult error shape used by forms. */
export function validationFailure(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, msgs] of Object.entries(flat.fieldErrors as Record<string, string[] | undefined>)) {
    if (msgs?.length) fieldErrors[key] = msgs;
  }
  const first = Object.values(fieldErrors)[0]?.[0] ?? flat.formErrors[0] ?? "Please check the form for errors.";
  return { ok: false, error: first, fieldErrors };
}

/**
 * True for errors raised by the database layer (Drizzle wraps driver errors as
 * "Failed query: ..." with the SQL and parameters in the message, and the
 * postgres driver sets a SQLSTATE `code`). Those must never reach the UI.
 */
function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "DrizzleQueryError" || error.name === "PostgresError") return true;
  if (/^failed query/i.test(error.message)) return true;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string" && /^[0-9A-Z]{5}$/.test((error as { code: string }).code)) return true;
  return error.cause !== undefined && isDatabaseError(error.cause);
}

/**
 * Converts a thrown error into the ActionResult error shape. Messages thrown
 * on purpose by the data layer ("Invoice not found.") are shown as-is;
 * database, network and other infrastructure errors are logged on the server
 * and replaced with the generic fallback so users never see SQL or stack details.
 */
export function failure(error: unknown, fallback = "Something went wrong."): ActionResult<never> {
  if (isDatabaseError(error) || !(error instanceof Error) || !error.message) {
    console.error("[action] failed:", error instanceof Error ? (error.cause ?? error) : error);
    return { ok: false, error: `${fallback} Please try again in a moment; if it keeps happening, contact support.` };
  }
  return { ok: false, error: error.message };
}

/** Next.js signals redirects by throwing; never swallow those. */
export function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
