"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/shared/date-picker";
import { SelectField } from "@/components/shared/select-field";
import { saveInstallmentPlanAction } from "@/lib/actions/installments";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  INSTALLMENT_FREQUENCIES,
  INSTALLMENT_FREQUENCY_LABELS,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  buildInstallmentSchedule,
  rescaleInstallments,
  sumInstallments,
  type InstallmentDraft,
  type InstallmentFrequency,
} from "@/lib/installments";
import { D } from "@/lib/money";
import { installmentPlanSchema, type InstallmentPlanInput, type InstallmentPlanValues } from "@/lib/validation/installments";

const FREQUENCY_OPTIONS = INSTALLMENT_FREQUENCIES.map((f) => ({ value: f, label: INSTALLMENT_FREQUENCY_LABELS[f] }));

interface InstallmentPlanFormProps {
  mode: "create" | "edit";
  invoiceId: string;
  invoice: { invoiceNumber: string; clientName: string; total: string; currency: string; dueDate: string; amountPaid: string; creditAmount: string };
  /** Existing rows when editing. */
  initialRows?: InstallmentDraft[];
}

export function InstallmentPlanForm({ mode, invoiceId, invoice, initialRows }: InstallmentPlanFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [count, setCount] = useState(initialRows?.length ? String(initialRows.length) : "3");
  const [frequency, setFrequency] = useState<InstallmentFrequency>("monthly");
  const [firstDueDate, setFirstDueDate] = useState(initialRows?.[0]?.dueDate ?? (invoice.dueDate >= todayIso() ? invoice.dueDate : todayIso()));

  const form = useForm<InstallmentPlanInput, unknown, InstallmentPlanValues>({
    resolver: zodResolver(installmentPlanSchema),
    defaultValues: { installments: initialRows?.length ? initialRows : buildInstallmentSchedule({ total: invoice.total, count: 3, firstDueDate: invoice.dueDate, frequency: "monthly" }) },
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "installments" });
  const { errors, isSubmitting } = form.formState;
  const rows = useWatch({ control: form.control, name: "installments" }) ?? [];

  const sum = sumInstallments(rows.map((r) => ({ amount: r?.amount ?? "0" })));
  const difference = D(invoice.total).minus(D(sum));
  const balanced = difference.isZero();
  const covered = D(invoice.amountPaid).plus(D(invoice.creditAmount));

  function generate() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) {
      toast.error(`Choose between ${MIN_INSTALLMENTS} and ${MAX_INSTALLMENTS} installments`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
      toast.error("Pick the first due date");
      return;
    }
    replace(buildInstallmentSchedule({ total: invoice.total, count: n, firstDueDate, frequency }));
  }

  function spreadEvenly() {
    const current = form.getValues("installments");
    replace(rescaleInstallments(current.map((r) => ({ ...r, amount: "1" })), invoice.total));
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    if (!balanced) {
      setServerError(`Installments must add up to ${formatCurrency(invoice.total, invoice.currency)}.`);
      return;
    }
    const result = await saveInstallmentPlanAction(invoiceId, values);
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
            <CardTitle>Split the total</CardTitle>
            <CardDescription>Generate equal installments, then adjust any date or amount below. The plan must add up to the invoice total.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="count">Installments</FieldLabel>
                  <Input id="count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
                  <FieldDescription>
                    {MIN_INSTALLMENTS} to {MAX_INSTALLMENTS}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="frequency">Every</FieldLabel>
                  <SelectField id="frequency" options={FREQUENCY_OPTIONS} value={frequency} onValueChange={(v) => setFrequency(v as InstallmentFrequency)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="firstDueDate">First due on</FieldLabel>
                  <DatePicker id="firstDueDate" value={firstDueDate} onChange={setFirstDueDate} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={generate}>
                  <Wand2 /> Generate installments
                </Button>
                <Button type="button" variant="outline" onClick={spreadEvenly} disabled={fields.length === 0}>
                  Spread amounts evenly
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Installments</CardTitle>
            <CardDescription>Money already received is applied to the earliest installments first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="w-44 text-right">Amount ({invoice.currency})</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, i) => {
                  const rowErrors = errors.installments?.[i];
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <Field data-invalid={!!rowErrors?.dueDate}>
                          <Controller
                            control={form.control}
                            name={`installments.${i}.dueDate`}
                            render={({ field: f }) => <DatePicker id={`installments-${i}-dueDate`} value={f.value ?? ""} onChange={f.onChange} invalid={!!rowErrors?.dueDate} />}
                          />
                          <FieldError errors={[rowErrors?.dueDate]} />
                        </Field>
                      </TableCell>
                      <TableCell>
                        <Field data-invalid={!!rowErrors?.amount}>
                          <Input inputMode="decimal" className="text-right tabular-nums" aria-label={`Installment ${i + 1} amount`} {...form.register(`installments.${i}.amount`)} />
                          <FieldError errors={[rowErrors?.amount]} />
                        </Field>
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove installment ${i + 1}`} onClick={() => remove(i)} disabled={fields.length <= MIN_INSTALLMENTS}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {errors.installments?.root || (errors.installments && !Array.isArray(errors.installments)) ? (
              <p className="mt-2 text-sm text-destructive">{errors.installments.root?.message ?? errors.installments.message}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fields.length >= MAX_INSTALLMENTS}
                onClick={() => {
                  const last = form.getValues("installments").at(-1);
                  append({ dueDate: last?.dueDate ?? firstDueDate, amount: "0.00" });
                }}
              >
                <Plus /> Add installment
              </Button>
              <div className="text-sm tabular-nums">
                <span className="text-muted-foreground">Plan total </span>
                <span className={balanced ? "font-medium" : "font-medium text-destructive"}>{formatCurrency(sum, invoice.currency)}</span>
                {!balanced ? (
                  <span className="text-destructive">
                    {" "}
                    ({difference.greaterThan(0) ? "short by" : "over by"} {formatCurrency(difference.abs().toFixed(2), invoice.currency)})
                  </span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
            <CardDescription>The plan replaces the single due date of {formatDate(invoice.dueDate)}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Invoice" value={invoice.invoiceNumber} />
            <Row label="Client" value={invoice.clientName} />
            <Row label="Total" value={formatCurrency(invoice.total, invoice.currency)} />
            {covered.greaterThan(0) ? <Row label="Already covered" value={formatCurrency(covered.toFixed(2), invoice.currency)} /> : null}
            <Row label="Installments" value={String(fields.length)} />
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              Reminders go out before each installment, and the invoice shows as overdue when an installment is missed. The client can pay one installment at a time online.
            </p>
          </CardContent>
        </Card>
        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || !balanced} className="flex-1">
            {isSubmitting ? <Spinner /> : null} {mode === "create" ? "Save installment plan" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => history.back()}>
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
