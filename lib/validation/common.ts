import { z } from "zod";

import { CURRENCY_CODES } from "@/lib/currency";

/** Money entered in a form: digits with up to 2 decimals. Kept as a string. */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimals)");

export const positiveMoneyString = moneyString.refine((v) => Number(v) > 0, "Amount must be greater than zero");

/** Quantity: up to 3 decimals, must be > 0. */
export const quantityString = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, "Enter a valid quantity")
  .refine((v) => Number(v) > 0, "Quantity must be greater than zero");

/** Percentage 0-100 with up to 2 decimals. */
export const percentString = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid percentage")
  .refine((v) => Number(v) <= 100, "Must be 100 or less");

/** Exchange rate: positive, up to 8 decimals. */
export const rateString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,8})?$/, "Enter a valid rate")
  .refine((v) => Number(v) > 0, "Rate must be greater than zero");

export const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const currencyCode = z.enum(CURRENCY_CODES);

/** Optional text field: empty strings become undefined. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const optionalGstin = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || GSTIN_REGEX.test(v), "Enter a valid 15-character GSTIN");

export const optionalStateCode = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{2}$/.test(v), "Select a state");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.email().safeParse(v).success, "Enter a valid email address");

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
