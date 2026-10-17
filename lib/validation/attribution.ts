import { z } from "zod";

const note = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined));

const requiredReason = z.string().trim().min(3, "Give a short reason").max(500);

/** Salesperson proposes who is credited with an invoice. */
export const proposeAttributionSchema = z.object({
  invoiceId: z.uuid(),
  creditedUserId: z.uuid("Choose who is credited with the sale"),
  reason: note,
});

export const approveAttributionSchema = z.object({
  attributionId: z.uuid(),
  note,
});

export const rejectAttributionSchema = z.object({
  attributionId: z.uuid(),
  reason: requiredReason,
});

export const reassignAttributionSchema = z.object({
  attributionId: z.uuid(),
  creditedUserId: z.uuid("Choose who should be credited instead"),
  reason: requiredReason,
});

export type ProposeAttributionInput = z.input<typeof proposeAttributionSchema>;
export type ApproveAttributionInput = z.input<typeof approveAttributionSchema>;
export type RejectAttributionInput = z.input<typeof rejectAttributionSchema>;
export type ReassignAttributionInput = z.input<typeof reassignAttributionSchema>;
