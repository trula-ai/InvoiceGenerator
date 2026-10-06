"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { recordPaymentAction } from "@/lib/actions/payments";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency } from "@/lib/format";
import { paymentSchema, type PaymentFormInput, type PaymentFormValues } from "@/lib/validation/payment";

interface RecordPaymentDialogProps {
  invoiceId: string;
  currency: string;
  balanceDue: string;
}

export function RecordPaymentDialog({ invoiceId, currency, balanceDue }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { invoiceId, amount: balanceDue, paymentDate: todayIso(), method: "bank_transfer", reference: "", notes: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await recordPaymentAction(values);
    if (result.ok) {
      toast.success("Payment recorded");
      setOpen(false);
      form.reset({ invoiceId, amount: "", paymentDate: todayIso(), method: "bank_transfer", reference: "", notes: "" });
    } else {
      toast.error(result.error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Wallet /> Record payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>Outstanding balance: {formatCurrency(balanceDue, currency)}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.amount}>
                <FieldLabel htmlFor="amount">Amount ({currency})</FieldLabel>
                <Input id="amount" inputMode="decimal" className="text-right tabular-nums" {...form.register("amount")} />
                <FieldError errors={[errors.amount]} />
              </Field>
              <Field data-invalid={!!errors.paymentDate}>
                <FieldLabel htmlFor="paymentDate">Payment date</FieldLabel>
                <Controller
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <DatePicker id="paymentDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentDate} />
                  )}
                />
                <FieldError errors={[errors.paymentDate]} />
              </Field>
            </div>
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
            <Field data-invalid={!!errors.reference}>
              <FieldLabel htmlFor="reference">Reference</FieldLabel>
              <Input id="reference" placeholder="UTR, transaction id, cheque no." {...form.register("reference")} />
              <FieldDescription>Printed on the receipt.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentNotes">Notes</FieldLabel>
              <Textarea id="paymentNotes" rows={2} {...form.register("notes")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
