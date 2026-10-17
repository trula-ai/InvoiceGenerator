"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { RecurringStatus } from "@/db/schema";
import { authorize } from "@/lib/auth/current-user";
import { createRecurringProfile, deleteRecurringProfile, runProfileNow, setRecurringStatus, updateRecurringSchedule } from "@/lib/data/recurring";
import type { ActionResult } from "@/lib/validation/common";
import { recurringScheduleSchema, type RecurringScheduleInput } from "@/lib/validation/recurring";

import { failure, validationFailure } from "./utils";

function revalidateRecurring(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/notifications");
  if (id) revalidatePath(`/dashboard/scheduled/${id}`);
}

export async function createRecurringAction(invoiceId: string, input: RecurringScheduleInput): Promise<ActionResult> {
  const auth = await authorize("invoices.create");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  if (!z.uuid().safeParse(invoiceId).success) return { ok: false, error: "Invalid invoice." };
  const parsed = recurringScheduleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let id: string;
  try {
    id = await createRecurringProfile(business.id, invoiceId, parsed.data);
  } catch (error) {
    return failure(error, "Could not create the schedule.");
  }
  revalidateRecurring(id);
  redirect(`/dashboard/scheduled/${id}`);
}

export async function updateRecurringAction(id: string, input: RecurringScheduleInput): Promise<ActionResult> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  const parsed = recurringScheduleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await updateRecurringSchedule(business.id, id, parsed.data);
  } catch (error) {
    return failure(error, "Could not update the schedule.");
  }
  revalidateRecurring(id);
  redirect(`/dashboard/scheduled/${id}`);
}

export async function setRecurringStatusAction(id: string, status: RecurringStatus): Promise<ActionResult> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  if (!["active", "paused", "ended"].includes(status)) return { ok: false, error: "Invalid status." };
  try {
    await setRecurringStatus(business.id, id, status);
  } catch (error) {
    return failure(error);
  }
  revalidateRecurring(id);
  return { ok: true, data: undefined };
}

export async function runRecurringNowAction(id: string): Promise<ActionResult<{ invoiceId: string }>> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  try {
    const invoiceId = await runProfileNow(business, id);
    revalidateRecurring(id);
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    return { ok: true, data: { invoiceId } };
  } catch (error) {
    return failure(error, "Could not generate the invoice.");
  }
}

export async function deleteRecurringAction(id: string): Promise<ActionResult> {
  const auth = await authorize("invoices.edit");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  try {
    await deleteRecurringProfile(business.id, id);
  } catch (error) {
    return failure(error);
  }
  revalidateRecurring();
  redirect("/dashboard/scheduled");
}
