import type { RecurringFrequency, RecurringStatus } from "@/db/schema";

/**
 * Recurring-schedule helpers shared by server and client code. Dates are ISO
 * strings (YYYY-MM-DD) and all arithmetic is done in UTC to avoid drift.
 */

export const RECURRING_FREQUENCIES: RecurringFrequency[] = ["weekly", "fortnightly", "monthly", "quarterly", "half_yearly", "yearly"];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Every 6 months",
  yearly: "Yearly",
};

export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function toIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Adds whole months keeping the anchor day of month where the target month
 * has it, otherwise clamping to the month's last day (31 Jan + 1 month = 28 Feb).
 */
export function addMonthsIso(iso: string, months: number, anchorDay?: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return toIso(ny, nm, day);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return toIso(y, m, d + days);
}

/** The run date after `iso` for a frequency. `anchorDay` is the start date's day of month. */
export function nextRunDate(iso: string, frequency: RecurringFrequency, anchorDay?: number): string {
  switch (frequency) {
    case "weekly":
      return addDays(iso, 7);
    case "fortnightly":
      return addDays(iso, 14);
    case "monthly":
      return addMonthsIso(iso, 1, anchorDay);
    case "quarterly":
      return addMonthsIso(iso, 3, anchorDay);
    case "half_yearly":
      return addMonthsIso(iso, 6, anchorDay);
    case "yearly":
      return addMonthsIso(iso, 12, anchorDay);
  }
}

export function anchorDayOf(startDate: string): number {
  return parts(startDate)[2];
}

/** "Monthly from 1 Nov 2026 until 31 Mar 2027", etc. */
export function describeSchedule(input: { frequency: RecurringFrequency; endDate?: string | null; maxOccurrences?: number | null }, formatDate: (iso: string) => string, startLabel: string): string {
  const bits = [`${FREQUENCY_LABELS[input.frequency]} from ${startLabel}`];
  if (input.endDate) bits.push(`until ${formatDate(input.endDate)}`);
  if (input.maxOccurrences) bits.push(`for ${input.maxOccurrences} invoice${input.maxOccurrences === 1 ? "" : "s"}`);
  return bits.join(" ");
}
