"use server";

import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/auth/current-user";
import { approveAttribution, proposeAttribution, reassignAttribution, rejectAttribution } from "@/lib/data/attribution";
import type { ActionResult } from "@/lib/validation/common";
import {
  approveAttributionSchema,
  proposeAttributionSchema,
  reassignAttributionSchema,
  rejectAttributionSchema,
  type ApproveAttributionInput,
  type ProposeAttributionInput,
  type ReassignAttributionInput,
  type RejectAttributionInput,
} from "@/lib/validation/attribution";

import { failure, validationFailure } from "./utils";

/**
 * Sales attribution actions. Each one checks the caller's permission and
 * business, then delegates to the data layer, which enforces the state
 * rules (no self-approval by a sales manager, no changing an approved owner
 * without a reassignment, and so on). Nothing here touches payments.
 */

function revalidateAttribution(invoiceId: string) {
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/attribution");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard", "layout");
}

export async function proposeAttributionAction(input: ProposeAttributionInput): Promise<ActionResult<{ attributionId: string }>> {
  const auth = await authorize("attribution.assign");
  if (!auth.ok) return auth;
  const parsed = proposeAttributionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const attributionId = await proposeAttribution(auth.current.business.id, auth.current.user.id, parsed.data);
    revalidateAttribution(parsed.data.invoiceId);
    return { ok: true, data: { attributionId } };
  } catch (error) {
    return failure(error, "Could not record the sales credit.");
  }
}

export async function approveAttributionAction(input: ApproveAttributionInput, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("attribution.approve");
  if (!auth.ok) return auth;
  const parsed = approveAttributionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await approveAttribution(auth.current.business.id, auth.current.user.id, parsed.data.attributionId, parsed.data.note ?? null, {
      actorIsAdmin: auth.current.user.roles.includes("admin"),
    });
    revalidateAttribution(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not approve the attribution.");
  }
}

export async function rejectAttributionAction(input: RejectAttributionInput, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("attribution.approve");
  if (!auth.ok) return auth;
  const parsed = rejectAttributionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await rejectAttribution(auth.current.business.id, auth.current.user.id, parsed.data.attributionId, parsed.data.reason);
    revalidateAttribution(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not reject the attribution.");
  }
}

export async function reassignAttributionAction(input: ReassignAttributionInput, invoiceId: string): Promise<ActionResult> {
  const auth = await authorize("attribution.approve");
  if (!auth.ok) return auth;
  const parsed = reassignAttributionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await reassignAttribution(auth.current.business.id, auth.current.user.id, parsed.data.attributionId, parsed.data.creditedUserId, parsed.data.reason, {
      actorIsAdmin: auth.current.user.roles.includes("admin"),
    });
    revalidateAttribution(invoiceId);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not reassign the sale.");
  }
}
