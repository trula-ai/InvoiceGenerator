"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorize } from "@/lib/auth/current-user";
import {
  addPaymentEvidence,
  DuplicateReferenceError,
  EVIDENCE_MAX_BYTES,
  recordPayment,
  rejectPayment,
  reversePayment,
  verifyPayment,
  withdrawPendingPayment,
  type DuplicateMatch,
} from "@/lib/data/payments";
import { sendReceiptEmail, type SendReceiptResult } from "@/lib/email/send-receipt";
import type { ActionResult } from "@/lib/validation/common";
import { paymentReasonSchema, paymentSchema, type PaymentFormInput, type PaymentReasonInput } from "@/lib/validation/payment";

import { failure, validationFailure } from "./utils";

function revalidatePayment(invoiceId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  if (invoiceId) revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/payments/verification");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/history");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}

export interface RecordPaymentResult {
  paymentId: string;
}

/**
 * Records a manual payment as pending verification. When the reference
 * matches another payment, the result carries the matches so the form can ask
 * for confirmation and resend with `allowDuplicate`.
 */
export async function recordPaymentAction(input: PaymentFormInput): Promise<ActionResult<RecordPaymentResult> | { ok: false; error: string; duplicates: DuplicateMatch[] }> {
  const auth = await authorize("payments.record");
  if (!auth.ok) return auth;
  const { user, business } = auth.current;
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const paymentId = await recordPayment(business.id, parsed.data, {
      provider: "manual",
      providerPaymentId: null,
      providerOrderId: null,
      recordedByUserId: user.id,
      verified: false,
    });
    revalidatePayment(parsed.data.invoiceId);
    return { ok: true, data: { paymentId } };
  } catch (error) {
    if (error instanceof DuplicateReferenceError) return { ok: false, error: error.message, duplicates: error.matches };
    return failure(error, "Could not record the payment.");
  }
}

const EVIDENCE_FIELD = "file";

/** Attaches one proof file (multipart form with a `file` field) to a payment. */
export async function uploadPaymentEvidenceAction(paymentId: string, invoiceId: string, formData: FormData): Promise<ActionResult<{ evidenceId: string }>> {
  const auth = await authorize("payments.record");
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "Invalid payment." };
  const file = formData.get(EVIDENCE_FIELD);
  if (!(file instanceof File)) return { ok: false, error: "Choose a file to attach." };
  if (file.size > EVIDENCE_MAX_BYTES) return { ok: false, error: `Files must be smaller than ${Math.round(EVIDENCE_MAX_BYTES / 1024 / 1024)} MB.` };

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const evidenceId = await addPaymentEvidence(auth.current.business.id, paymentId, auth.current.user.id, { fileName: file.name, contentType: file.type, data });
    revalidatePayment(invoiceId);
    return { ok: true, data: { evidenceId } };
  } catch (error) {
    return failure(error, "Could not attach the file.");
  }
}

export async function verifyPaymentAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("payments.verify");
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "Invalid payment." };
  try {
    await verifyPayment(auth.current.business.id, paymentId, auth.current.user.id);
    revalidatePayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not verify the payment.");
  }
}

export async function rejectPaymentAction(input: PaymentReasonInput, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("payments.verify");
  if (!auth.ok) return auth;
  const parsed = paymentReasonSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await rejectPayment(auth.current.business.id, parsed.data.paymentId, auth.current.user.id, parsed.data.reason);
    revalidatePayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not reject the payment.");
  }
}

export async function reversePaymentAction(input: PaymentReasonInput, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("payments.reverse");
  if (!auth.ok) return auth;
  const parsed = paymentReasonSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await reversePayment(auth.current.business.id, parsed.data.paymentId, auth.current.user.id, parsed.data.reason);
    revalidatePayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not reverse the payment.");
  }
}

/** Removes a pending entry before anyone reviewed it. */
export async function withdrawPaymentAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("payments.record");
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "Invalid payment." };
  try {
    await withdrawPendingPayment(auth.current.business.id, paymentId);
    revalidatePayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not withdraw the payment.");
  }
}

const sendReceiptSchema = z.object({
  to: z.email("Enter a valid email address").trim().toLowerCase().optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
});

export async function sendReceiptEmailAction(
  paymentId: string,
  input: { to?: string; message?: string },
): Promise<ActionResult<SendReceiptResult>> {
  const auth = await authorize("receipts.send");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  const parsed = sendReceiptSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const result = await sendReceiptEmail(business.id, paymentId, {
      to: parsed.data.to || undefined,
      message: parsed.data.message || undefined,
    });
    revalidatePayment(result.invoiceId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Could not send the receipt.");
  }
}
