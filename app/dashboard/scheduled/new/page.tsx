import { redirect } from "next/navigation";

/**
 * Schedules are now created inline on the Scheduled invoices page. This route
 * only keeps old links working: `?invoice=<id>` preselects that invoice there.
 */
export default async function NewRecurringPage({ searchParams }: PageProps<"/dashboard/scheduled/new">) {
  const params = await searchParams;
  const invoiceId = typeof params.invoice === "string" ? params.invoice : undefined;
  redirect(invoiceId ? `/dashboard/scheduled?invoice=${encodeURIComponent(invoiceId)}` : "/dashboard/scheduled");
}
