"use server";

import { revalidatePath } from "next/cache";

import { respondToQuoteByToken, type QuoteDecision } from "@/lib/data/invoices";
import { documentPath } from "@/lib/documents";
import { confirmCheckout, startCheckout, type CheckoutConfirmation, type CheckoutSession } from "@/lib/payments/checkout";
import type { ActionResult } from "@/lib/validation/common";

import { failure } from "./utils";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function revalidatePublicInvoice(token: string, invoiceId?: string) {
  revalidatePath(`/i/${token}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/notifications");
  if (invoiceId) revalidatePath(documentPath("invoice", invoiceId));
}

/** Creates a Razorpay order for the invoice balance and returns what Checkout needs. */
export async function startCheckoutAction(token: string): Promise<ActionResult<CheckoutSession>> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, error: "This link is not valid." };
  try {
    return { ok: true, data: await startCheckout(token) };
  } catch (error) {
    return failure(error, "Could not start the payment.");
  }
}

/** Verifies the Checkout success payload and records the payment. */
export async function confirmCheckoutAction(token: string, confirmation: CheckoutConfirmation): Promise<ActionResult<{ paymentId: string }>> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, error: "This link is not valid." };
  const ids = [confirmation?.razorpay_order_id, confirmation?.razorpay_payment_id, confirmation?.razorpay_signature];
  if (ids.some((v) => typeof v !== "string" || !v || v.length > 200)) return { ok: false, error: "Incomplete payment details." };
  try {
    const result = await confirmCheckout(token, confirmation);
    revalidatePublicInvoice(token);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Could not confirm the payment.");
  }
}

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
