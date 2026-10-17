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

export const PAYMENT_STATUSES = ["pending", "verified", "rejected", "reversed"] as const;

export const paymentSchema = z.object({
  invoiceId: z.uuid(),
  amount: positiveMoneyString,
  /** Date the money was actually received. */
  paymentDate: isoDateString,
  method: z.enum(PAYMENT_METHODS),
  /** Transaction id, UTR, cheque number. Checked against other payments for duplicates. */
  reference: optionalText(120),
  /** Bank account, UPI id or gateway account the money landed in. */
  receivingAccount: optionalText(120),
  notes: optionalText(2000),
  /** Set after the user confirms a duplicate-reference warning. */
  allowDuplicate: z.boolean().optional().default(false),
});

/** Finance gives a reason when a payment is rejected or a verified one reversed. */
export const paymentReasonSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3, "Give a short reason").max(500),
});

export type PaymentFormInput = z.input<typeof paymentSchema>;
export type PaymentFormValues = z.output<typeof paymentSchema>;
export type PaymentReasonInput = z.input<typeof paymentReasonSchema>;
