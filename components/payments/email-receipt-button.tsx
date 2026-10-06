"use client";

import { useState, useTransition } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { sendReceiptEmailAction } from "@/lib/actions/payments";

interface EmailReceiptButtonProps {
  paymentId: string;
  receiptNumber: string;
  clientEmail: string | null;
  emailConfigured: boolean;
  /** Compact icon-only trigger for table rows. */
  compact?: boolean;
}

export function EmailReceiptButton({ paymentId, receiptNumber, clientEmail, emailConfigured, compact }: EmailReceiptButtonProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [message, setMessage] = useState("");
  const [sending, startSend] = useTransition();

  function send() {
    startSend(async () => {
      const result = await sendReceiptEmailAction(paymentId, { to, message });
      if (result.ok) {
        toast.success(
          result.data.provider === "console"
            ? `Receipt simulated to ${result.data.to} (RESEND_API_KEY not set; see server console)`
            : `Receipt emailed to ${result.data.to}`,
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
        render={compact ? <Button variant="ghost" size="icon-sm" aria-label={`Email receipt ${receiptNumber}`} /> : <Button variant="outline" size="sm" />}
      >
        <Mail />
        {compact ? null : " Email receipt"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email receipt {receiptNumber}</DialogTitle>
          <DialogDescription>The receipt PDF is attached automatically.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field>
            <FieldLabel htmlFor={`receipt-to-${paymentId}`}>Recipient</FieldLabel>
            <Input id={`receipt-to-${paymentId}`} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
            {!clientEmail ? <FieldDescription>This client has no email saved; enter one here.</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`receipt-message-${paymentId}`}>Message (optional)</FieldLabel>
            <Textarea id={`receipt-message-${paymentId}`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a personal note…" />
          </Field>
          {!emailConfigured ? (
            <FieldDescription className="text-amber-600 dark:text-amber-400">
              RESEND_API_KEY is not configured. The email will be printed to the server console instead of being delivered.
            </FieldDescription>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !to}>
            {sending ? <Spinner /> : <Send />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
