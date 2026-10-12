import { render } from "@react-email/components";
import { eq } from "drizzle-orm";
import { createElement } from "react";

import { businesses, users } from "@/db/schema";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

import { getEmailProvider } from "./provider";
import {
  OwnerNotifyEmail,
  ownerNotifyEmailText,
  ownerNotifySubject,
  type OwnerNotifyEmailProps,
  type OwnerNotifyEvent,
  type OwnerNotifyPending,
} from "./templates/owner-notify-email";
import { appBaseUrl } from "./urls";

export interface OwnerNotifyInput {
  /** ISO date the run happened on. */
  date: string;
  events: OwnerNotifyEvent[];
  pending: OwnerNotifyPending[];
  pendingTotals: string[];
}

/**
 * "Notify mail": emails every user of the business a summary of the reminders
 * that just went out and the invoices still waiting for payment. Not written
 * to `email_logs` (that table is the per-invoice client audit trail).
 * Returns the number of recipients the provider accepted.
 */
export async function sendOwnerNotifyEmail(businessId: string, input: OwnerNotifyInput): Promise<number> {
  const [business] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) return 0;
  const recipients = await db.select({ email: users.email }).from(users).where(eq(users.businessId, businessId));
  if (!recipients.length) return 0;

  const props: OwnerNotifyEmailProps = {
    businessName: business.name,
    dateLabel: formatDate(input.date),
    events: input.events,
    pending: input.pending,
    pendingTotals: input.pendingTotals,
    dashboardUrl: `${appBaseUrl()}/dashboard/notifications`,
  };
  const subject = ownerNotifySubject(props);
  const [html, text] = [await render(createElement(OwnerNotifyEmail, props)), ownerNotifyEmailText(props)];
  const provider = getEmailProvider();

  let delivered = 0;
  for (const { email } of recipients) {
    try {
      await provider.send({ to: email.trim().toLowerCase(), subject, html, text });
      delivered += 1;
    } catch (error) {
      console.error(`[owner-notify] could not email ${email}:`, error instanceof Error ? error.message : error);
    }
  }
  return delivered;
}
