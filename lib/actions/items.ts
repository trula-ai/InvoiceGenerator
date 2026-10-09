"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { createItem, setItemArchived, updateItem } from "@/lib/data/items";
import type { ActionResult } from "@/lib/validation/common";
import { itemSchema, type ItemInput } from "@/lib/validation/item";

import { failure, validationFailure } from "./utils";

function revalidateItems() {
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard/invoices/new");
}

export async function createItemAction(input: ItemInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await createItem(business.id, parsed.data);
  } catch (error) {
    return failure(error, "Could not create the item.");
  }

  revalidateItems();
  redirect("/dashboard/items");
}

export async function updateItemAction(id: string, input: ItemInput): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const updated = await updateItem(business.id, id, parsed.data);
    if (!updated) return { ok: false, error: "Item not found." };
  } catch (error) {
    return failure(error, "Could not update the item.");
  }

  revalidateItems();
  redirect("/dashboard/items");
}

export async function setItemArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await setItemArchived(business.id, id, archived);
  } catch (error) {
    return failure(error);
  }
  revalidateItems();
  return { ok: true, data: undefined };
}
