"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, UserRoundPen, UserRoundPlus, X } from "lucide-react";
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
import { SelectField } from "@/components/shared/select-field";
import { approveAttributionAction, proposeAttributionAction, reassignAttributionAction, rejectAttributionAction } from "@/lib/actions/attribution";
import type { SalespersonOption } from "@/lib/data/attribution";
import { describeRoles } from "@/lib/auth/permissions";

/**
 * Buttons for the sales-attribution lifecycle. Each calls a Server Action
 * that checks the permission again; pages only render what the user may do.
 * None of these touch payment verification.
 */

export function salespersonOptions(people: SalespersonOption[]): { value: string; label: string }[] {
  return people.map((p) => ({ value: p.id, label: `${p.name} · ${describeRoles(p.roles)}` }));
}

interface ProposeProps {
  invoiceId: string;
  salespeople: SalespersonOption[];
  /** Pre-selected member: the client's approved owner, else the signed-in user. */
  defaultUserId: string | null;
  /** "Propose" for a new attribution, "Propose again" after a rejection, "Change proposal" while pending. */
  mode: "new" | "again" | "change";
  size?: "sm" | "default";
}

export function ProposeAttributionDialog({ invoiceId, salespeople, defaultUserId, mode, size = "sm" }: ProposeProps) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(defaultUserId ?? salespeople[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = mode === "new" ? "Credit this sale" : mode === "again" ? "Propose again" : "Change proposal";

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await proposeAttributionAction({ invoiceId, creditedUserId: userId, reason });
      if (result.ok) {
        toast.success("Sales credit proposed; a sales manager will review it");
        setOpen(false);
        setReason("");
      } else {
        setError(result.fieldErrors?.creditedUserId?.[0] ?? result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={size} variant={mode === "new" ? "default" : "outline"} />}>
        {mode === "change" ? <UserRoundPen /> : <UserRoundPlus />} {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who is credited with this sale?</DialogTitle>
          <DialogDescription>Internal only: the credited person is never printed on the invoice or receipt. A sales manager approves the credit.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`credit-${invoiceId}`}>Sales credited to</FieldLabel>
            <SelectField id={`credit-${invoiceId}`} options={salespersonOptions(salespeople)} value={userId} onValueChange={setUserId} />
            <FieldError errors={[error ? { message: error } : undefined]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`credit-reason-${invoiceId}`}>Note (optional)</FieldLabel>
            <Textarea id={`credit-reason-${invoiceId}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Closed jointly; credit to the counselor who ran the calls" />
            <FieldDescription>Kept in the attribution history.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !userId}>
            {pending ? <Spinner /> : null} Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReviewProps {
  attributionId: string;
  invoiceId: string;
  /** e.g. "Phase A Sales for INV/2026-27/0001" */
  label: string;
  compact?: boolean;
}

export function ApproveAttributionButton({ attributionId, invoiceId, label, compact }: ReviewProps) {
  const [pending, startTransition] = useTransition();
  function approve() {
    startTransition(async () => {
      const result = await approveAttributionAction({ attributionId }, invoiceId);
      if (result.ok) toast.success("Sales credit approved");
      else toast.error(result.error);
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger render={compact ? <Button variant="ghost" size="icon-sm" aria-label="Approve attribution" disabled={pending} /> : <Button size="sm" disabled={pending} />}>
        {pending ? <Spinner /> : <BadgeCheck />}
        {compact ? null : " Approve"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve this sales credit?</AlertDialogTitle>
          <AlertDialogDescription>{label} will be recorded as the approved salesperson. This does not verify any payment; finance does that separately.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RejectAttributionDialog({ attributionId, invoiceId, label, compact }: ReviewProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await rejectAttributionAction({ attributionId, reason }, invoiceId);
      if (result.ok) {
        toast.success("Sales credit rejected; the salesperson can propose again");
        setOpen(false);
        setReason("");
      } else setError(result.fieldErrors?.reason?.[0] ?? result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={compact ? <Button variant="ghost" size="icon-sm" aria-label="Reject attribution" className="text-destructive hover:text-destructive" /> : <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" />}>
        <X />
        {compact ? null : " Reject"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject sales credit</DialogTitle>
          <DialogDescription>{label} will not be credited. The proposer is asked to try again with the right person.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`reject-${attributionId}`}>Reason</FieldLabel>
            <Textarea id={`reject-${attributionId}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The lead was handled by Priya, not Rahul" />
            <FieldError errors={[error ? { message: error } : undefined]} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || reason.trim().length < 3}>
            {pending ? <Spinner /> : null} Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReassignAttributionDialog({ attributionId, invoiceId, label, compact, salespeople, currentUserId }: ReviewProps & { salespeople: SalespersonOption[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const options = salespeople.filter((p) => p.id !== currentUserId);
  const [userId, setUserId] = useState(options[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reassignAttributionAction({ attributionId, creditedUserId: userId, reason }, invoiceId);
      if (result.ok) {
        toast.success("Sale reassigned and approved");
        setOpen(false);
        setReason("");
      } else setError(result.fieldErrors?.reason?.[0] ?? result.fieldErrors?.creditedUserId?.[0] ?? result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={compact ? <Button variant="ghost" size="icon-sm" aria-label="Reassign sale" /> : <Button variant="outline" size="sm" />}>
        <UserRoundPen />
        {compact ? null : " Reassign"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign this sale</DialogTitle>
          <DialogDescription>Currently {label}. The new owner is approved immediately and the previous owner stays in the history.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="my-4">
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`reassign-${attributionId}`}>Credit instead to</FieldLabel>
            <SelectField id={`reassign-${attributionId}`} options={salespersonOptions(options)} value={userId} onValueChange={setUserId} />
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`reassign-reason-${attributionId}`}>Reason</FieldLabel>
            <Textarea id={`reassign-reason-${attributionId}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <FieldError errors={[error ? { message: error } : undefined]} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !userId || reason.trim().length < 3}>
            {pending ? <Spinner /> : null} Reassign and approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
