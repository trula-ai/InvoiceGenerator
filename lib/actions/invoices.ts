"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { getRateToInr, type RateQuote } from "@/lib/data/exchange-rates";
import {
  cancelInvoice,
  createInvoice,
  deleteDraftInvoice,
  issueInvoice,
  updateInvoice,
} from "@/lib/data/invoices";
import { sendInvoiceEmail, type SendInvoiceResult } from "@/lib/email/send-invoice";
import { sendReminderEmail } from "@/lib/email/send-reminder";
import { currencyCode, type ActionResult } from "@/lib/validation/common";
import { invoiceSchema, type InvoiceFormInput } from "@/lib/validation/invoice";

import { failure, validationFailure } from "./utils";

function revalidateInvoice(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/history");
  if (id) revalidatePath(`/dashboard/invoices/${id}`);
}

export async function createInvoiceAction(input: InvoiceFormInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let id: string;
  try {
    id = await createInvoice(business, parsed.data);
  } catch (error) {
    return failure(error, "Could not create the invoice.");
  }

  revalidateInvoice(id);
  redirect(`/dashboard/invoices/${id}`);
}

export async function updateInvoiceAction(id: string, input: InvoiceFormInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateInvoice(business, id, parsed.data);
  } catch (error) {
    return failure(error, "Could not update the invoice.");
  }

  revalidateInvoice(id);
  redirect(`/dashboard/invoices/${id}`);
}

export async function issueInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await issueInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateInvoice(id);
  return { ok: true, data: undefined };
}

export async function cancelInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await cancelInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateInvoice(id);
  return { ok: true, data: undefined };
}

export async function deleteDraftInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await deleteDraftInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateInvoice();
  redirect("/dashboard/invoices");
}

const sendSchema = z.object({
  to: z.email("Enter a valid email address").trim().toLowerCase().optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
});

export async function sendInvoiceEmailAction(
  id: string,
  input: { to?: string; message?: string },
): Promise<ActionResult<SendInvoiceResult>> {
  const { business } = await requireUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const result = await sendInvoiceEmail(business.id, id, {
      to: parsed.data.to || undefined,
      message: parsed.data.message || undefined,
    });
    revalidateInvoice(id);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Could not send the email.");
  }
}

export async function sendReminderEmailAction(
  id: string,
  input: { to?: string; message?: string },
): Promise<ActionResult<SendInvoiceResult>> {
  const { business } = await requireUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const result = await sendReminderEmail(business.id, id, {
      to: parsed.data.to || undefined,
      message: parsed.data.message || undefined,
    });
    revalidateInvoice(id);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Could not send the reminder.");
  }
}

/** Live rate lookup for the invoice form. */
export async function fetchExchangeRateAction(currency: string): Promise<ActionResult<RateQuote>> {
  await requireUser();
  const parsed = currencyCode.safeParse(currency);
  if (!parsed.success) return { ok: false, error: "Unsupported currency." };
  try {
    return { ok: true, data: await getRateToInr(parsed.data) };
  } catch (error) {
    return failure(error, "Could not fetch the exchange rate.");
  }
}
