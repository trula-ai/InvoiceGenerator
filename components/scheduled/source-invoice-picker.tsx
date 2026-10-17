"use client";

import { useMemo } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { SelectField } from "@/components/shared/select-field";
import type { InvoicePickerOption } from "@/lib/data/invoice-picker";
import { formatCurrency, formatDate } from "@/lib/format";

interface SourceInvoicePickerProps {
  options: InvoicePickerOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Dropdown of issued invoices to use as the template for a schedule. */
export function SourceInvoicePicker({ options, value, onChange, disabled }: SourceInvoicePickerProps) {
  const items = useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: `${o.invoiceNumber} · ${o.clientName} · ${formatCurrency(o.total, o.currency)} · ${formatDate(o.issueDate)}`,
      })),
    [options],
  );

  return (
    <Field>
      <FieldLabel htmlFor="sourceInvoice">Invoice to repeat</FieldLabel>
      <SelectField
        id="sourceInvoice"
        options={items}
        value={value}
        onValueChange={onChange}
        placeholder={options.length ? "Choose an issued invoice…" : "No issued invoices yet"}
        disabled={disabled || !options.length}
      />
      <FieldDescription>The schedule copies this invoice&apos;s client, line items and totals. Drafts and cancelled invoices are not listed.</FieldDescription>
    </Field>
  );
}
