import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InvoiceOverview } from "@/components/dashboard/invoice-overview";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { RecentPayments } from "@/components/dashboard/recent-payments";
import { RecordsCard } from "@/components/dashboard/records-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { requireUser } from "@/lib/auth/current-user";
import { getDashboardData } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { business } = await requireUser();
  const data = await getDashboardData(business.id);
  const { currency } = data;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your invoices, payments and revenue. All totals in {currency}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/clients/new" />}>
            <Users /> Add client
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard/invoices/new" />}>
            <Plus /> New invoice
          </Button>
        </div>
      </div>

      <OverviewStats stats={data.overviewStats} currency={currency} />

      <div className="grid gap-6 lg:grid-cols-5">
        <RevenueChart data={data.revenueByMonth} summary={data.revenueSummary} currency={currency} className="lg:col-span-3" />
        <InvoiceOverview stats={data.invoiceStats} className="lg:col-span-2" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <RecentInvoices invoices={data.recentInvoices} className="xl:col-span-3" />
        <RecentPayments payments={data.recentPayments} className="xl:col-span-2" />
      </div>

      <RecordsCard records={data.records} />
    </>
  );
}
