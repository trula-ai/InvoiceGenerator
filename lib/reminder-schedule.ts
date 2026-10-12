/**
 * Pre-due reminder schedule, stored on the business as a comma-separated list
 * of "days before the due date", e.g. "7,3,1". Shared by validation, the
 * settings form and the scheduler so all three agree on the format.
 */

export const DEFAULT_REMINDER_SCHEDULE = "7,3,1";
export const MAX_REMINDER_DAYS_BEFORE = 60;

/** Parses "7, 3,1" into [7, 3, 1]: unique, within range, sorted largest first. Invalid input yields []. */
export function parseReminderSchedule(value: string | null | undefined): number[] {
  if (!value) return [];
  const days = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => Number(part));
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > MAX_REMINDER_DAYS_BEFORE)) return [];
  return [...new Set(days)].sort((a, b) => b - a);
}

export function formatReminderSchedule(days: number[]): string {
  return [...new Set(days)].sort((a, b) => b - a).join(",");
}

/** True for an empty list (no pre-due reminders) or a well-formed list of days. */
export function isValidReminderSchedule(value: string): boolean {
  if (value.trim() === "") return true;
  return parseReminderSchedule(value).length > 0;
}

// --- Stage selection (pure; used by lib/email/due-reminders.ts) ---------------

export type ReminderStage = "due_soon" | "due_today" | "overdue";

export interface ReminderScheduleSettings {
  remindersEnabled: boolean;
  /** Days before the due date, largest first, e.g. [7, 3, 1]. */
  reminderOffsets: number[];
  reminderOverdueEveryDays: number;
  notifyOwner: boolean;
}

export interface ReminderPlan {
  stage: ReminderStage;
  /** Unique per invoice and occurrence; see db/schema/invoice-reminders.ts. */
  key: string;
  /** Human label for the notify mail, e.g. "3 days before due". */
  label: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

/**
 * Which reminder, if any, an unpaid invoice is owed on `today`. Before the due
 * date the most recently opened step wins, so a missed day never produces a
 * burst of emails later; on the due date it is "due today"; afterwards an
 * overdue (pending payment) nudge every `reminderOverdueEveryDays` days.
 */
export function reminderStageFor(dueDate: string, today: string, settings: ReminderScheduleSettings): ReminderPlan | null {
  const daysUntilDue = daysBetween(today, dueDate);
  if (daysUntilDue === 0) return { stage: "due_today", key: `due_today:${dueDate}`, label: "Due today" };

  if (daysUntilDue > 0) {
    const opened = settings.reminderOffsets.filter((d) => daysUntilDue <= d);
    if (!opened.length) return null;
    const step = Math.min(...opened);
    return { stage: "due_soon", key: `before:${step}:${dueDate}`, label: `${step} day${step === 1 ? "" : "s"} before due` };
  }

  const overdueDays = -daysUntilDue;
  const every = settings.reminderOverdueEveryDays;
  if (every > 0 && overdueDays >= every) {
    return {
      stage: "overdue",
      key: `overdue:${dueDate}:${Math.floor(overdueDays / every)}`,
      label: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
    };
  }
  return null;
}

/** Human summary used in the settings section header, e.g. "7, 3 and 1 days before". */
export function describeReminderSchedule(value: string): string | null {
  const days = parseReminderSchedule(value);
  if (!days.length) return null;
  if (days.length === 1) return `${days[0]} day${days[0] === 1 ? "" : "s"} before`;
  return `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]} days before`;
}
