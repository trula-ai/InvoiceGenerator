import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import {
  businesses,
  clients,
  invoices,
  recurringProfiles,
  type Business,
  type RecurringFrequency,
  type RecurringProfile,
  type RecurringStatus,
  type RecurringTemplate,
} from "@/db/schema";
import { BASE_CURRENCY } from "@/lib/currency";
import { getRateToInr } from "@/lib/data/exchange-rates";
import { createInvoice, getInvoiceDetail } from "@/lib/data/invoices";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import { anchorDayOf, nextRunDate as advance } from "@/lib/recurring";
import type { InvoiceFormValues } from "@/lib/validation/invoice";
import type { RecurringScheduleValues } from "@/lib/validation/recurring";

/**
 * Scheduled invoices (shown as "Scheduled" in the app; the table and code keep
 * the older "recurring profile" name). A profile is created from an issued invoice
 * (its lines become the template) and generates a new invoice on every run
 * date. `runRecurringProfiles` is called by the daily checks; `runProfileNow`
 * backs the "Generate now" button.
 */

export interface RecurringListItem extends RecurringProfile {
  clientName: string;
  lastInvoiceNumber: string | null;
}

export interface GeneratedInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: string;
  currency: string;
}

/** Safety valve: a profile that fell far behind produces at most this many invoices per run. */
const MAX_CATCH_UP = 12;

export async function listRecurringProfiles(businessId: string, status?: RecurringStatus): Promise<RecurringListItem[]> {
  const conditions = [eq(recurringProfiles.businessId, businessId)];
  if (status) conditions.push(eq(recurringProfiles.status, status));
  const rows = await db
    .select({ profile: recurringProfiles, clientName: clients.name, lastInvoiceNumber: invoices.invoiceNumber })
    .from(recurringProfiles)
    .innerJoin(clients, eq(clients.id, recurringProfiles.clientId))
    .leftJoin(invoices, eq(invoices.id, recurringProfiles.lastInvoiceId))
    .where(and(...conditions))
    .orderBy(asc(recurringProfiles.status), asc(recurringProfiles.nextRunDate), asc(recurringProfiles.name));
  return rows.map((r) => ({ ...r.profile, clientName: r.clientName, lastInvoiceNumber: r.lastInvoiceNumber }));
}

export async function getRecurringProfile(businessId: string, id: string): Promise<(RecurringProfile & { clientName: string; clientEmail: string | null }) | null> {
  const [row] = await db
    .select({ profile: recurringProfiles, clientName: clients.name, clientEmail: clients.email })
    .from(recurringProfiles)
    .innerJoin(clients, eq(clients.id, recurringProfiles.clientId))
    .where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.id, id)))
    .limit(1);
  return row ? { ...row.profile, clientName: row.clientName, clientEmail: row.clientEmail } : null;
}

export async function listGeneratedInvoices(businessId: string, profileId: string): Promise<GeneratedInvoice[]> {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      total: invoices.total,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.recurringProfileId, profileId)))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
}

/** Builds the template from an existing invoice of this business. */
export async function templateFromInvoice(businessId: string, invoiceId: string): Promise<{ template: RecurringTemplate; clientId: string; invoiceNumber: string; currency: string }> {
  const detail = await getInvoiceDetail(businessId, invoiceId);
  if (!detail || detail.invoice.documentKind !== "invoice") throw new Error("Scheduled invoices are created from an invoice.");
  const { invoice, items } = detail;
  const template: RecurringTemplate = {
    invoiceType: invoice.invoiceType,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
    placeOfSupplyCode: invoice.placeOfSupplyCode ?? undefined,
    discountType: invoice.discountType,
    discountValue: invoice.discountType === "none" ? "0" : invoice.discountValue,
    poNumber: invoice.poNumber ?? undefined,
    reference: invoice.reference ?? undefined,
    shipToAddress: invoice.shipToAddress ?? undefined,
    notes: invoice.notes ?? undefined,
    terms: invoice.terms ?? undefined,
    items: items.map((i) => ({
      itemId: i.itemId ?? undefined,
      description: i.description,
      hsnSac: i.hsnSac ?? undefined,
      quantity: String(Number(i.quantity)),
      unit: i.unit ?? undefined,
      unitPrice: i.unitPrice,
      taxRate: String(Number(i.taxRate)),
    })),
  };
  return { template, clientId: invoice.clientId, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency };
}

export async function createRecurringProfile(businessId: string, invoiceId: string, values: RecurringScheduleValues): Promise<string> {
  const { template, clientId, invoiceNumber, currency } = await templateFromInvoice(businessId, invoiceId);
  const [row] = await db
    .insert(recurringProfiles)
    .values({
      businessId,
      clientId,
      name: values.name,
      frequency: values.frequency as RecurringFrequency,
      startDate: values.startDate,
      nextRunDate: values.startDate,
      endDate: values.endDate ?? null,
      maxOccurrences: values.maxOccurrences ?? null,
      autoSend: values.autoSend,
      template,
      sourceInvoiceNumber: invoiceNumber,
      currency,
    })
    .returning({ id: recurringProfiles.id });
  return row.id;
}

export async function updateRecurringSchedule(businessId: string, id: string, values: RecurringScheduleValues): Promise<void> {
  const existing = await getRecurringProfile(businessId, id);
  if (!existing) throw new Error("Schedule not found.");
  // Keep the next run where it is unless the start moved into the future of it.
  const nextRun = existing.occurrences === 0 ? values.startDate : existing.nextRunDate < values.startDate ? values.startDate : existing.nextRunDate;
  const endedByDate = values.endDate ? nextRun > values.endDate : false;
  const endedByCount = values.maxOccurrences ? existing.occurrences >= values.maxOccurrences : false;
  await db
    .update(recurringProfiles)
    .set({
      name: values.name,
      frequency: values.frequency as RecurringFrequency,
      startDate: values.startDate,
      nextRunDate: nextRun,
      endDate: values.endDate ?? null,
      maxOccurrences: values.maxOccurrences ?? null,
      autoSend: values.autoSend,
      status: endedByDate || endedByCount ? "ended" : existing.status === "ended" ? "active" : existing.status,
      updatedAt: new Date(),
    })
    .where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.id, id)));
}

export async function setRecurringStatus(businessId: string, id: string, status: RecurringStatus): Promise<void> {
  const existing = await getRecurringProfile(businessId, id);
  if (!existing) throw new Error("Schedule not found.");
  const patch: Partial<typeof recurringProfiles.$inferInsert> = { status, updatedAt: new Date() };
  // Resuming a schedule whose next run is in the past moves it to today so it does not back-fill months at once.
  if (status === "active" && existing.nextRunDate < todayIso()) patch.nextRunDate = todayIso();
  await db.update(recurringProfiles).set(patch).where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.id, id)));
}

export async function deleteRecurringProfile(businessId: string, id: string): Promise<void> {
  await db.delete(recurringProfiles).where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.id, id)));
}

/** Form values for one generated invoice, dated `issueDate`. */
async function valuesFor(business: Business, profile: RecurringProfile, issueDate: string): Promise<InvoiceFormValues> {
  const t = profile.template;
  let exchangeRate = "1";
  let exchangeRateSource: InvoiceFormValues["exchangeRateSource"] = "base";
  if (t.currency !== BASE_CURRENCY) {
    try {
      const quote = await getRateToInr(t.currency);
      exchangeRate = quote.rate;
      exchangeRateSource = "api";
    } catch {
      exchangeRate = t.exchangeRate;
      exchangeRateSource = "manual";
    }
  }
  return {
    clientId: profile.clientId,
    invoiceType: t.invoiceType,
    issueDate,
    dueDate: addDaysIso(issueDate, business.paymentTermsDays),
    poNumber: t.poNumber,
    reference: t.reference,
    shipToAddress: t.shipToAddress,
    currency: t.currency,
    exchangeRate,
    exchangeRateSource,
    placeOfSupplyCode: t.placeOfSupplyCode,
    discountType: t.discountType,
    discountValue: t.discountValue,
    notes: t.notes,
    terms: t.terms,
    items: t.items.map((i) => ({
      itemId: i.itemId,
      description: i.description,
      hsnSac: i.hsnSac,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    })),
    status: "pending",
  };
}

export interface RecurringRunSummary {
  businessId: string;
  created: number;
  emailed: number;
  failed: number;
}

/**
 * Generates every invoice that is due for one profile, up to MAX_CATCH_UP.
 * The profile row is locked and `nextRunDate` advanced in the same
 * transaction as the invoice insert, so concurrent runs cannot double-bill.
 */
async function runProfile(business: Business, profileId: string, today: string, force: boolean): Promise<{ created: string[]; emailed: number; failed: number }> {
  const created: string[] = [];
  let emailed = 0;
  let failed = 0;

  for (let i = 0; i < MAX_CATCH_UP; i += 1) {
    const result = await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(recurringProfiles)
        .where(and(eq(recurringProfiles.businessId, business.id), eq(recurringProfiles.id, profileId)))
        .for("update", { skipLocked: true })
        .limit(1);
      if (!p || p.status !== "active") return null;
      const due = force && created.length === 0 ? true : p.nextRunDate <= today;
      if (!due) return null;
      if (p.endDate && p.nextRunDate > p.endDate) {
        await tx.update(recurringProfiles).set({ status: "ended", updatedAt: new Date() }).where(eq(recurringProfiles.id, p.id));
        return null;
      }

      const issueDate = force && p.nextRunDate > today ? today : p.nextRunDate;
      let invoiceId: string;
      try {
        const values = await valuesFor(business, p, issueDate);
        invoiceId = await createInvoice(business, values, { kind: "invoice", recurringProfileId: p.id });
      } catch (error) {
        await tx
          .update(recurringProfiles)
          .set({ lastError: error instanceof Error ? error.message : String(error), updatedAt: new Date() })
          .where(eq(recurringProfiles.id, p.id));
        throw error;
      }

      const occurrences = p.occurrences + 1;
      const next = advance(force && p.nextRunDate > today ? p.nextRunDate : issueDate, p.frequency, anchorDayOf(p.startDate));
      const ended = (p.endDate !== null && next > p.endDate) || (p.maxOccurrences !== null && occurrences >= p.maxOccurrences);
      await tx
        .update(recurringProfiles)
        .set({
          nextRunDate: force && p.nextRunDate > today ? p.nextRunDate : next,
          occurrences,
          lastRunAt: new Date(),
          lastInvoiceId: invoiceId,
          lastError: null,
          status: ended ? "ended" : "active",
          updatedAt: new Date(),
        })
        .where(eq(recurringProfiles.id, p.id));
      return { invoiceId, autoSend: p.autoSend };
    });

    if (!result) break;
    created.push(result.invoiceId);
    await notifyInvoiceEvent(business.id, result.invoiceId, "invoice_issued");
    if (result.autoSend) {
      try {
        // Loaded lazily: the email module pulls in the PDF renderer, which only the send path needs.
        const { sendInvoiceEmail } = await import("@/lib/email/send-invoice");
        await sendInvoiceEmail(business.id, result.invoiceId);
        emailed += 1;
      } catch (error) {
        failed += 1;
        console.error(`[recurring] email for ${result.invoiceId} failed:`, error instanceof Error ? error.message : error);
      }
    }
    if (force) break;
  }
  return { created, emailed, failed };
}

/** Generates all invoices due today (or earlier) for one business. Never throws for a single bad profile. */
export async function runRecurringProfiles(businessId: string, today = todayIso()): Promise<RecurringRunSummary> {
  const summary: RecurringRunSummary = { businessId, created: 0, emailed: 0, failed: 0 };
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) return summary;
  const due = await db
    .select({ id: recurringProfiles.id })
    .from(recurringProfiles)
    .where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.status, "active"), lte(recurringProfiles.nextRunDate, today)));
  for (const row of due) {
    try {
      const r = await runProfile(business, row.id, today, false);
      summary.created += r.created.length;
      summary.emailed += r.emailed;
      summary.failed += r.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`[recurring] profile ${row.id} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}

/** "Generate now": creates the next invoice immediately, dated today if the schedule is ahead of today. */
export async function runProfileNow(business: Business, profileId: string): Promise<string> {
  const r = await runProfile(business, profileId, todayIso(), true);
  if (!r.created.length) throw new Error("Nothing was generated. The schedule may be paused or ended.");
  return r.created[0];
}

/** Count of profiles that will run on or before today, for the dashboard badge. */
export async function countDueRecurring(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(recurringProfiles)
    .where(and(eq(recurringProfiles.businessId, businessId), eq(recurringProfiles.status, "active"), lte(recurringProfiles.nextRunDate, todayIso())));
  return row?.count ?? 0;
}
