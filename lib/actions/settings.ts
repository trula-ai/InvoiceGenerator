"use server";

import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/auth/current-user";
import { updateBusinessSettings } from "@/lib/data/settings";
import { stateNameForCode } from "@/lib/india-states";
import type { ActionResult } from "@/lib/validation/common";
import { businessSettingsSchema, type BusinessSettingsInput } from "@/lib/validation/settings";

import { failure, validationFailure } from "./utils";

export async function updateSettingsAction(input: BusinessSettingsInput): Promise<ActionResult> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth;
  const { business } = auth.current;
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const values = parsed.data;
  if (values.country.trim().toLowerCase() === "india" && values.stateCode) {
    values.state = stateNameForCode(values.stateCode) ?? values.state;
  }

  try {
    await updateBusinessSettings(business.id, values);
  } catch (error) {
    return failure(error, "Could not save settings.");
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, data: undefined };
}
