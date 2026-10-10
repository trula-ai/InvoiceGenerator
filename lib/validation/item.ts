import { z } from "zod";

import { moneyString, optionalText, percentString } from "./common";

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Enter the item name").max(200),
  description: optionalText(1000),
  hsnSac: optionalText(10),
  unit: optionalText(20),
  unitPrice: moneyString.or(z.literal("")).transform((v) => (v === "" ? "0" : v)),
  taxRate: percentString.or(z.literal("")).transform((v) => (v === "" ? "0" : v)),
});

export type ItemInput = z.input<typeof itemSchema>;
export type ItemValues = z.output<typeof itemSchema>;
