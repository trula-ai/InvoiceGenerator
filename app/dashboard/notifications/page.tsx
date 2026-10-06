import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationsToolbar } from "@/components/notifications/notifications-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { syncOverdueStatuses } from "@/lib/data/invoices";
import { listNotifications, syncPaymentNotifications } from "@/lib/data/notifications";
import { toNotificationItem } from "@/lib/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { business } = await requireUser();

  // Keep the feed current: flag anything newly due or overdue before listing.
  await syncOverdueStatuses(business.id);
  await syncPaymentNotifications(business.id);

  const rows = await listNotifications(business.id);
  const items = rows.map(toNotificationItem);
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unread
            ? `${unread} unread · payment activity, due dates and reminders for your invoices.`
            : "Payment activity, due dates and reminders for your invoices."
        }
      >
        <NotificationsToolbar unread={unread} />
      </PageHeader>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <NotificationList items={items} />
      </div>
    </>
  );
}
