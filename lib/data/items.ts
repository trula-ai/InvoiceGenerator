import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { invoiceItems, items, type Item } from "@/db/schema";
import { db } from "@/lib/db";
import type { ItemValues } from "@/lib/validation/item";

/**
 * Item catalog data access. Every function takes `businessId` first and scopes
 * all reads and writes to it.
 */

export interface ItemListItem extends Item {
  /** How many invoice lines were created from this item. */
  usageCount: number;
}

export interface ItemListFilters {
  q?: string;
  includeArchived?: boolean;
}

/** The subset the invoice form needs to fill a line from the catalog. */
export interface ItemOption {
  id: string;
  name: string;
  description: string | null;
  hsnSac: string | null;
  unit: string | null;
  unitPrice: string;
  taxRate: string;
}

export async function listItems(businessId: string, filters: ItemListFilters = {}): Promise<ItemListItem[]> {
  const conditions = [eq(items.businessId, businessId)];
  if (!filters.includeArchived) conditions.push(isNull(items.archivedAt));
  if (filters.q) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(or(ilike(items.name, pattern), ilike(items.description, pattern), ilike(items.hsnSac, pattern))!);
  }

  const rows = await db
    .select({
      item: items,
      usageCount: sql<number>`count(${invoiceItems.id})`.mapWith(Number),
    })
    .from(items)
    .leftJoin(invoiceItems, eq(invoiceItems.itemId, items.id))
    .where(and(...conditions))
    .groupBy(items.id)
    .orderBy(asc(items.name));

  return rows.map((r) => ({ ...r.item, usageCount: r.usageCount }));
}

export async function getItem(businessId: string, id: string): Promise<Item | null> {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.businessId, businessId), eq(items.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createItem(businessId: string, values: ItemValues): Promise<Item> {
  const [row] = await db
    .insert(items)
    .values({ ...toRow(values), businessId })
    .returning();
  return row;
}

export async function updateItem(businessId: string, id: string, values: ItemValues): Promise<Item | null> {
  const [row] = await db
    .update(items)
    .set({ ...toRow(values), updatedAt: new Date() })
    .where(and(eq(items.businessId, businessId), eq(items.id, id)))
    .returning();
  return row ?? null;
}

export async function setItemArchived(businessId: string, id: string, archived: boolean): Promise<void> {
  await db
    .update(items)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(items.businessId, businessId), eq(items.id, id)));
}

/** Active items for the invoice form picker. */
export async function listItemOptions(businessId: string): Promise<ItemOption[]> {
  return db
    .select({
      id: items.id,
      name: items.name,
      description: items.description,
      hsnSac: items.hsnSac,
      unit: items.unit,
      unitPrice: items.unitPrice,
      taxRate: items.taxRate,
    })
    .from(items)
    .where(and(eq(items.businessId, businessId), isNull(items.archivedAt)))
    .orderBy(asc(items.name));
}

function toRow(values: ItemValues) {
  return {
    name: values.name,
    description: values.description ?? null,
    hsnSac: values.hsnSac ?? null,
    unit: values.unit ?? null,
    unitPrice: values.unitPrice,
    taxRate: values.taxRate,
  };
}
