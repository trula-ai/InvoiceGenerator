import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { clients, invoices, type Client } from "@/db/schema";
import { db } from "@/lib/db";
import type { ClientValues } from "@/lib/validation/client";

/**
 * Client data access. Every function takes `businessId` first and scopes all
 * reads and writes to it.
 */

export interface ClientListItem extends Client {
  invoiceCount: number;
  /** Sum of issued invoice totals in INR. */
  totalInvoicedInr: string;
  /** Sum of unpaid balances in INR. */
  outstandingInr: string;
}

export interface ClientListFilters {
  q?: string;
  type?: "b2b" | "b2c";
  includeArchived?: boolean;
}

const ISSUED = sql`${invoices.status} in ('pending', 'partially_paid', 'paid', 'overdue')`;
const UNPAID = sql`${invoices.status} in ('pending', 'partially_paid', 'overdue')`;

export async function listClients(businessId: string, filters: ClientListFilters = {}): Promise<ClientListItem[]> {
  const conditions = [eq(clients.businessId, businessId)];
  if (!filters.includeArchived) conditions.push(isNull(clients.archivedAt));
  if (filters.type) conditions.push(eq(clients.type, filters.type));
  if (filters.q) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(clients.name, pattern),
        ilike(clients.email, pattern),
        ilike(clients.contactName, pattern),
        ilike(clients.gstin, pattern),
        ilike(clients.phone, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      client: clients,
      invoiceCount: sql<number>`count(${invoices.id}) filter (where ${ISSUED})`.mapWith(Number),
      totalInvoicedInr: sql<string>`coalesce(sum(${invoices.totalInr}) filter (where ${ISSUED}), 0)::text`,
      outstandingInr: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${UNPAID}), 0)::numeric(14,2)::text`,
    })
    .from(clients)
    .leftJoin(invoices, eq(invoices.clientId, clients.id))
    .where(and(...conditions))
    .groupBy(clients.id)
    .orderBy(asc(clients.name));

  return rows.map((r) => ({
    ...r.client,
    invoiceCount: r.invoiceCount,
    totalInvoicedInr: r.totalInvoicedInr,
    outstandingInr: r.outstandingInr,
  }));
}

export async function getClient(businessId: string, id: string): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, businessId), eq(clients.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createClient(businessId: string, values: ClientValues): Promise<Client> {
  const [row] = await db
    .insert(clients)
    .values({ ...toRow(values), businessId })
    .returning();
  return row;
}

export async function updateClient(businessId: string, id: string, values: ClientValues): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ ...toRow(values), updatedAt: new Date() })
    .where(and(eq(clients.businessId, businessId), eq(clients.id, id)))
    .returning();
  return row ?? null;
}

export async function setClientArchived(businessId: string, id: string, archived: boolean): Promise<void> {
  await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(clients.businessId, businessId), eq(clients.id, id)));
}

/** Invoices for one client, newest first. */
export async function getClientInvoiceHistory(businessId: string, clientId: string) {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      status: invoices.status,
      currency: invoices.currency,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      totalInr: invoices.totalInr,
      exchangeRate: invoices.exchangeRate,
      lastReminderAt: invoices.lastReminderAt,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.clientId, clientId)))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
}

/** Minimal client rows for pickers (active clients only). */
export async function listClientOptions(businessId: string) {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      type: clients.type,
      currency: clients.currency,
      stateCode: clients.stateCode,
      gstin: clients.gstin,
      email: clients.email,
      country: clients.country,
      shippingAddress: clients.shippingAddress,
    })
    .from(clients)
    .where(and(eq(clients.businessId, businessId), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
}

function toRow(values: ClientValues) {
  return {
    type: values.type,
    name: values.name,
    contactName: values.contactName ?? null,
    email: values.email ?? null,
    phone: values.phone ?? null,
    gstin: values.gstin ?? null,
    addressLine1: values.addressLine1 ?? null,
    addressLine2: values.addressLine2 ?? null,
    city: values.city ?? null,
    state: values.state ?? null,
    stateCode: values.stateCode ?? null,
    postalCode: values.postalCode ?? null,
    country: values.country,
    shippingAddress: values.shippingAddress ?? null,
    currency: values.currency,
    notes: values.notes ?? null,
    autoReminders: values.autoReminders,
  };
}
