import { z } from "zod";

import { isoDateString, optionalText, positiveMoneyString } from "./common";

export const PAYMENT_METHODS = ["bank_transfer", "upi", "card", "cash", "cheque", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  card: "Card",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

export const paymentSchema = z.object({
  invoiceId: z.uuid(),
  amount: positiveMoneyString,
  paymentDate: isoDateString,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  notes: optionalText(2000),
});

export type PaymentFormInput = z.input<typeof paymentSchema>;
export type PaymentFormValues = z.output<typeof paymentSchema>;
