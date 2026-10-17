"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringForm } from "@/components/scheduled/recurring-form";
import { SourceInvoicePicker } from "@/components/scheduled/source-invoice-picker";
import type { InvoicePickerOption } from "@/lib/data/invoice-picker";
import { formatCurrency } from "@/lib/format";
import { addMonthsIso } from "@/lib/recurring";

interface NewScheduleCardProps {
  options: InvoicePickerOption[];
  /** Invoice to preselect, e.g. when arriving from an invoice's "Schedule repeat" action. */
  preselectedId?: string;
}

/**
 * One card to create a schedule: pick the invoice to repeat, then set the
 * cadence in the same card. No page change until the schedule is saved.
 */
export function NewScheduleCard({ options, preselectedId }: NewScheduleCardProps) {
  const [open, setOpen] = useState(!!preselectedId);
  const [invoiceId, setInvoiceId] = useState(preselectedId && options.some((o) => o.id === preselectedId) ? preselectedId : "");
  const chosen = options.find((o) => o.id === invoiceId);

  const picker = <SourceInvoicePicker options={options} value={invoiceId} onChange={setInvoiceId} />;

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={!options.length} title={options.length ? undefined : "Issue an invoice first"}>
          <Plus /> New schedule
        </Button>
      </div>
    );
  }

  if (!chosen) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New schedule</CardTitle>
          <CardDescription>Pick the invoice to repeat. The cadence options appear right here once an invoice is chosen.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {picker}
          <div>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <RecurringForm
      key={chosen.id}
      mode="create"
      invoiceId={chosen.id}
      before={picker}
      onCancel={() => {
        setInvoiceId("");
        setOpen(false);
      }}
      defaultValues={{ name: `${chosen.clientName} · scheduled`.slice(0, 120), startDate: addMonthsIso(chosen.issueDate, 1) }}
      summary={{
        clientName: chosen.clientName,
        sourceInvoiceNumber: chosen.invoiceNumber,
        totalLabel: formatCurrency(chosen.total, chosen.currency),
        itemCount: chosen.itemCount,
      }}
    />
  );
}
