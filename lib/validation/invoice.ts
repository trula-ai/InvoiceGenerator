import { z } from "zod";

import {
  currencyCode,
  isoDateString,
  moneyString,
  optionalStateCode,
  optionalText,
  percentString,
  quantityString,
  rateString,
} from "./common";

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the item").max(1000),
  hsnSac: optionalText(10),
  quantity: quantityString,
  unit: optionalText(20),
  unitPrice: moneyString,
  taxRate: percentString,
});

export const invoiceSchema = z
  .object({
    clientId: z.uuid("Select a client"),
    invoiceType: z.enum(["b2b", "b2c"]),
    issueDate: isoDateString,
    dueDate: isoDateString,
    currency: currencyCode,
    exchangeRate: rateString,
    exchangeRateSource: z.enum(["api", "manual", "base"]),
    placeOfSupplyCode: optionalStateCode,
    discountType: z.enum(["none", "percent", "fixed"]),
    discountValue: moneyString.or(z.literal("")).transform((v) => (v === "" ? "0" : v)),
    notes: optionalText(4000),
    terms: optionalText(4000),
    items: z.array(invoiceItemSchema).min(1, "Add at least one item"),
    /** Whether to save as draft or issue the invoice immediately. */
    status: z.enum(["draft", "pending"]),
  })
  .refine((v) => v.dueDate >= v.issueDate, { message: "Due date cannot be before the issue date", path: ["dueDate"] })
  .refine((v) => v.discountType !== "percent" || Number(v.discountValue) <= 100, {
    message: "Percentage discount cannot exceed 100",
    path: ["discountValue"],
  });

export type InvoiceFormInput = z.input<typeof invoiceSchema>;
export type InvoiceFormValues = z.output<typeof invoiceSchema>;
export type InvoiceItemFormInput = z.input<typeof invoiceItemSchema>;
