"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { createClient, setClientArchived, updateClient } from "@/lib/data/clients";
import { stateNameForCode } from "@/lib/india-states";
import { clientSchema, type ClientInput } from "@/lib/validation/client";
import type { ActionResult } from "@/lib/validation/common";

import { failure, validationFailure } from "./utils";

function withStateName<T extends { state?: string; stateCode?: string; country: string }>(values: T): T {
  if (values.country.trim().toLowerCase() === "india" && values.stateCode) {
    return { ...values, state: stateNameForCode(values.stateCode) ?? values.state };
  }
  return values;
}

export async function createClientAction(input: ClientInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let id: string;
  try {
    const client = await createClient(business.id, withStateName(parsed.data));
    id = client.id;
  } catch (error) {
    return failure(error, "Could not create the client.");
  }

  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${id}`);
}

export async function updateClientAction(id: string, input: ClientInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const updated = await updateClient(business.id, id, withStateName(parsed.data));
    if (!updated) return { ok: false, error: "Client not found." };
  } catch (error) {
    return failure(error, "Could not update the client.");
  }

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  redirect(`/dashboard/clients/${id}`);
}

export async function setClientArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await setClientArchived(business.id, id, archived);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { ok: true, data: undefined };
}
