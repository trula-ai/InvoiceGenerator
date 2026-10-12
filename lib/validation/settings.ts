import { z } from "zod";

import { formatReminderSchedule, isValidReminderSchedule, parseReminderSchedule } from "@/lib/reminder-schedule";

import { currencyCode, optionalEmail, optionalGstin, optionalStateCode, optionalText } from "./common";

const numberPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,10}$/, "Letters and digits only, up to 10 characters");

/** Optional PNG/JPEG data URL of at most ~300 KB. Empty string clears it. */
const imageDataUrl = (label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v), "Upload a PNG or JPEG image")
    .refine((v) => v === undefined || v.length <= 400_000, `${label} must be smaller than 300 KB`);

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
    invoicePrefix: numberPrefix,
    quotePrefix: numberPrefix,
    creditNotePrefix: numberPrefix,
    paymentTermsDays: z.coerce.number().int().min(0).max(365),
    quoteValidityDays: z.coerce.number().int().min(1, "At least 1 day").max(365),
    bankDetails: optionalText(2000),
    invoiceNotes: optionalText(2000),
    invoiceTerms: optionalText(4000),
    /** Data URL (image/png or image/jpeg), at most ~300 KB of base64. Empty string clears it. */
    logoDataUrl: imageDataUrl("Logo"),
    /** Round invoice totals to the nearest whole unit and print a round-off line. */
    roundTotals: z.boolean().default(false),
    /** Signature image for the authorised-signatory block; same constraints as the logo. */
    signatureDataUrl: imageDataUrl("Signature"),
    signatoryName: optionalText(120),
    /** Show Razorpay "Pay now" on public invoice pages (when the gateway is configured). */
    onlinePaymentsEnabled: z.boolean().default(true),
    /** Email invoices to the client automatically when they are issued. */
    autoEmailInvoices: z.boolean().default(true),
    /** Automatic payment reminder schedule. */
    remindersEnabled: z.boolean().default(true),
    /** Days before the due date, comma-separated, e.g. "7,3,1". Normalised to largest-first. */
    reminderSchedule: z
      .string()
      .trim()
      .max(80)
      .refine(isValidReminderSchedule, "Enter days separated by commas, each between 1 and 60, e.g. 7,3,1")
      .transform((v) => formatReminderSchedule(parseReminderSchedule(v))),
    reminderOverdueEveryDays: z.coerce.number().int().min(0, "Use 0 to disable").max(90, "At most 90 days"),
    /** Email the business's own users a summary when reminders are sent. */
    notifyOwner: z.boolean().default(true),
  })
  .refine((v) => !v.gstEnabled || !!v.gstin, { message: "GSTIN is required when GST is enabled", path: ["gstin"] })
  .refine((v) => !v.gstEnabled || !!v.stateCode, {
    message: "Business state is required when GST is enabled",
    path: ["stateCode"],
  })
  .refine((v) => new Set([v.invoicePrefix, v.quotePrefix, v.creditNotePrefix]).size === 3, {
    message: "Invoice, quote and credit note prefixes must differ",
    path: ["quotePrefix"],
  });

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>;
export type BusinessSettingsValues = z.output<typeof businessSettingsSchema>;
