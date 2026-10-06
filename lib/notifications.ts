import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";

import type { Notification, NotificationKind, NotificationSeverity } from "@/db/schema";

/**
 * View helpers for the notification feed, shared by the server-rendered page
 * and the client-side header panel. No database access here.
 */

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string;
  invoiceNumber: string | null;
  clientName: string | null;
  amount: string | null;
  currency: string | null;
  dueDate: string | null;
  href: string | null;
  read: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

export function toNotificationItem(n: Notification): NotificationItem {
  return {
    id: n.id,
    kind: n.kind,
    severity: n.severity,
    title: n.title,
    body: n.body,
    invoiceNumber: n.invoiceNumber,
    clientName: n.clientName,
    amount: n.amount,
    currency: n.currency,
    dueDate: n.dueDate,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Short label shown above the title, e.g. "Payment received". */
export const KIND_LABELS: Record<NotificationKind, string> = {
  invoice_issued: "Invoice issued",
  invoice_sent: "Invoice emailed",
  payment_received: "Payment received",
  invoice_paid: "Paid in full",
  invoice_due_soon: "Due soon",
  invoice_due_today: "Due today",
  invoice_overdue: "Overdue",
  invoice_cancelled: "Invoice cancelled",
  reminder_sent: "Reminder sent",
  reminder_failed: "Reminder failed",
  statement_sent: "Statement sent",
};

/**
 * Light tinted card styles per severity (background, left accent and label
 * colour), tuned for both light and dark themes.
 */
export const SEVERITY_STYLES: Record<NotificationSeverity, { card: string; label: string; icon: string }> = {
  info: {
    card: "border-l-sky-400 bg-sky-50/80 hover:bg-sky-50 dark:border-l-sky-500 dark:bg-sky-950/30 dark:hover:bg-sky-950/40",
    label: "text-sky-700 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
  },
  success: {
    card: "border-l-emerald-400 bg-emerald-50/80 hover:bg-emerald-50 dark:border-l-emerald-500 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/40",
    label: "text-emerald-700 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    card: "border-l-amber-400 bg-amber-50/80 hover:bg-amber-50 dark:border-l-amber-500 dark:bg-amber-950/30 dark:hover:bg-amber-950/40",
    label: "text-amber-700 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  urgent: {
    card: "border-l-rose-400 bg-rose-50/80 hover:bg-rose-50 dark:border-l-rose-500 dark:bg-rose-950/30 dark:hover:bg-rose-950/40",
    label: "text-rose-700 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
  },
};

/**
 * Group heading for a timestamp: "Today", "Yesterday", the weekday name for
 * anything else within the last week, otherwise "26 Sept" (with the year when
 * it differs from the current one).
 */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const age = differenceInCalendarDays(now, date);
  if (age > 0 && age < 7) return format(date, "EEEE");
  return format(date, date.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy");
}

export interface NotificationGroup {
  label: string;
  /** ISO date (yyyy-MM-dd) the group belongs to. */
  day: string;
  items: NotificationItem[];
}

/** Groups an already newest-first list into day sections, preserving order. */
export function groupNotificationsByDay(items: NotificationItem[], now = new Date()): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const day = format(new Date(item.createdAt), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ label: dayLabel(item.createdAt, now), day, items: [item] });
  }
  return groups;
}

export function timeLabel(iso: string): string {
  return format(new Date(iso), "hh:mm a");
}
