"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { deletePayment, recordPayment } from "@/lib/data/payments";
import { sendReceiptEmail, type SendReceiptResult } from "@/lib/email/send-receipt";
import type { ActionResult } from "@/lib/validation/common";
import { paymentSchema, type PaymentFormInput } from "@/lib/validation/payment";

import { failure, validationFailure } from "./utils";

function revalidatePayment(invoiceId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/history");
}

export async function recordPaymentAction(input: PaymentFormInput): Promise<ActionResult<{ paymentId: string }>> {
  const { business } = await requireUser();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const paymentId = await recordPayment(business.id, parsed.data);
    revalidatePayment(parsed.data.invoiceId);
    return { ok: true, data: { paymentId } };
  } catch (error) {
    return failure(error, "Could not record the payment.");
  }
}

export async function deletePaymentAction(id: string, invoiceId: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await deletePayment(business.id, id);
    revalidatePayment(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not delete the payment.");
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
  const { business } = await requireUser();
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
