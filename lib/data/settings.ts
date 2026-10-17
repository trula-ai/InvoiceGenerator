import { eq } from "drizzle-orm";

import { businesses, type Business } from "@/db/schema";
import { db } from "@/lib/db";
import type { BusinessSettingsValues } from "@/lib/validation/settings";

export async function updateBusinessSettings(businessId: string, values: BusinessSettingsValues): Promise<Business> {
  // Receipts freeze the terms they were issued with; bump the version whenever the wording changes.
  const [before] = await db
    .select({ receiptTerms: businesses.receiptTerms, receiptPrivacyUrl: businesses.receiptPrivacyUrl, receiptTermsVersion: businesses.receiptTermsVersion })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const termsChanged = !!before && ((before.receiptTerms ?? null) !== (values.receiptTerms ?? null) || (before.receiptPrivacyUrl ?? null) !== (values.receiptPrivacyUrl ?? null));
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
      quotePrefix: values.quotePrefix,
      creditNotePrefix: values.creditNotePrefix,
      paymentTermsDays: values.paymentTermsDays,
      quoteValidityDays: values.quoteValidityDays,
      bankDetails: values.bankDetails ?? null,
      invoiceNotes: values.invoiceNotes ?? null,
      invoiceTerms: values.invoiceTerms ?? null,
      logoDataUrl: values.logoDataUrl ?? null,
      roundTotals: values.roundTotals,
      signatureDataUrl: values.signatureDataUrl ?? null,
      signatoryName: values.signatoryName ?? null,
      onlinePaymentsEnabled: values.onlinePaymentsEnabled,
      autoEmailInvoices: values.autoEmailInvoices,
      remindersEnabled: values.remindersEnabled,
      reminderSchedule: values.reminderSchedule,
      reminderOverdueEveryDays: values.reminderOverdueEveryDays,
      notifyOwner: values.notifyOwner,
      receiptTerms: values.receiptTerms ?? null,
      receiptPrivacyUrl: values.receiptPrivacyUrl ?? null,
      receiptTermsVersion: termsChanged ? (before?.receiptTermsVersion ?? 0) + 1 : (before?.receiptTermsVersion ?? 0),
      receiptRequiresAttribution: values.receiptRequiresAttribution,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning();
  return row;
}
