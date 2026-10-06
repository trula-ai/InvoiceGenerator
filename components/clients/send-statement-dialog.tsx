"use client";

import { useState, useTransition } from "react";
import { MailPlus } from "lucide-react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { sendClientStatementAction } from "@/lib/actions/statements";

interface SendStatementDialogProps {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  /** False when the client owes nothing; the button is then disabled. */
  hasOutstanding: boolean;
  /** Short description of what is owed, e.g. "₹29,500.00 outstanding". */
  outstandingLabel?: string;
  emailConfigured: boolean;
  /** Icon-only trigger for table rows. */
  compact?: boolean;
}

/**
 * Manual client-level reminder: one statement email listing every unpaid
 * invoice for the client, with the PDFs attached. Available on the clients
 * list (per row) and on the client page.
 */
export function SendStatementDialog({ clientId, clientName, clientEmail, hasOutstanding, outstandingLabel, emailConfigured, compact = false }: SendStatementDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [message, setMessage] = useState("");
  const [sending, startSend] = useTransition();

  const label = "Send payment reminder";
  const title = hasOutstanding ? label : "No outstanding invoices";

  function send() {
    startSend(async () => {
      const result = await sendClientStatementAction(clientId, { to, message });
      if (result.ok) {
        const n = result.data.invoiceCount;
        toast.success(
          result.data.provider === "console"
            ? `Statement simulated to ${result.data.to} (no email provider configured; see server console)`
            : `Statement for ${n} invoice${n === 1 ? "" : "s"} emailed to ${result.data.to}`,
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
        disabled={!hasOutstanding}
        render={
          compact ? (
            <Button variant="ghost" size="icon-sm" aria-label={`${label} to ${clientName}`} title={title} />
          ) : (
            <Button variant="outline" title={title} />
          )
        }
      >
        <MailPlus />
        {compact ? null : label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send payment reminder to {clientName}</DialogTitle>
          <DialogDescription>
            One statement email listing every unpaid invoice{outstandingLabel ? ` (${outstandingLabel})` : ""}, with the invoice PDFs attached.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field>
            <FieldLabel htmlFor={`statement-to-${clientId}`}>Recipient</FieldLabel>
            <Input id={`statement-to-${clientId}`} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
            {!clientEmail ? <FieldDescription>This client has no email saved; enter one here.</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`statement-message-${clientId}`}>Message (optional)</FieldLabel>
            <Textarea
              id={`statement-message-${clientId}`}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional note, e.g. a reply-by date or a thank you…"
            />
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
            {sending ? <Spinner /> : <MailPlus />} Send statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
