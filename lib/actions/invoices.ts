"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { invoices, type DocumentKind } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { getRateToInr, type RateQuote } from "@/lib/data/exchange-rates";
import {
  cancelInvoice,
  convertQuoteToInvoice,
  createInvoice,
  deleteDraftInvoice,
  issueInvoice,
  respondToQuote,
  updateInvoice,
  type QuoteDecision,
} from "@/lib/data/invoices";
import { db } from "@/lib/db";
import { documentBasePath, documentPath, isDocumentKind } from "@/lib/documents";
import { sendInvoiceEmail, type SendInvoiceResult } from "@/lib/email/send-invoice";
import { sendReminderEmail } from "@/lib/email/send-reminder";
import { currencyCode, type ActionResult } from "@/lib/validation/common";
import { invoiceSchema, type InvoiceFormInput } from "@/lib/validation/invoice";

import { failure, validationFailure } from "./utils";

function revalidateDocuments(kind?: DocumentKind, id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/credit-notes");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/history");
  revalidatePath("/dashboard/notifications");
  if (kind && id) revalidatePath(documentPath(kind, id));
}

/** Kind of a document the signed-in business owns, or null. */
async function kindOf(businessId: string, id: string): Promise<DocumentKind | null> {
  const [row] = await db
    .select({ documentKind: invoices.documentKind })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  return row?.documentKind ?? null;
}

export interface CreateDocumentActionOptions {
  kind?: DocumentKind;
  /** Invoice a credit note is issued against. */
  sourceDocumentId?: string;
}

export async function createInvoiceAction(input: InvoiceFormInput, options: CreateDocumentActionOptions = {}): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const kind: DocumentKind = isDocumentKind(options.kind) ? options.kind : "invoice";
  const sourceDocumentId = options.sourceDocumentId && z.uuid().safeParse(options.sourceDocumentId).success ? options.sourceDocumentId : null;

  let id: string;
  try {
    id = await createInvoice(business, parsed.data, { kind, sourceDocumentId });
  } catch (error) {
    return failure(error, "Could not create the document.");
  }

  revalidateDocuments(kind, id);
  if (sourceDocumentId) revalidatePath(documentPath("invoice", sourceDocumentId));
  redirect(documentPath(kind, id));
}

export async function updateInvoiceAction(id: string, input: InvoiceFormInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let kind: DocumentKind;
  try {
    await updateInvoice(business, id, parsed.data);
    kind = (await kindOf(business.id, id)) ?? "invoice";
  } catch (error) {
    return failure(error, "Could not update the document.");
  }

  revalidateDocuments(kind, id);
  redirect(documentPath(kind, id));
}

export async function issueInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await issueInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateDocuments(await kindOf(business.id, id) ?? undefined, id);
  return { ok: true, data: undefined };
}

export async function cancelInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await cancelInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateDocuments(await kindOf(business.id, id) ?? undefined, id);
  return { ok: true, data: undefined };
}

export async function deleteDraftInvoiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  const kind = (await kindOf(business.id, id)) ?? "invoice";
  try {
    await deleteDraftInvoice(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateDocuments();
  redirect(documentBasePath(kind));
}

/** Owner marks a quote accepted or declined on the client's behalf. */
export async function respondToQuoteAction(id: string, decision: QuoteDecision): Promise<ActionResult> {
  const { business } = await requireUser();
  if (decision !== "accepted" && decision !== "declined") return { ok: false, error: "Invalid decision." };
  try {
    await respondToQuote(business.id, id, decision);
  } catch (error) {
    return failure(error);
  }
  revalidateDocuments("quote", id);
  return { ok: true, data: undefined };
}

/** Creates an invoice from a quote and opens it. */
export async function convertQuoteAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  let invoiceId: string;
  try {
    invoiceId = await convertQuoteToInvoice(business, id);
  } catch (error) {
    return failure(error, "Could not convert the quote.");
  }
  revalidateDocuments("quote", id);
  revalidateDocuments("invoice", invoiceId);
  redirect(documentPath("invoice", invoiceId));
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
    revalidateDocuments(await kindOf(business.id, id) ?? undefined, id);
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
    revalidateDocuments("invoice", id);
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
