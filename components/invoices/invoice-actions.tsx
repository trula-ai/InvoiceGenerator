"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft, Ban, BellRing, Check, Copy, CopyPlus, Download, Eye, FileMinus, Link2, Mail, Pencil, Send, Trash2, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import type { DocumentKind, InvoiceStatus } from "@/db/schema";
import {
  cancelInvoiceAction,
  convertQuoteAction,
  deleteDraftInvoiceAction,
  issueInvoiceAction,
  respondToQuoteAction,
  sendInvoiceEmailAction,
  sendReminderEmailAction,
} from "@/lib/actions/invoices";
import { QUOTE_CONVERTIBLE_STATUSES, QUOTE_OPEN_STATUSES, documentBasePath, documentLabel, documentPath } from "@/lib/documents";
import { publicInvoicePath } from "@/lib/email/urls";

interface InvoiceActionsProps {
  kind?: DocumentKind;
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  balanceDue: string;
  hasPayments: boolean;
  editable: boolean;
  /** For quotes: already turned into an invoice. */
  converted?: boolean;
  clientEmail: string | null;
  emailConfigured: boolean;
  publicToken: string;
}

export function InvoiceActions(props: InvoiceActionsProps) {
  const { kind = "invoice", invoiceId, status, currency, balanceDue, hasPayments, editable, converted = false, clientEmail, publicToken } = props;
  const [pending, startTransition] = useTransition();
  const label = documentLabel(kind);
  const lower = label.toLowerCase();
  const isInvoice = kind === "invoice";
  const payable = isInvoice && ["pending", "partially_paid", "overdue"].includes(status);
  const issued = isInvoice && ["pending", "partially_paid", "paid", "overdue"].includes(status);
  const quoteOpen = kind === "quote" && QUOTE_OPEN_STATUSES.includes(status);
  const quoteConvertible = kind === "quote" && !converted && QUOTE_CONVERTIBLE_STATUSES.includes(status);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong");
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}${publicInvoicePath(publicToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Public ${lower} link copied`, {
        description: kind === "quote" ? "Anyone with the link can view the quote and accept or decline it." : `Anyone with the link can view and download this ${lower}.`,
      });
    } catch {
      toast.error("Could not copy the link", { description: url });
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" nativeButton={false} render={<a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer" />}>
        <Eye /> Preview PDF
      </Button>
      <Button variant="outline" nativeButton={false} render={<a href={`/api/invoices/${invoiceId}/pdf?download=1`} />}>
        <Download /> Download PDF
      </Button>

      {status !== "draft" ? (
        <Button variant="outline" onClick={copyLink} title={`Copy the public, no-login link to this ${lower}`}>
          <Link2 /> Copy link
        </Button>
      ) : null}

      {status !== "cancelled" ? (
        <EmailDialog kind="invoice" documentKind={kind} invoiceId={invoiceId} clientEmail={clientEmail} emailConfigured={props.emailConfigured} />
      ) : null}

      {payable ? (
        <EmailDialog kind="reminder" invoiceId={invoiceId} clientEmail={clientEmail} emailConfigured={props.emailConfigured} overdue={status === "overdue"} />
      ) : null}

      {payable ? <RecordPaymentDialog invoiceId={invoiceId} currency={currency} balanceDue={balanceDue} /> : null}

      {status === "draft" ? (
        <Button onClick={() => run(() => issueInvoiceAction(invoiceId), `${label} issued`)} disabled={pending}>
          <Send /> Issue {lower}
        </Button>
      ) : null}

      {quoteOpen ? (
        <>
          <Button onClick={() => run(() => respondToQuoteAction(invoiceId, "accepted"), "Quote marked accepted")} disabled={pending}>
            <Check /> Mark accepted
          </Button>
          <Button variant="outline" onClick={() => run(() => respondToQuoteAction(invoiceId, "declined"), "Quote marked declined")} disabled={pending}>
            <X /> Mark declined
          </Button>
        </>
      ) : null}

      {quoteConvertible ? (
        <Button
          variant={status === "accepted" ? "default" : "outline"}
          onClick={() => startTransition(async () => {
            const result = await convertQuoteAction(invoiceId);
            if (result && !result.ok) toast.error(result.error);
          })}
          disabled={pending}
          title="Create an invoice with the same client and lines, dated today"
        >
          <ArrowRightLeft /> Convert to invoice
        </Button>
      ) : null}

      {issued ? (
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/credit-notes/new?invoice=${invoiceId}`} />} title="Credit all or part of this invoice">
          <FileMinus /> Credit note
        </Button>
      ) : null}

      {editable ? (
        <Button variant="outline" nativeButton={false} render={<Link href={`${documentPath(kind, invoiceId)}/edit`} />}>
          <Pencil /> Edit
        </Button>
      ) : null}

      {kind !== "credit_note" ? (
        <Button variant="outline" nativeButton={false} render={<Link href={`${documentBasePath(kind)}/new?from=${invoiceId}`} />} title={`Start a new ${lower} with the same client and items`}>
          <CopyPlus /> Duplicate
        </Button>
      ) : null}

      {status === "draft" ? (
        <ConfirmButton
          title="Delete this draft?"
          description={`The draft and its items are removed permanently. The ${lower} number will not be reused.`}
          actionLabel="Delete draft"
          variant="destructive"
          icon={<Trash2 />}
          onConfirm={() => run(() => deleteDraftInvoiceAction(invoiceId), "Draft deleted")}
          disabled={pending}
        />
      ) : status !== "cancelled" && status !== "paid" && status !== "converted" && !hasPayments ? (
        <ConfirmButton
          title={`Cancel ${props.invoiceNumber}?`}
          description={
            kind === "credit_note"
              ? "The credit is removed from the invoice it was applied to, and the credit note stays in your records marked as cancelled."
              : `The ${lower} stays in your records marked as cancelled and is excluded from revenue.`
          }
          actionLabel={`Cancel ${lower}`}
          variant="destructive"
          icon={<Ban />}
          onConfirm={() => run(() => cancelInvoiceAction(invoiceId), `${label} cancelled`)}
          disabled={pending}
        />
      ) : null}
    </div>
  );
}

function ConfirmButton({
  title,
  description,
  actionLabel,
  icon,
  onConfirm,
  disabled,
}: {
  title: string;
  description: string;
  actionLabel: string;
  variant: "destructive";
  icon: React.ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={disabled} />}>
        {icon} {actionLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EMAIL_COPY = {
  invoice: {
    trigger: "Send email",
    title: "Send invoice by email",
    description: "The invoice PDF is attached automatically.",
    placeholder: "Add a personal note…",
    success: "Invoice emailed to",
    simulated: "Email simulated to",
  },
  reminder: {
    trigger: "Send reminder",
    title: "Send a payment reminder",
    description: "A polite reminder with the amount due, the due date and the invoice PDF attached.",
    placeholder: "Optional note, e.g. a short reply-by date or a thank you…",
    success: "Reminder emailed to",
    simulated: "Reminder simulated to",
  },
} as const;

export function EmailDialog({
  kind,
  documentKind = "invoice",
  invoiceId,
  clientEmail,
  emailConfigured,
  overdue,
  compact = false,
}: {
  kind: keyof typeof EMAIL_COPY;
  /** Which document the "invoice" email sends; changes the dialog wording. */
  documentKind?: DocumentKind;
  invoiceId: string;
  clientEmail: string | null;
  emailConfigured: boolean;
  overdue?: boolean;
  /** Icon-only trigger for table rows. */
  compact?: boolean;
}) {
  const docLabel = documentLabel(documentKind);
  const copy =
    kind === "invoice"
      ? {
          ...EMAIL_COPY.invoice,
          title: `Send ${docLabel.toLowerCase()} by email`,
          description:
            documentKind === "quote"
              ? "The quote PDF is attached and the email links to a page where the client can accept or decline."
              : `The ${docLabel.toLowerCase()} PDF is attached automatically.`,
          success: `${docLabel} emailed to`,
          simulated: `${docLabel} email simulated to`,
        }
      : EMAIL_COPY[kind];
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [message, setMessage] = useState("");
  const [sending, startSend] = useTransition();

  function send() {
    startSend(async () => {
      const action = kind === "invoice" ? sendInvoiceEmailAction : sendReminderEmailAction;
      const result = await action(invoiceId, { to, message });
      if (result.ok) {
        toast.success(
          result.data.provider === "console"
            ? `${copy.simulated} ${result.data.to} (no email provider configured; see server console)`
            : `${copy.success} ${result.data.to}`,
        );
        setOpen(false);
        setMessage("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={copy.trigger} title={copy.trigger} />
          ) : (
            <Button variant={kind === "reminder" && overdue ? "secondary" : "outline"} />
          )
        }
      >
        {kind === "invoice" ? <Mail /> : <BellRing />}
        {compact ? null : copy.trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field>
            <FieldLabel htmlFor={`${kind}-to`}>Recipient</FieldLabel>
            <Input id={`${kind}-to`} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
            {!clientEmail ? <FieldDescription>This client has no email saved; enter one here.</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${kind}-message`}>Message (optional)</FieldLabel>
            <Textarea id={`${kind}-message`} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={copy.placeholder} />
          </Field>
          {!emailConfigured ? (
            <FieldDescription className="text-amber-600 dark:text-amber-400">
              No email provider is configured (set SMTP_HOST or RESEND_API_KEY). The email will be printed to the server console instead of being delivered.
            </FieldDescription>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !to}>
            {sending ? <Spinner /> : kind === "invoice" ? <Send /> : <Copy className="hidden" />}
            {sending ? null : kind === "reminder" ? <BellRing /> : null} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
