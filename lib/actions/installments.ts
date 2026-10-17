"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authorize } from "@/lib/auth/current-user";
import { deleteInstallmentPlan, saveInstallmentPlan } from "@/lib/data/installments";
import type { ActionResult } from "@/lib/validation/common";
import { installmentPlanSchema, type InstallmentPlanInput } from "@/lib/validation/installments";

import { failure, validationFailure } from "./utils";

function revalidateInstallments(invoiceId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/recurring");
  revalidatePath(`/dashboard/recurring/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/notifications");
}

/** Creates or replaces the installment plan of an invoice, then opens the invoice. */
export async function saveInstallmentPlanAction(invoiceId: string, input: InstallmentPlanInput): Promise<ActionResult> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  if (!z.uuid().safeParse(invoiceId).success) return { ok: false, error: "Invalid invoice." };
  const parsed = installmentPlanSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await saveInstallmentPlan(business.id, invoiceId, parsed.data);
  } catch (error) {
    return failure(error, "Could not save the installment plan.");
  }
  revalidateInstallments(invoiceId);
  redirect(`/dashboard/invoices/${invoiceId}`);
}

export async function deleteInstallmentPlanAction(invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  try {
    await deleteInstallmentPlan(business.id, invoiceId);
  } catch (error) {
    return failure(error, "Could not remove the installment plan.");
  }
  revalidateInstallments(invoiceId);
  return { ok: true, data: undefined };
}
