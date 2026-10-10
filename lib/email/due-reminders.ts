import { and, eq, inArray, sql } from "drizzle-orm";
import { format } from "date-fns";

import { businesses, clients, invoiceReminders, invoices, type ReminderStage } from "@/db/schema";
import { PAYABLE_STATUSES, syncOverdueStatuses } from "@/lib/data/invoices";
import { daysBetweenIso, syncPaymentNotifications } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";

import { sendReminderEmail } from "./send-reminder";

/**
 * Due-date automation.
 *
 * `runDailyChecks` promotes overdue invoices, raises due-soon / due-today /
 * overdue notifications and runs the reminder schedule below. It is
 * idempotent: every automatic reminder is recorded in `invoice_reminders`
 * with a stage key, so re-running never sends the same reminder twice.
 *
 * Schedule (per business, editable in Settings > Payment reminders):
 * - "due soon": once, when the due date is within `reminderDaysBefore` days.
 * - "due today": once, on the due date.
 * - "overdue": every `reminderOverdueEveryDays` days after the due date.
 * Clients can opt out with `clients.autoReminders = false`; manual sends from
 * the invoice or client pages are never blocked by that flag.
 *
 * Triggered two ways:
 * - `GET /api/cron/due-reminders` (Vercel Cron or any scheduler) runs it for
 *   every business.
 * - The dashboard layout calls `maybeRunDailyChecks` after each response for
 *   the signed-in business, throttled to once an hour per server process, so
 *   local and self-hosted setups work without a scheduler.
 */

export interface DueReminderSummary {
  businessId: string;
  date: string;
  sent: number;
  failed: number;
  skipped: number;
  notified: number;
}

export interface ReminderScheduleSettings {
  remindersEnabled: boolean;
  reminderDaysBefore: number;
  reminderOverdueEveryDays: number;
}

export interface ReminderPlan {
  stage: ReminderStage;
  /** Unique per invoice and occurrence; see db/schema/invoice-reminders.ts. */
  key: string;
}

/** Which reminder, if any, an unpaid invoice is owed today. Pure, so it is easy to test. */
export function reminderStageFor(dueDate: string, today: string, settings: ReminderScheduleSettings): ReminderPlan | null {
  const daysUntilDue = daysBetweenIso(today, dueDate);
  if (daysUntilDue === 0) return { stage: "due_today", key: `due_today:${dueDate}` };
  if (daysUntilDue > 0) {
    if (settings.reminderDaysBefore > 0 && daysUntilDue <= settings.reminderDaysBefore) {
      return { stage: "due_soon", key: `due_soon:${dueDate}` };
    }
    return null;
  }
  const overdueDays = -daysUntilDue;
  const every = settings.reminderOverdueEveryDays;
  if (every > 0 && overdueDays >= every) {
    return { stage: "overdue", key: `overdue:${dueDate}:${Math.floor(overdueDays / every)}` };
  }
  return null;
}

/** Sends every reminder the schedule says is owed today for one business. */
export async function runReminderSchedule(businessId: string, today = todayIso()): Promise<Omit<DueReminderSummary, "notified">> {
  const summary = { businessId, date: today, sent: 0, failed: 0, skipped: 0 };

  const [settings] = await db
    .select({
      remindersEnabled: businesses.remindersEnabled,
      reminderDaysBefore: businesses.reminderDaysBefore,
      reminderOverdueEveryDays: businesses.reminderOverdueEveryDays,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!settings?.remindersEnabled) return summary;

  const rows = await db
    .select({
      id: invoices.id,
      dueDate: invoices.dueDate,
      lastReminderAt: invoices.lastReminderAt,
      email: clients.email,
      autoReminders: clients.autoReminders,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(eq(invoices.businessId, businessId), eq(invoices.documentKind, "invoice"), inArray(invoices.status, PAYABLE_STATUSES), sql`${invoices.balanceDue} > 0`),
    );

  for (const inv of rows) {
    const plan = reminderStageFor(inv.dueDate, today, settings);
    if (!plan) continue;

    const email = inv.email?.trim();
    if (!inv.autoReminders || !email) {
      summary.skipped += 1;
      continue;
    }

    const [done] = await db
      .select({ id: invoiceReminders.id })
      .from(invoiceReminders)
      .where(and(eq(invoiceReminders.invoiceId, inv.id), eq(invoiceReminders.stageKey, plan.key)))
      .limit(1);
    if (done) {
      summary.skipped += 1;
      continue;
    }

    // A reminder already went out by hand today: count this stage as covered.
    if (inv.lastReminderAt && format(inv.lastReminderAt, "yyyy-MM-dd") === today) {
      await db
        .insert(invoiceReminders)
        .values({ businessId, invoiceId: inv.id, stage: plan.stage, stageKey: plan.key, toEmail: email })
        .onConflictDoNothing();
      summary.skipped += 1;
      continue;
    }

    try {
      const result = await sendReminderEmail(businessId, inv.id);
      await db
        .insert(invoiceReminders)
        .values({ businessId, invoiceId: inv.id, stage: plan.stage, stageKey: plan.key, toEmail: result.to })
        .onConflictDoNothing();
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[due-reminders] invoice ${inv.id}:`, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}

export async function runDailyChecks(businessId: string): Promise<DueReminderSummary> {
  await syncOverdueStatuses(businessId);
  const notified = await syncPaymentNotifications(businessId);
  const reminders = await runReminderSchedule(businessId);
  return { ...reminders, notified };
}

export async function runDailyChecksForAllBusinesses(): Promise<DueReminderSummary[]> {
  const rows = await db.select({ id: businesses.id }).from(businesses);
  const results: DueReminderSummary[] = [];
  for (const row of rows) results.push(await runDailyChecks(row.id));
  return results;
}

const THROTTLE_MS = 60 * 60 * 1000;
const globalForChecks = globalThis as typeof globalThis & { __invoiceGeneratorDailyChecks?: Map<string, number> };
const lastRun = (globalForChecks.__invoiceGeneratorDailyChecks ??= new Map<string, number>());

/** Runs the daily checks for one business at most once an hour per process. Never throws. */
export async function maybeRunDailyChecks(businessId: string): Promise<DueReminderSummary | null> {
  const now = Date.now();
  if (now - (lastRun.get(businessId) ?? 0) < THROTTLE_MS) return null;
  lastRun.set(businessId, now);
  try {
    return await runDailyChecks(businessId);
  } catch (error) {
    lastRun.delete(businessId);
    console.error("[due-reminders] daily checks failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
