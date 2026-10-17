"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/shared/date-picker";
import { SelectField } from "@/components/shared/select-field";
import { createRecurringAction, updateRecurringAction } from "@/lib/actions/recurring";
import type { RecurringFrequency } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { FREQUENCY_LABELS, RECURRING_FREQUENCIES, anchorDayOf, nextRunDate } from "@/lib/recurring";
import { recurringScheduleSchema, type RecurringScheduleInput, type RecurringScheduleValues } from "@/lib/validation/recurring";

const FREQUENCY_OPTIONS = RECURRING_FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }));

interface RecurringFormProps {
  mode: "create" | "edit";
  /** Invoice the template is copied from (create mode). */
  invoiceId?: string;
  profileId?: string;
  defaultValues?: Partial<RecurringScheduleInput>;
  /** Shown in the preview card. */
  summary: { clientName: string; sourceInvoiceNumber: string; totalLabel: string; itemCount: number };
  /** Rendered at the top of the Schedule card, e.g. the invoice picker. */
  before?: React.ReactNode;
  /** Cancel handler; defaults to going back in history. */
  onCancel?: () => void;
}

export function RecurringForm({ mode, invoiceId, profileId, defaultValues, summary, before, onCancel }: RecurringFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RecurringScheduleInput, unknown, RecurringScheduleValues>({
    resolver: zodResolver(recurringScheduleSchema),
    defaultValues: {
      name: "",
      frequency: "monthly",
      startDate: "",
      endDate: "",
      maxOccurrences: "",
      autoSend: true,
      internalNote: "",
      ...defaultValues,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const frequency = useWatch({ control: form.control, name: "frequency" }) as RecurringFrequency | undefined;
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const preview = startDate && frequency ? [startDate, nextRunDate(startDate, frequency, anchorDayOf(startDate))] : [];
  if (preview.length === 2 && frequency) preview.push(nextRunDate(preview[1], frequency, anchorDayOf(startDate!)));

  // Send the raw input; the Server Action re-validates and normalises it.
  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    const raw = form.getValues();
    const result = mode === "create" ? await createRecurringAction(invoiceId!, raw) : await updateRecurringAction(profileId!, raw);
    if (result && !result.ok) {
      setServerError(result.error);
      toast.error(result.error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>An invoice is generated on each run date with the lines from {summary.sourceInvoiceNumber}, numbered and dated like any other invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {before}
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" placeholder="Monthly retainer" {...form.register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.frequency}>
                  <FieldLabel htmlFor="frequency">Repeat</FieldLabel>
                  <Controller
                    control={form.control}
                    name="frequency"
                    render={({ field }) => <SelectField id="frequency" options={FREQUENCY_OPTIONS} value={field.value ?? "monthly"} onValueChange={field.onChange} />}
                  />
                  <FieldError errors={[errors.frequency]} />
                </Field>
                <Field data-invalid={!!errors.startDate}>
                  <FieldLabel htmlFor="startDate">{mode === "create" ? "First invoice on" : "Start date"}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="startDate"
                    render={({ field }) => <DatePicker id="startDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.startDate} />}
                  />
                  <FieldDescription>Monthly and longer schedules keep this day of the month, clamped to shorter months.</FieldDescription>
                  <FieldError errors={[errors.startDate]} />
                </Field>
                <Field data-invalid={!!errors.endDate}>
                  <FieldLabel htmlFor="endDate">End date (optional)</FieldLabel>
                  <Controller
                    control={form.control}
                    name="endDate"
                    render={({ field }) => <DatePicker id="endDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.endDate} allowClear />}
                  />
                  <FieldError errors={[errors.endDate]} />
                </Field>
                <Field data-invalid={!!errors.maxOccurrences}>
                  <FieldLabel htmlFor="maxOccurrences">Stop after (invoices, optional)</FieldLabel>
                  <Input id="maxOccurrences" inputMode="numeric" placeholder="e.g. 12" {...form.register("maxOccurrences")} />
                  <FieldError errors={[errors.maxOccurrences]} />
                </Field>
              </div>
              <Field orientation="horizontal">
                <Controller
                  control={form.control}
                  name="autoSend"
                  render={({ field }) => <Switch id="autoSend" checked={field.value ?? true} onCheckedChange={(checked) => field.onChange(checked)} />}
                />
                <FieldLabel htmlFor="autoSend">Email each invoice to the client as soon as it is generated</FieldLabel>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>What each run will produce.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Client" value={summary.clientName} />
            <Row label="Template" value={`${summary.sourceInvoiceNumber} · ${summary.itemCount} line${summary.itemCount === 1 ? "" : "s"}`} />
            <Row label="Amount" value={summary.totalLabel} />
            {preview.length ? (
              <div className="mt-2 border-t pt-2">
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Next run dates</p>
                {preview.map((d) => (
                  <p key={d}>{formatDate(d)}</p>
                ))}
                <p className="mt-1 text-xs text-muted-foreground">Runs happen during the daily check, so invoices appear on or shortly after each date.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? <Spinner /> : null} {mode === "create" ? "Start schedule" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => (onCancel ? onCancel() : history.back())}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
