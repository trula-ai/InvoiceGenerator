import { z } from "zod";

import { INSTALLMENT_FREQUENCIES, MAX_INSTALLMENTS, MIN_INSTALLMENTS } from "@/lib/installments";

import { isoDateString, positiveMoneyString } from "./common";

/** Settings used to generate the rows in the form; not stored. */
export const installmentGeneratorSchema = z.object({
  count: z.coerce.number().int().min(MIN_INSTALLMENTS, `At least ${MIN_INSTALLMENTS} installments`).max(MAX_INSTALLMENTS, `At most ${MAX_INSTALLMENTS} installments`),
  frequency: z.enum(INSTALLMENT_FREQUENCIES),
  firstDueDate: isoDateString,
});

export const installmentRowSchema = z.object({
  dueDate: isoDateString,
  amount: positiveMoneyString,
});

/** What is saved: the dated rows. The server checks they add up to the invoice total. */
export const installmentPlanSchema = z
  .object({
    installments: z.array(installmentRowSchema).min(MIN_INSTALLMENTS, `At least ${MIN_INSTALLMENTS} installments`).max(MAX_INSTALLMENTS, `At most ${MAX_INSTALLMENTS} installments`),
  })
  .superRefine((value, ctx) => {
    for (let i = 1; i < value.installments.length; i += 1) {
      if (value.installments[i].dueDate < value.installments[i - 1].dueDate) {
        ctx.addIssue({ code: "custom", message: "Due dates must be in order", path: ["installments", i, "dueDate"] });
      }
    }
  });

export type InstallmentPlanInput = z.input<typeof installmentPlanSchema>;
export type InstallmentPlanValues = z.output<typeof installmentPlanSchema>;
export type InstallmentGeneratorInput = z.input<typeof installmentGeneratorSchema>;
