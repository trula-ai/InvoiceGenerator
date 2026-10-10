import { z } from "zod";

import { currencyCode, optionalEmail, optionalGstin, optionalStateCode, optionalText } from "./common";

export const clientSchema = z.object({
  type: z.enum(["b2b", "b2c"]),
  name: z.string().trim().min(1, "Enter the client name").max(200),
  contactName: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  gstin: optionalGstin,
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  stateCode: optionalStateCode,
  postalCode: optionalText(20),
  country: z.string().trim().min(1).max(100).default("India"),
  /** Multi-line delivery address used to prefill "Ship to" on new invoices. */
  shippingAddress: optionalText(1000),
  currency: currencyCode,
  notes: optionalText(2000),
  /** Receive scheduled payment reminder emails. */
  autoReminders: z.boolean().default(true),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientValues = z.output<typeof clientSchema>;
