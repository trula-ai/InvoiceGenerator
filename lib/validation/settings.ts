import { z } from "zod";

import { currencyCode, optionalEmail, optionalGstin, optionalStateCode, optionalText } from "./common";

export const businessSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the business name").max(200),
    legalName: optionalText(200),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalText(200),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    stateCode: optionalStateCode,
    postalCode: optionalText(20),
    country: z.string().trim().min(1).max(100).default("India"),
    gstEnabled: z.boolean(),
    gstin: optionalGstin,
    pan: optionalText(10),
    defaultCurrency: currencyCode,
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,10}$/, "Letters and digits only, up to 10 characters"),
    paymentTermsDays: z.coerce.number().int().min(0).max(365),
    bankDetails: optionalText(2000),
    invoiceNotes: optionalText(2000),
    invoiceTerms: optionalText(4000),
    /** Data URL (image/png or image/jpeg), at most ~300 KB of base64. Empty string clears it. */
    logoDataUrl: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v), "Upload a PNG or JPEG image")
      .refine((v) => v === undefined || v.length <= 400_000, "Logo must be smaller than 300 KB"),
    /** Automatic payment reminder schedule. */
    remindersEnabled: z.boolean().default(true),
    reminderDaysBefore: z.coerce.number().int().min(0, "Use 0 to disable").max(60, "At most 60 days"),
    reminderOverdueEveryDays: z.coerce.number().int().min(0, "Use 0 to disable").max(90, "At most 90 days"),
  })
  .refine((v) => !v.gstEnabled || !!v.gstin, { message: "GSTIN is required when GST is enabled", path: ["gstin"] })
  .refine((v) => !v.gstEnabled || !!v.stateCode, {
    message: "Business state is required when GST is enabled",
    path: ["stateCode"],
  });

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>;
export type BusinessSettingsValues = z.output<typeof businessSettingsSchema>;
