import { z } from "zod";

import { RECURRING_FREQUENCIES } from "@/lib/recurring";

import { isoDateString, optionalText } from "./common";

export const recurringScheduleSchema = z
  .object({
    name: z.string().trim().min(1, "Give the schedule a name").max(120),
    frequency: z.enum(RECURRING_FREQUENCIES as [string, ...string[]]),
    startDate: isoDateString,
    endDate: isoDateString.or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    maxOccurrences: z
      .string()
      .trim()
      .regex(/^\d{0,4}$/, "Enter a whole number")
      .transform((v) => (v === "" || Number(v) === 0 ? undefined : Number(v))),
    autoSend: z.boolean().default(true),
    internalNote: optionalText(500),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "End date cannot be before the start date", path: ["endDate"] });

export type RecurringScheduleInput = z.input<typeof recurringScheduleSchema>;
export type RecurringScheduleValues = z.output<typeof recurringScheduleSchema>;
