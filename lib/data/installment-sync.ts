import { asc, eq } from "drizzle-orm";

import { invoiceInstallments } from "@/db/schema";
import { allocatePaid } from "@/lib/installments";
import type { Database } from "@/lib/db";
import { D } from "@/lib/money";

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

export interface InstallmentSyncResult {
  hasPlan: boolean;
  /** Due date of the first unpaid installment, or the last installment once all are paid. */
  effectiveDueDate: string | null;
  count: number;
}

/**
 * Re-derives every installment's `paidAmount` from the invoice's paid plus
 * credited total and reports the date the invoice is now due. Called from
 * `applyPaymentTotals` inside the same transaction that changed the totals,
 * so the plan and the invoice can never disagree.
 *
 * Kept separate from lib/data/invoices.ts (which imports it) to avoid an
 * import cycle with lib/data/installments.ts.
 */
export async function syncInstallmentAllocation(tx: Tx, invoiceId: string, coveredTotal: string): Promise<InstallmentSyncResult> {
  const rows = await tx.select().from(invoiceInstallments).where(eq(invoiceInstallments.invoiceId, invoiceId)).orderBy(asc(invoiceInstallments.sequence));
  if (rows.length === 0) return { hasPlan: false, effectiveDueDate: null, count: 0 };

  const now = new Date();
  const allocated = allocatePaid(rows, coveredTotal);
  let effectiveDueDate: string | null = null;
  for (const { row, paidAmount, settled } of allocated) {
    if (!settled && effectiveDueDate === null) effectiveDueDate = row.dueDate;
    const paidAt = settled ? (row.paidAt ?? now) : null;
    const changed = !D(row.paidAmount).equals(D(paidAmount)) || (row.paidAt?.getTime() ?? null) !== (paidAt?.getTime() ?? null);
    if (changed) {
      await tx.update(invoiceInstallments).set({ paidAmount, paidAt, updatedAt: now }).where(eq(invoiceInstallments.id, row.id));
    }
  }
  return { hasPlan: true, effectiveDueDate: effectiveDueDate ?? rows[rows.length - 1].dueDate, count: rows.length };
}
