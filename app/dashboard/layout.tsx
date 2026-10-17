import { after } from "next/server";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { can, requireUser } from "@/lib/auth/current-user";
import { getPendingInvoiceCount } from "@/lib/data/dashboard";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { countPendingPayments } from "@/lib/data/payments";
import { maybeRunDailyChecks } from "@/lib/email/due-reminders";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const current = await requireUser();
  const { user, business, permissions } = current;
  const [pendingCount, unreadCount, toVerify] = await Promise.all([
    getPendingInvoiceCount(business.id),
    getUnreadNotificationCount(business.id),
    can(current, "payments.verify") ? countPendingPayments(business.id) : Promise.resolve(0),
  ]);

  // Due-date scan and reminder emails, once an hour per business, after the
  // response has been sent so page loads never wait on email delivery.
  after(() => maybeRunDailyChecks(business.id));

  return (
    <SidebarProvider>
      <DashboardSidebar
        workspaceName={business.name}
        badges={{ "/dashboard/invoices": pendingCount, "/dashboard/notifications": unreadCount, "/dashboard/payments/verification": toVerify }}
        permissions={permissions}
      />
      <SidebarInset>
        <DashboardHeader workspaceName={business.name} user={{ name: user.name, email: user.email, roles: user.roles }} unreadNotifications={unreadCount} />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
