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

export function failure(error: unknown, fallback = "Something went wrong."): ActionResult<never> {
  return { ok: false, error: error instanceof Error && error.message ? error.message : fallback };
}

/** Next.js signals redirects by throwing; never swallow those. */
export function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
