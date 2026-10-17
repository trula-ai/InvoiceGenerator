import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecurringForm } from "@/components/scheduled/recurring-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getRecurringProfile } from "@/lib/data/recurring";
import { calculateInvoice } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Edit scheduled invoice" };

export default async function EditRecurringPage({ params }: PageProps<"/dashboard/scheduled/[id]/edit">) {
  const { business } = await requireUser();
  const { id } = await params;
  const profile = await getRecurringProfile(business.id, id);
  if (!profile) notFound();
  const t = profile.template;
  const totals = calculateInvoice({
    items: t.items,
    discountType: t.discountType,
    discountValue: t.discountValue,
    gstEnabled: business.gstEnabled,
    isInterState: business.gstEnabled && !!t.placeOfSupplyCode && t.placeOfSupplyCode !== business.stateCode,
    exchangeRate: "1",
    roundTotals: business.roundTotals,
  });

  return (
    <>
      <PageHeader title={`Edit ${profile.name}`} description="Change when and how often invoices are generated. The invoice lines stay as they were copied from the original invoice." />
      <RecurringForm
        mode="edit"
        profileId={profile.id}
        defaultValues={{
          name: profile.name,
          frequency: profile.frequency,
          startDate: profile.startDate,
          endDate: profile.endDate ?? "",
          maxOccurrences: profile.maxOccurrences ? String(profile.maxOccurrences) : "",
          autoSend: profile.autoSend,
        }}
        summary={{ clientName: profile.clientName, sourceInvoiceNumber: profile.sourceInvoiceNumber ?? "invoice", totalLabel: formatCurrency(totals.total, t.currency), itemCount: t.items.length }}
      />
    </>
  );
}
