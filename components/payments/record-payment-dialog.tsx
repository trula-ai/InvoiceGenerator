"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert, Wallet } from "lucide-react";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/date-picker";
import { PAYMENT_METHOD_OPTIONS } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { recordPaymentAction, uploadPaymentEvidenceAction } from "@/lib/actions/payments";
import type { DuplicateMatch } from "@/lib/data/payments";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import { paymentSchema, type PaymentFormInput, type PaymentFormValues } from "@/lib/validation/payment";

interface RecordPaymentDialogProps {
  invoiceId: string;
  currency: string;
  balanceDue: string;
  /** Pre-fills the amount with the next installment instead of the full balance. */
  suggested?: { amount: string; label: string } | null;
}

function emptyValues(invoiceId: string, amount: string): PaymentFormInput {
  return { invoiceId, amount, paymentDate: todayIso(), method: "bank_transfer", reference: "", receivingAccount: "", notes: "", allowDuplicate: false };
}

/**
 * Records a payment the business has received. The entry is saved as
 * "pending verification": it does not change the invoice balance until a
 * finance user confirms the money arrived. Proof files are uploaded right
 * after the entry is created.
 */
export function RecordPaymentDialog({ invoiceId, currency, balanceDue, suggested }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Bumped on reset so the uncontrolled file input is remounted empty.
  const [fileInputKey, setFileInputKey] = useState(0);
  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: emptyValues(invoiceId, suggested?.amount ?? balanceDue),
  });
  const { errors, isSubmitting } = form.formState;

  function reset() {
    form.reset(emptyValues(invoiceId, suggested?.amount ?? balanceDue));
    setDuplicates(null);
    setFiles([]);
    setFileInputKey((k) => k + 1);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await recordPaymentAction(values);
    if (!result.ok) {
      if ("duplicates" in result) {
        setDuplicates(result.duplicates);
        toast.warning("A payment with this reference already exists");
      } else {
        toast.error(result.error);
      }
      return;
    }

    let attached = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.set("file", file);
      const upload = await uploadPaymentEvidenceAction(result.data.paymentId, invoiceId, fd);
      if (upload.ok) attached += 1;
      else toast.error(`${file.name}: ${upload.error}`);
    }

    toast.success("Payment recorded, awaiting finance verification", {
      description: `${attached ? `${attached} proof file${attached === 1 ? "" : "s"} attached. ` : ""}It will count toward the invoice once verified.`,
    });
    setOpen(false);
    reset();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Wallet /> Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              Outstanding balance: {formatCurrency(balanceDue, currency)}
              {suggested ? ` · ${suggested.label}: ${formatCurrency(suggested.amount, currency)}` : ""}. Saved for finance verification; it counts once verified.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.amount}>
                <FieldLabel htmlFor="amount">Amount ({currency})</FieldLabel>
                <Input id="amount" inputMode="decimal" className="text-right tabular-nums" {...form.register("amount")} />
                <FieldError errors={[errors.amount]} />
              </Field>
              <Field data-invalid={!!errors.paymentDate}>
                <FieldLabel htmlFor="paymentDate">Date received</FieldLabel>
                <Controller
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <DatePicker id="paymentDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentDate} />
                  )}
                />
                <FieldDescription>When the money actually arrived.</FieldDescription>
                <FieldError errors={[errors.paymentDate]} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.method}>
                <FieldLabel htmlFor="method">Method</FieldLabel>
                <Controller
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <SelectField id="method" options={PAYMENT_METHOD_OPTIONS} value={field.value ?? "bank_transfer"} onValueChange={field.onChange} />
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.receivingAccount}>
                <FieldLabel htmlFor="receivingAccount">Received in</FieldLabel>
                <Input id="receivingAccount" placeholder="HDFC current a/c, UPI id, Razorpay" {...form.register("receivingAccount")} />
                <FieldError errors={[errors.receivingAccount]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.reference}>
              <FieldLabel htmlFor="reference">Reference / UTR</FieldLabel>
              <Input id="reference" placeholder="UTR, transaction id, cheque no." {...form.register("reference")} />
              <FieldDescription>Printed on the receipt and checked against other payments for duplicates.</FieldDescription>
              <FieldError errors={[errors.reference]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="evidence">Proof of payment</FieldLabel>
              <Input
                key={fileInputKey}
                id="evidence"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                multiple
                className="file:mr-3 file:text-sm"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <FieldDescription>Screenshot, bank statement extract or gateway confirmation. PNG, JPEG, WebP or PDF, up to 5 MB each.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentNotes">Notes</FieldLabel>
              <Textarea id="paymentNotes" rows={2} {...form.register("notes")} />
            </Field>

            {duplicates ? (
              <div role="alert" className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="size-4 text-amber-600" /> This reference is already recorded
                </p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {duplicates.map((d) => (
                    <li key={d.paymentId}>
                      {d.receiptNumber ?? "Pending"} on {d.invoiceNumber}: {formatCurrency(d.amount, currency)} on {formatDate(d.paymentDate)} ({d.status})
                    </li>
                  ))}
                </ul>
                <Controller
                  control={form.control}
                  name="allowDuplicate"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                      <span>Record anyway, this is a different transaction</span>
                    </label>
                  )}
                />
              </div>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} Save for verification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
