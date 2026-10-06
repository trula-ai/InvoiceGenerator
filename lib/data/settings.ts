import { eq } from "drizzle-orm";

import { businesses, type Business } from "@/db/schema";
import { db } from "@/lib/db";
import type { BusinessSettingsValues } from "@/lib/validation/settings";

export async function updateBusinessSettings(businessId: string, values: BusinessSettingsValues): Promise<Business> {
  const [row] = await db
    .update(businesses)
    .set({
      name: values.name,
      legalName: values.legalName ?? null,
      email: values.email ?? null,
      phone: values.phone ?? null,
      website: values.website ?? null,
      addressLine1: values.addressLine1 ?? null,
      addressLine2: values.addressLine2 ?? null,
      city: values.city ?? null,
      state: values.state ?? null,
      stateCode: values.stateCode ?? null,
      postalCode: values.postalCode ?? null,
      country: values.country,
      gstEnabled: values.gstEnabled,
      gstin: values.gstin ?? null,
      pan: values.pan ?? null,
      defaultCurrency: values.defaultCurrency,
      invoicePrefix: values.invoicePrefix,
      paymentTermsDays: values.paymentTermsDays,
      bankDetails: values.bankDetails ?? null,
      invoiceNotes: values.invoiceNotes ?? null,
      invoiceTerms: values.invoiceTerms ?? null,
      logoDataUrl: values.logoDataUrl ?? null,
      remindersEnabled: values.remindersEnabled,
      reminderDaysBefore: values.reminderDaysBefore,
      reminderOverdueEveryDays: values.reminderOverdueEveryDays,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning();
  return row;
}
