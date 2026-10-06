"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/data/notifications";
import { runDailyChecks, type DueReminderSummary } from "@/lib/email/due-reminders";
import { toNotificationItem, type NotificationItem } from "@/lib/notifications";
import type { ActionResult } from "@/lib/validation/common";

import { failure } from "./utils";

function revalidateNotifications() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/notifications");
}

/** Latest notifications plus the unread count, for the header panel. */
export async function fetchNotificationsAction(limit = 50): Promise<{ items: NotificationItem[]; unread: number }> {
  const { business } = await requireUser();
  const safeLimit = z.number().int().min(1).max(200).catch(50).parse(limit);
  const [rows, unread] = await Promise.all([listNotifications(business.id, safeLimit), getUnreadNotificationCount(business.id)]);
  return { items: rows.map(toNotificationItem), unread };
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const { business } = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid notification." };
  try {
    await markNotificationRead(business.id, parsed.data);
    revalidateNotifications();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not update the notification.");
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const { business } = await requireUser();
  try {
    await markAllNotificationsRead(business.id);
    revalidateNotifications();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Could not update notifications.");
  }
}

/** Manually runs the due-date scan and reminder emails for the current business. */
export async function runDueChecksAction(): Promise<ActionResult<DueReminderSummary>> {
  const { business } = await requireUser();
  try {
    const summary = await runDailyChecks(business.id);
    revalidateNotifications();
    revalidatePath("/dashboard/invoices");
    return { ok: true, data: summary };
  } catch (error) {
    return failure(error, "Could not run the due-date check.");
  }
}
