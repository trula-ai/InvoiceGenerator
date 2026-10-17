"use client";

import { useRef, useState, useTransition } from "react";
import { BadgeCheck, Paperclip, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { rejectPaymentAction, reversePaymentAction, uploadPaymentEvidenceAction, verifyPaymentAction, withdrawPaymentAction } from "@/lib/actions/payments";

/**
 * Buttons that move a payment through its verification lifecycle. Each one
 * calls the matching Server Action, which checks the user's permission
 * again; the page only renders the buttons the user may use.
 */

interface PaymentRef {
  paymentId: string;
  invoiceId: string;
  /** e.g. "₹20,000.00 from Globex" for confirmation copy. */
  label: string;
  /** Icon-only triggers for table rows. */
  compact?: boolean;
}

export function VerifyPaymentButton({ paymentId, invoiceId, label, compact }: PaymentRef) {
  const [pending, startTransition] = useTransition();
  function verify() {
    startTransition(async () => {
      const result = await verifyPaymentAction(paymentId, invoiceId);
      if (result.ok) toast.success("Payment verified and receipt issued");
      else toast.error(result.error);
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger render={compact ? <Button variant="ghost" size="icon-sm" aria-label="Verify payment" disabled={pending} /> : <Button size="sm" disabled={pending} />}>
        {pending ? <Spinner /> : <BadgeCheck />}
        {compact ? null : " Verify"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verify this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm only after matching {label} against the bank or gateway statement. The amount will count toward the invoice and a receipt number will be issued.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction onClick={verify}>Verify</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReasonDialog({
  paymentId,
  invoiceId,
  label,
  compact,
  mode,
}: PaymentRef & { mode: "reject" | "reverse" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isReject = mode === "reject";

  function submit() {
    setError(null);
    startTransition(async () => {
      const action = isReject ? rejectPaymentAction : reversePaymentAction;
      const result = await action({ paymentId, reason }, invoiceId);
      if (result.ok) {
        toast.success(isReject ? "Payment rejected" : "Payment reversed; the invoice balance has been restored");
        setOpen(false);
        setReason("");
      } else {
        setError(result.fieldErrors?.reason?.[0] ?? result.error);
      }
    });
  }

  const Icon = isReject ? X : RotateCcw;
  const title = isReject ? "Reject payment" : "Reverse payment";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={title} className={isReject ? "text-destructive hover:text-destructive" : undefined} />
          ) : (
            <Button variant={isReject ? "outline" : "outline"} size="sm" className={isReject ? "text-destructive hover:text-destructive" : undefined} />
          )
        }
      >
        <Icon />
        {compact ? null : ` ${isReject ? "Reject" : "Reverse"}`}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isReject
              ? `${label} will stay on record as rejected and will not count toward the invoice.`
              : `${label} will be marked reversed (refund, bounce or chargeback). The invoice balance goes back up and the receipt becomes void.`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`${mode}-reason-${paymentId}`}>Reason</FieldLabel>
            <Textarea
              id={`${mode}-reason-${paymentId}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isReject ? "Not found in the bank statement for this date" : "Refunded to the client on request"}
            />
            <FieldDescription>Kept with the payment for the audit trail.</FieldDescription>
            <FieldError errors={[error ? { message: error } : undefined]} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || reason.trim().length < 3}>
            {pending ? <Spinner /> : null} {isReject ? "Reject" : "Reverse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectPaymentDialog(props: PaymentRef) {
  return <ReasonDialog {...props} mode="reject" />;
}

export function ReversePaymentDialog(props: PaymentRef) {
  return <ReasonDialog {...props} mode="reverse" />;
}

/** Removes a pending entry nobody has reviewed yet. */
export function WithdrawPaymentButton({ paymentId, invoiceId, label, compact }: PaymentRef) {
  const [pending, startTransition] = useTransition();
  function withdraw() {
    startTransition(async () => {
      const result = await withdrawPaymentAction(paymentId, invoiceId);
      if (result.ok) toast.success("Pending payment withdrawn");
      else toast.error(result.error);
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger render={compact ? <Button variant="ghost" size="icon-sm" aria-label="Withdraw pending payment" disabled={pending} /> : <Button variant="ghost" size="sm" disabled={pending} />}>
        <Trash2 />
        {compact ? null : " Withdraw"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this pending payment?</AlertDialogTitle>
          <AlertDialogDescription>{label} has not been verified, so nothing was counted. The entry and its attachments will be removed.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={withdraw}>
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Attaches one or more proof files to an existing payment. */
export function AddEvidenceButton({ paymentId, invoiceId, compact }: Omit<PaymentRef, "label">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    startTransition(async () => {
      let ok = 0;
      for (const file of list) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadPaymentEvidenceAction(paymentId, invoiceId, fd);
        if (result.ok) ok += 1;
        else toast.error(`${file.name}: ${result.error}`);
      }
      if (ok) toast.success(`${ok} file${ok === 1 ? "" : "s"} attached`);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon-sm" : "sm"}
        aria-label="Attach evidence"
        title="Attach a screenshot, bank statement extract or confirmation"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? <Spinner /> : <Paperclip />}
        {compact ? null : " Attach proof"}
      </Button>
    </>
  );
}
