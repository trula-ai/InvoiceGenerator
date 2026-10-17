"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DatePicker } from "@/components/shared/date-picker";
import { SelectField } from "@/components/shared/select-field";
import type { InvoiceStatus } from "@/db/schema";
import { createInstallmentPlansAction } from "@/lib/actions/installment-bulk";
import type { InstallmentCandidate } from "@/lib/data/installment-candidates";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  buildInstallmentSchedule,
  INSTALLMENT_FREQUENCIES,
  INSTALLMENT_FREQUENCY_LABELS,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  type InstallmentFrequency,
} from "@/lib/installments";

const FREQUENCY_OPTIONS = INSTALLMENT_FREQUENCIES.map((f) => ({ value: f, label: INSTALLMENT_FREQUENCY_LABELS[f] }));

interface BulkPlanSetupProps {
  candidates: InstallmentCandidate[];
}

/**
 * Pick one or more unpaid invoices and split all of them into installments
 * with the same count, frequency and first due date. Each invoice's plan is
 * generated from its own total.
 */
export function BulkPlanSetup({ candidates }: BulkPlanSetupProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("3");
  const [frequency, setFrequency] = useState<InstallmentFrequency>("monthly");
  const [firstDueDate, setFirstDueDate] = useState(todayIso());
  const [pending, startTransition] = useTransition();

  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  const chosen = useMemo(() => candidates.filter((c) => selected.has(c.id)), [candidates, selected]);
  const n = Number(count);
  const countValid = Number.isInteger(n) && n >= MIN_INSTALLMENTS && n <= MAX_INSTALLMENTS;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(candidates.map((c) => c.id)) : new Set());
  }

  function submit() {
    startTransition(async () => {
      const result = await createInstallmentPlansAction([...selected], { count: n, frequency, firstDueDate });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { created, failed } = result.data;
      if (created.length) {
        toast.success(`Recurring set up for ${created.length} invoice${created.length === 1 ? "" : "s"}`, {
          description: `${n} ${INSTALLMENT_FREQUENCY_LABELS[frequency].toLowerCase()} installments from ${formatDate(firstDueDate)}.`,
        });
      }
      for (const f of failed) toast.error(`${f.invoiceNumber}: ${f.error}`);
      setOpen(false);
      setSelected(new Set());
      router.refresh();
    });
  }

  const preview = chosen.slice(0, 3).map((c) => {
    const rows = countValid ? buildInstallmentSchedule({ total: c.total, count: n, firstDueDate, frequency }) : [];
    return { number: c.invoiceNumber, first: rows[0] ? formatCurrency(rows[0].amount, c.currency) : null };
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selected.size ? `${selected.size} of ${candidates.length} selected` : `${candidates.length} unpaid invoice${candidates.length === 1 ? "" : "s"} without a plan`}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger disabled={selected.size === 0} render={<Button />}>
            <Repeat /> Set up recurring{selected.size ? ` (${selected.size})` : ""}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set up recurring payments</DialogTitle>
              <DialogDescription>
                Split {selected.size === 1 ? "the selected invoice" : `each of the ${selected.size} selected invoices`} into equal installments, EMI style. Every installment gets its own due date, reminder and overdue status.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="my-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field data-invalid={!countValid}>
                  <FieldLabel htmlFor="bulk-count">Installments</FieldLabel>
                  <Input id="bulk-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="bulk-frequency">Every</FieldLabel>
                  <SelectField id="bulk-frequency" options={FREQUENCY_OPTIONS} value={frequency} onValueChange={(v) => setFrequency(v as InstallmentFrequency)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="bulk-first">First due on</FieldLabel>
                  <DatePicker id="bulk-first" value={firstDueDate} onChange={setFirstDueDate} />
                </Field>
              </div>
              <FieldDescription>
                {countValid
                  ? preview.map((p) => `${p.number}: ${n} × ${p.first ?? "—"}`).join(" · ") + (chosen.length > 3 ? ` · and ${chosen.length - 3} more` : "")
                  : `Enter between ${MIN_INSTALLMENTS} and ${MAX_INSTALLMENTS} installments.`}
              </FieldDescription>
            </FieldGroup>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending || !countValid || !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)}>
                {pending ? <Spinner /> : <Repeat />} Create {selected.size === 1 ? "plan" : `${selected.size} plans`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {candidates.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Repeat />
            </EmptyMedia>
            <EmptyTitle>No unpaid invoices to split</EmptyTitle>
            <EmptyDescription>Every unpaid invoice already has a plan, or there are no unpaid invoices yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} onCheckedChange={(on) => toggleAll(!!on)} aria-label="Select all invoices" />
                </TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead className="hidden lg:table-cell">Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => {
                const on = selected.has(c.id);
                return (
                  <TableRow key={c.id} data-state={on ? "selected" : undefined} className={on ? "bg-accent/40" : undefined}>
                    <TableCell>
                      <Checkbox checked={on} onCheckedChange={(v) => toggle(c.id, !!v)} aria-label={`Select ${c.invoiceNumber}`} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/invoices/${c.id}`} className="font-medium hover:underline">
                        {c.invoiceNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground md:hidden">{c.clientName}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/dashboard/clients/${c.clientId}`} className="hover:underline">
                        {c.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(c.issueDate)}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(c.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.total, c.currency)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(c.balanceDue, c.currency)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status as InvoiceStatus} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
