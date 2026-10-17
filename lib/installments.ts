import type { RecurringFrequency } from "@/db/schema";
import { D, toMoney } from "@/lib/money";
import { anchorDayOf, nextRunDate } from "@/lib/recurring";

/**
 * Installment-plan helpers shared by server and client code. Pure functions
 * only: no database access, so forms can preview a plan before saving it.
 */

/** Frequencies offered for installment plans (a subset of the scheduling frequencies). */
export const INSTALLMENT_FREQUENCIES = ["weekly", "fortnightly", "monthly", "quarterly"] as const satisfies readonly RecurringFrequency[];
export type InstallmentFrequency = (typeof INSTALLMENT_FREQUENCIES)[number];

export const INSTALLMENT_FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 60;

export interface InstallmentDraft {
  dueDate: string;
  amount: string;
}

/**
 * Splits `total` into `count` equal parts starting on `firstDueDate`. Rounding
 * to 2 decimals leaves a few paise over; those go on the last installment so
 * the parts always add up to the total exactly.
 */
export function buildInstallmentSchedule(input: { total: string; count: number; firstDueDate: string; frequency: InstallmentFrequency }): InstallmentDraft[] {
  const count = Math.max(1, Math.floor(input.count));
  const total = D(input.total);
  const each = total.dividedBy(count).toDecimalPlaces(2, 1 /* ROUND_DOWN */);
  const last = total.minus(each.times(count - 1));
  const anchor = anchorDayOf(input.firstDueDate);
  const rows: InstallmentDraft[] = [];
  let date = input.firstDueDate;
  for (let i = 0; i < count; i += 1) {
    rows.push({ dueDate: date, amount: toMoney(i === count - 1 ? last : each) });
    date = nextRunDate(date, input.frequency, anchor);
  }
  return rows;
}

/**
 * Scales every amount so the plan adds up to `newTotal`, keeping the dates.
 * Used when an invoice with a plan is edited and its total changes.
 */
export function rescaleInstallments<T extends { amount: string }>(rows: T[], newTotal: string): T[] {
  if (rows.length === 0) return rows;
  const oldTotal = rows.reduce((acc, r) => acc.plus(D(r.amount)), D(0));
  const target = D(newTotal);
  if (oldTotal.isZero()) {
    return buildEqual(rows, target);
  }
  const scaled = rows.map((r) => D(r.amount).times(target).dividedBy(oldTotal).toDecimalPlaces(2, 1));
  const used = scaled.slice(0, -1).reduce((acc, v) => acc.plus(v), D(0));
  scaled[scaled.length - 1] = target.minus(used);
  return rows.map((r, i) => ({ ...r, amount: toMoney(scaled[i]) }));
}

function buildEqual<T extends { amount: string }>(rows: T[], target: ReturnType<typeof D>): T[] {
  const each = target.dividedBy(rows.length).toDecimalPlaces(2, 1);
  const last = target.minus(each.times(rows.length - 1));
  return rows.map((r, i) => ({ ...r, amount: toMoney(i === rows.length - 1 ? last : each) }));
}

/** Sum of a list of amounts as a money string. */
export function sumInstallments(rows: { amount: string }[]): string {
  return toMoney(rows.reduce((acc, r) => acc.plus(D(r.amount || 0)), D(0)));
}

export interface AllocatedInstallment<T> {
  row: T;
  paidAmount: string;
  /** True once the installment is fully covered. */
  settled: boolean;
}

/**
 * Spreads `paidTotal` over the installments in order: the first installment
 * is filled before any money reaches the second, and so on. Returns the paid
 * amount for every row.
 */
export function allocatePaid<T extends { amount: string }>(rows: T[], paidTotal: string): AllocatedInstallment<T>[] {
  let pool = D(paidTotal || 0);
  return rows.map((row) => {
    const amount = D(row.amount);
    const take = pool.greaterThan(amount) ? amount : pool;
    pool = pool.minus(take);
    const paid = take.lessThan(0) ? D(0) : take;
    return { row, paidAmount: toMoney(paid), settled: paid.greaterThanOrEqualTo(amount) };
  });
}

export type InstallmentState = "paid" | "partial" | "overdue" | "due_today" | "upcoming";

export const INSTALLMENT_STATE_LABELS: Record<InstallmentState, string> = {
  paid: "Paid",
  partial: "Partly paid",
  overdue: "Overdue",
  due_today: "Due today",
  upcoming: "Upcoming",
};

/** Display state for one installment on a given day. */
export function installmentState(row: { amount: string; paidAmount: string; dueDate: string }, today: string): InstallmentState {
  const paid = D(row.paidAmount);
  if (paid.greaterThanOrEqualTo(D(row.amount))) return "paid";
  if (row.dueDate < today) return "overdue";
  if (paid.greaterThan(0)) return "partial";
  if (row.dueDate === today) return "due_today";
  return "upcoming";
}

/** Amount still owed on one installment. */
export function installmentOutstanding(row: { amount: string; paidAmount: string }): string {
  const left = D(row.amount).minus(D(row.paidAmount));
  return toMoney(left.lessThan(0) ? 0 : left);
}

/** The first installment that is not fully paid, or null when the plan is settled. */
export function nextUnpaidInstallment<T extends { amount: string; paidAmount: string; sequence: number }>(rows: T[]): T | null {
  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
  return sorted.find((r) => D(r.paidAmount).lessThan(D(r.amount))) ?? null;
}

/** "Installment 3 of 12". */
export function installmentLabel(sequence: number, count: number): string {
  return `Installment ${sequence} of ${count}`;
}

/**
 * What the client is asked to pay right now: the next unpaid installment when
 * there is a plan (never more than the balance), otherwise the whole balance.
 */
export function amountDueNow(balanceDue: string, installments: { amount: string; paidAmount: string; sequence: number }[]): string {
  const next = nextUnpaidInstallment(installments);
  if (!next) return balanceDue;
  const outstanding = installmentOutstanding(next);
  return D(outstanding).greaterThan(D(balanceDue)) ? balanceDue : outstanding;
}
