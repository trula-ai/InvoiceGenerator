"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { invoices } from "@/db/schema";
import { authorize } from "@/lib/auth/current-user";
import { saveInstallmentPlan } from "@/lib/data/installments";
import { db } from "@/lib/db";
import { buildInstallmentSchedule } from "@/lib/installments";
import type { ActionResult } from "@/lib/validation/common";
import { installmentGeneratorSchema, type InstallmentGeneratorInput } from "@/lib/validation/installments";

import { failure, validationFailure } from "./utils";

const idsSchema = z.array(z.uuid()).min(1, "Select at least one invoice").max(100, "Select at most 100 invoices at a time");

export interface BulkInstallmentResult {
  created: string[];
  failed: { invoiceNumber: string; error: string }[];
}

/**
 * Applies one installment configuration (count, frequency, first due date)
 * to several invoices at once. Each invoice gets its own plan generated from
 * its own total; failures on one invoice do not roll back the others.
 */
export async function createInstallmentPlansAction(invoiceIds: string[], input: InstallmentGeneratorInput): Promise<ActionResult<BulkInstallmentResult>> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  const ids = idsSchema.safeParse(invoiceIds);
  if (!ids.success) return validationFailure(ids.error);
  const parsed = installmentGeneratorSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let rows: { id: string; invoiceNumber: string; total: string }[];
  try {
    rows = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, total: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.businessId, business.id), inArray(invoices.id, ids.data)));
  } catch (error) {
    return failure(error, "Could not load the selected invoices.");
  }
  if (!rows.length) return { ok: false, error: "None of the selected invoices were found." };

  const result: BulkInstallmentResult = { created: [], failed: [] };
  for (const inv of rows) {
    try {
      const installments = buildInstallmentSchedule({
        total: inv.total,
        count: parsed.data.count,
        firstDueDate: parsed.data.firstDueDate,
        frequency: parsed.data.frequency,
      }).map((row) => ({ dueDate: row.dueDate, amount: row.amount }));
      await saveInstallmentPlan(business.id, inv.id, { installments });
      result.created.push(inv.invoiceNumber);
    } catch (error) {
      result.failed.push({ invoiceNumber: inv.invoiceNumber, error: error instanceof Error ? error.message : "Could not create the plan." });
    }
    revalidatePath(`/dashboard/invoices/${inv.id}`);
    revalidatePath(`/dashboard/recurring/${inv.id}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/recurring");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/notifications");
  return { ok: true, data: result };
}
