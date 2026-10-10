"use server";

import { revalidatePath } from "next/cache";

import { respondToQuoteByToken, type QuoteDecision } from "@/lib/data/invoices";
import { documentPath } from "@/lib/documents";
import type { ActionResult } from "@/lib/validation/common";

import { failure } from "./utils";

/**
 * Client-side response to a quote from the public page. No login: the share
 * token in the link is the only credential, exactly as for viewing. Only open
 * quotes can be answered, and the owner is notified in-app.
 */
export async function respondToQuotePublicAction(token: string, decision: QuoteDecision): Promise<ActionResult> {
  if (decision !== "accepted" && decision !== "declined") return { ok: false, error: "Invalid response." };
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, error: "This link is not valid." };
  try {
    const result = await respondToQuoteByToken(token, decision);
    if (!result) return { ok: false, error: "This quote could not be found or is no longer open." };
    revalidatePath(`/i/${token}`);
    revalidatePath(documentPath("quote", result.id));
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/notifications");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not record your response.");
  }
}
