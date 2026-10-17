import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  attributionEvents,
  clients,
  invoices,
  payments,
  saleAttributions,
  users,
  type AttributionAction,
  type AttributionEvent,
  type AttributionStatus,
  type SaleAttribution,
  type UserRole,
} from "@/db/schema";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db, type Database } from "@/lib/db";

/**
 * Sales attribution data access: who is credited with each invoice and the
 * sales manager's decision about it. Independent of payment verification by
 * design: nothing here reads or writes `payments.status`, and
 * `lib/data/payments.ts` never touches these tables.
 *
 * Every function takes `businessId` first and scopes reads and writes to it.
 */

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

/** Roles that can be credited with a sale. */
export const CREDITABLE_ROLES: UserRole[] = ["salesperson", "sales_manager", "admin"];

export const ATTRIBUTION_STATUS_LABELS: Record<AttributionStatus, string> = {
  pending: "Awaiting sales approval",
  approved: "Approved",
  rejected: "Rejected",
};

export interface SalespersonOption {
  id: string;
  name: string;
  roles: UserRole[];
}

/** Active members who can be credited with a sale, for the picker. */
export async function listSalespeople(businessId: string): Promise<SalespersonOption[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, roles: users.roles })
    .from(users)
    .where(and(eq(users.businessId, businessId), isNull(users.disabledAt), sql`${users.roles} && ${sql.raw(`'{${CREDITABLE_ROLES.join(",")}}'::user_role[]`)}`))
    .orderBy(asc(users.name));
  return rows;
}

const credited = alias(users, "credited");
const assignedBy = alias(users, "assigned_by");
const reviewedBy = alias(users, "reviewed_by");
const previous = alias(users, "previous_owner");
const actor = alias(users, "actor");
const fromUser = alias(users, "from_user");
const toUser = alias(users, "to_user");

export interface AttributionDetail extends SaleAttribution {
  creditedName: string;
  assignedByName: string | null;
  reviewedByName: string | null;
  previousCreditedName: string | null;
}

export interface AttributionEventDetail extends AttributionEvent {
  actorName: string | null;
  fromName: string | null;
  toName: string | null;
}

const detailColumns = {
  attribution: saleAttributions,
  creditedName: credited.name,
  assignedByName: assignedBy.name,
  reviewedByName: reviewedBy.name,
  previousCreditedName: previous.name,
};

function toDetail(r: { attribution: SaleAttribution; creditedName: string; assignedByName: string | null; reviewedByName: string | null; previousCreditedName: string | null }): AttributionDetail {
  return { ...r.attribution, creditedName: r.creditedName, assignedByName: r.assignedByName, reviewedByName: r.reviewedByName, previousCreditedName: r.previousCreditedName };
}

function detailQuery(tx: Tx) {
  return tx
    .select(detailColumns)
    .from(saleAttributions)
    .innerJoin(credited, eq(credited.id, saleAttributions.creditedUserId))
    .leftJoin(assignedBy, eq(assignedBy.id, saleAttributions.assignedByUserId))
    .leftJoin(reviewedBy, eq(reviewedBy.id, saleAttributions.reviewedByUserId))
    .leftJoin(previous, eq(previous.id, saleAttributions.previousCreditedUserId));
}

/** The attribution of one invoice, or null when nobody has been credited yet. */
export async function getInvoiceAttribution(businessId: string, invoiceId: string): Promise<AttributionDetail | null> {
  const [row] = await detailQuery(db)
    .where(and(eq(saleAttributions.businessId, businessId), eq(saleAttributions.invoiceId, invoiceId)))
    .limit(1);
  return row ? toDetail(row) : null;
}

export async function listAttributionEvents(businessId: string, attributionId: string): Promise<AttributionEventDetail[]> {
  const rows = await db
    .select({ event: attributionEvents, actorName: actor.name, fromName: fromUser.name, toName: toUser.name })
    .from(attributionEvents)
    .leftJoin(actor, eq(actor.id, attributionEvents.actorUserId))
    .leftJoin(fromUser, eq(fromUser.id, attributionEvents.fromUserId))
    .leftJoin(toUser, eq(toUser.id, attributionEvents.toUserId))
    .where(and(eq(attributionEvents.businessId, businessId), eq(attributionEvents.attributionId, attributionId)))
    .orderBy(desc(attributionEvents.createdAt));
  return rows.map((r) => ({ ...r.event, actorName: r.actorName, fromName: r.fromName, toName: r.toName }));
}

/**
 * Default owner for a new proposal: the member approved for this client's
 * most recent sale, so later invoices for the same client inherit the owner
 * unless someone says otherwise (D-08 in the requirements).
 */
export async function getClientSalesOwner(businessId: string, clientId: string): Promise<{ userId: string; name: string } | null> {
  const [row] = await db
    .select({ userId: saleAttributions.creditedUserId, name: credited.name })
    .from(saleAttributions)
    .innerJoin(credited, eq(credited.id, saleAttributions.creditedUserId))
    .innerJoin(invoices, eq(invoices.id, saleAttributions.invoiceId))
    .where(and(eq(saleAttributions.businessId, businessId), eq(saleAttributions.clientId, clientId), eq(saleAttributions.status, "approved")))
    .orderBy(desc(invoices.issueDate), desc(saleAttributions.reviewedAt))
    .limit(1);
  return row ?? null;
}

async function assertCreditable(tx: Tx, businessId: string, userId: string): Promise<{ id: string; name: string }> {
  const [member] = await tx
    .select({ id: users.id, name: users.name, roles: users.roles, disabledAt: users.disabledAt })
    .from(users)
    .where(and(eq(users.businessId, businessId), eq(users.id, userId)))
    .limit(1);
  if (!member) throw new Error("That person is not a member of your business.");
  if (member.disabledAt) throw new Error(`${member.name} is deactivated and cannot be credited with a sale.`);
  if (!member.roles.some((r) => CREDITABLE_ROLES.includes(r))) throw new Error(`${member.name} does not have a sales role.`);
  return { id: member.id, name: member.name };
}

async function logEvent(tx: Tx, businessId: string, attributionId: string, action: AttributionAction, actorUserId: string | null, fromUserId: string | null, toUserId: string | null, note: string | null) {
  await tx.insert(attributionEvents).values({ businessId, attributionId, action, actorUserId, fromUserId, toUserId, note });
}

async function lockAttribution(tx: Tx, businessId: string, id: string): Promise<SaleAttribution> {
  const [row] = await tx
    .select()
    .from(saleAttributions)
    .where(and(eq(saleAttributions.businessId, businessId), eq(saleAttributions.id, id)))
    .for("update")
    .limit(1);
  if (!row) throw new Error("Attribution not found.");
  return row;
}

export interface ProposeInput {
  invoiceId: string;
  creditedUserId: string;
  reason?: string | null;
}

/**
 * Proposes who should be credited with an invoice. Creates the attribution
 * when none exists; while it is pending or rejected the proposal can be
 * changed. Once approved, only `reassignAttribution` (sales manager) may
 * change the owner.
 */
export async function proposeAttribution(businessId: string, actorUserId: string, input: ProposeInput, tx?: Tx): Promise<string> {
  const run = async (t: Tx): Promise<string> => {
    const [invoice] = await t
      .select({ id: invoices.id, clientId: invoices.clientId, documentKind: invoices.documentKind, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.id, input.invoiceId)))
      .for("update")
      .limit(1);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.documentKind !== "invoice") throw new Error("Sales credit is recorded on invoices only.");
    if (invoice.status === "cancelled") throw new Error("A cancelled invoice cannot be credited to anyone.");

    const member = await assertCreditable(t, businessId, input.creditedUserId);
    const reason = input.reason?.trim() || null;
    const now = new Date();

    const [existing] = await t.select().from(saleAttributions).where(eq(saleAttributions.invoiceId, invoice.id)).for("update").limit(1);
    if (!existing) {
      const [created] = await t
        .insert(saleAttributions)
        .values({ businessId, invoiceId: invoice.id, clientId: invoice.clientId, creditedUserId: member.id, assignedByUserId: actorUserId, assignedAt: now, reason, status: "pending" })
        .returning({ id: saleAttributions.id });
      await logEvent(t, businessId, created.id, "proposed", actorUserId, null, member.id, reason);
      await notifyInvoiceEvent(businessId, invoice.id, "attribution_pending", { to: member.name }, t);
      return created.id;
    }

    if (existing.status === "approved") {
      throw new Error(`This sale is already approved for ${(await assertCreditable(t, businessId, existing.creditedUserId)).name}. Ask a sales manager to reassign it.`);
    }
    if (existing.status === "pending" && existing.creditedUserId === member.id) {
      throw new Error(`${member.name} is already proposed for this sale and awaiting approval.`);
    }
    await t
      .update(saleAttributions)
      .set({ creditedUserId: member.id, assignedByUserId: actorUserId, assignedAt: now, reason, status: "pending", reviewedByUserId: null, reviewedAt: null, reviewNote: null, updatedAt: now })
      .where(eq(saleAttributions.id, existing.id));
    await logEvent(t, businessId, existing.id, existing.status === "rejected" ? "reproposed" : "proposed", actorUserId, existing.creditedUserId, member.id, reason);
    await notifyInvoiceEvent(businessId, invoice.id, "attribution_pending", { to: member.name }, t);
    return existing.id;
  };
  return tx ? run(tx) : db.transaction(run);
}

export interface ReviewOptions {
  /** Admins may approve a sale credited to themselves; sales managers may not. */
  actorIsAdmin: boolean;
}

/** Sales manager agrees with the proposed owner. */
export async function approveAttribution(businessId: string, actorUserId: string, id: string, note: string | null, options: ReviewOptions): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockAttribution(tx, businessId, id);
    if (row.status === "approved") throw new Error("This attribution is already approved.");
    if (row.status === "rejected") throw new Error("This attribution was rejected. The salesperson must propose again before it can be approved.");
    if (row.creditedUserId === actorUserId && !options.actorIsAdmin) {
      throw new Error("You cannot approve a sale credited to yourself. Ask another sales manager or an admin.");
    }
    const now = new Date();
    await tx
      .update(saleAttributions)
      .set({ status: "approved", reviewedByUserId: actorUserId, reviewedAt: now, reviewNote: note?.trim() || null, updatedAt: now })
      .where(eq(saleAttributions.id, id));
    await logEvent(tx, businessId, id, "approved", actorUserId, row.creditedUserId, row.creditedUserId, note?.trim() || null);
    const [owner] = await tx.select({ name: users.name }).from(users).where(eq(users.id, row.creditedUserId)).limit(1);
    await notifyInvoiceEvent(businessId, row.invoiceId, "attribution_approved", { to: owner?.name }, tx);
  });
}

/** Sales manager disagrees; the proposer can try again. */
export async function rejectAttribution(businessId: string, actorUserId: string, id: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockAttribution(tx, businessId, id);
    if (row.status !== "pending") throw new Error(`Only pending attributions can be rejected; this one is ${row.status}.`);
    const now = new Date();
    await tx
      .update(saleAttributions)
      .set({ status: "rejected", reviewedByUserId: actorUserId, reviewedAt: now, reviewNote: reason.trim(), updatedAt: now })
      .where(eq(saleAttributions.id, id));
    await logEvent(tx, businessId, id, "rejected", actorUserId, row.creditedUserId, row.creditedUserId, reason.trim());
    const [owner] = await tx.select({ name: users.name }).from(users).where(eq(users.id, row.creditedUserId)).limit(1);
    await notifyInvoiceEvent(businessId, row.invoiceId, "attribution_rejected", { to: owner?.name, error: reason.trim() }, tx);
  });
}

/**
 * Sales manager credits a different member, from a pending or an approved
 * attribution. The result is approved; the prior owner is kept on the row
 * and in the event log.
 */
export async function reassignAttribution(businessId: string, actorUserId: string, id: string, newUserId: string, reason: string, options: ReviewOptions): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockAttribution(tx, businessId, id);
    if (row.status === "rejected") throw new Error("This attribution was rejected. Propose an owner first, then approve or reassign.");
    if (row.creditedUserId === newUserId) throw new Error("That person is already credited with this sale.");
    const member = await assertCreditable(tx, businessId, newUserId);
    if (member.id === actorUserId && !options.actorIsAdmin) {
      throw new Error("You cannot reassign a sale to yourself. Ask another sales manager or an admin.");
    }
    const now = new Date();
    await tx
      .update(saleAttributions)
      .set({
        previousCreditedUserId: row.creditedUserId,
        creditedUserId: member.id,
        status: "approved",
        reviewedByUserId: actorUserId,
        reviewedAt: now,
        reviewNote: reason.trim(),
        updatedAt: now,
      })
      .where(eq(saleAttributions.id, id));
    await logEvent(tx, businessId, id, "reassigned", actorUserId, row.creditedUserId, member.id, reason.trim());
    await notifyInvoiceEvent(businessId, row.invoiceId, "attribution_reassigned", { to: member.name, error: reason.trim() }, tx);
  });
}

// --- Approval queue ---------------------------------------------------------

export interface AttributionQueueItem extends AttributionDetail {
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceTotal: string;
  currency: string;
  issueDate: string;
  clientName: string;
  /** Context only: the finance side of the same sale, never changed from here. */
  verifiedPaymentCount: number;
  pendingPaymentCount: number;
}

/** Attributions awaiting a sales manager's decision, oldest first. */
export async function listAttributionQueue(businessId: string, statuses: AttributionStatus[] = ["pending"]): Promise<AttributionQueueItem[]> {
  const rows = await db
    .select({
      ...detailColumns,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
      invoiceTotal: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      clientName: clients.name,
      verifiedPaymentCount: sql<number>`(select count(*) from ${payments} where ${payments.invoiceId} = ${invoices.id} and ${payments.status} = 'verified')`.mapWith(Number),
      pendingPaymentCount: sql<number>`(select count(*) from ${payments} where ${payments.invoiceId} = ${invoices.id} and ${payments.status} = 'pending')`.mapWith(Number),
    })
    .from(saleAttributions)
    .innerJoin(invoices, eq(invoices.id, saleAttributions.invoiceId))
    .innerJoin(clients, eq(clients.id, saleAttributions.clientId))
    .innerJoin(credited, eq(credited.id, saleAttributions.creditedUserId))
    .leftJoin(assignedBy, eq(assignedBy.id, saleAttributions.assignedByUserId))
    .leftJoin(reviewedBy, eq(reviewedBy.id, saleAttributions.reviewedByUserId))
    .leftJoin(previous, eq(previous.id, saleAttributions.previousCreditedUserId))
    .where(and(eq(saleAttributions.businessId, businessId), inArray(saleAttributions.status, statuses)))
    .orderBy(asc(saleAttributions.assignedAt));
  return rows.map((r) => ({
    ...toDetail(r),
    invoiceNumber: r.invoiceNumber,
    invoiceStatus: r.invoiceStatus,
    invoiceTotal: r.invoiceTotal,
    currency: r.currency,
    issueDate: r.issueDate,
    clientName: r.clientName,
    verifiedPaymentCount: r.verifiedPaymentCount,
    pendingPaymentCount: r.pendingPaymentCount,
  }));
}

export async function countPendingAttributions(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(saleAttributions)
    .where(and(eq(saleAttributions.businessId, businessId), eq(saleAttributions.status, "pending")));
  return row?.count ?? 0;
}

/** Attribution per invoice for a list of invoices (client page, lists), keyed by invoice id. */
export async function mapInvoiceAttributions(businessId: string, invoiceIds: string[]): Promise<Map<string, AttributionDetail>> {
  const map = new Map<string, AttributionDetail>();
  if (invoiceIds.length === 0) return map;
  const rows = await detailQuery(db).where(and(eq(saleAttributions.businessId, businessId), or(...invoiceIds.map((id) => eq(saleAttributions.invoiceId, id)))!));
  for (const r of rows) map.set(r.attribution.invoiceId, toDetail(r));
  return map;
}
