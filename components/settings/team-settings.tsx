"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, MailPlus, RefreshCw, ShieldCheck, UserRoundX, Users, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction, setMemberDisabledAction, updateMemberRolesAction, type InvitationSent } from "@/lib/actions/team";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/auth/permissions";
import type { PendingInvitation, TeamMember } from "@/lib/data/team";
import { formatDate } from "@/lib/format";
import { inviteMemberSchema, memberRolesSchema, type InviteMemberInput, type MemberRolesInput } from "@/lib/validation/team";

interface TeamSettingsProps {
  currentUserId: string;
  members: TeamMember[];
  invitations: PendingInvitation[];
  /** False when email is in console mode, so invitations must be shared by link. */
  emailConfigured: boolean;
}

export function TeamSettings({ currentUserId, members, invitations, emailConfigured }: TeamSettingsProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <CardIcon icon={Users} />
            <div className="flex flex-col gap-1">
              <CardTitle>Members</CardTitle>
              <CardDescription>
                {members.length} member{members.length === 1 ? "" : "s"}. Admins can change roles and deactivate accounts; a business always keeps at least one admin.
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <InviteDialog emailConfigured={emailConfigured} />
          </CardAction>
        </CardHeader>
        <CardContent className="border-t px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Member</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3.5">
          <div className="flex items-start gap-3">
          <CardIcon icon={MailPlus} />
          <div className="flex flex-col gap-1">
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              {invitations.length === 0 ? "No open invitations." : `${invitations.length} waiting to be accepted. Links expire after 7 days; resend to issue a fresh one.`}
            </CardDescription>
          </div>
          </div>
        </CardHeader>
        {invitations.length > 0 ? (
          <CardContent className="border-t px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Invited</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="hidden md:table-cell">Expires</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <InvitationRow key={inv.id} invitation={inv} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function CardIcon({ icon: Icon }: { icon: typeof Users }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-4" />
    </span>
  );
}

function RoleBadges({ roles }: { roles: UserRole[] }) {
  if (roles.length === 0) return <span className="text-sm text-muted-foreground">No role</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {USER_ROLES.filter((r) => roles.includes(r)).map((r) => (
        <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
          {ROLE_LABELS[r]}
        </Badge>
      ))}
    </div>
  );
}

/** Checkbox list of every role; shared by the invite and edit-roles forms. */
function RolePicker({ value, onChange, idPrefix }: { value: UserRole[]; onChange: (roles: UserRole[]) => void; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-3">
      {USER_ROLES.map((role) => {
        const id = `${idPrefix}-${role}`;
        const checked = value.includes(role);
        return (
          <label key={role} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-primary/5">
            <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next ? [...value, role] : value.filter((r) => r !== role))} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
              <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Shows the result of sending an invitation, with a copyable link as the fallback. */
function describeDelivery(sent: InvitationSent, emailConfigured: boolean): { title: string; description: string; tone: "success" | "warning" } {
  if (sent.emailError) return { title: `Invitation created, but the email failed`, description: `${sent.emailError}. Copy the link below and share it with ${sent.email}.`, tone: "warning" };
  if (!emailConfigured || sent.provider === "console") {
    return { title: "Invitation created", description: `Email delivery is not set up, so nothing was sent. Copy the link below and share it with ${sent.email}.`, tone: "warning" };
  }
  return { title: "Invitation sent", description: `${sent.email} will receive an email with a link that expires in 7 days. You can also copy the link below.`, tone: "success" };
}

function InviteLink({ sent, emailConfigured }: { sent: InvitationSent; emailConfigured: boolean }) {
  const delivery = describeDelivery(sent, emailConfigured);
  async function copy() {
    try {
      await navigator.clipboard.writeText(sent.inviteUrl);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${delivery.tone === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
      <p className="font-medium">{delivery.title}</p>
      <p className="text-muted-foreground">{delivery.description}</p>
      <div className="flex items-center gap-2">
        <Input readOnly value={sent.inviteUrl} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" aria-label="Copy invitation link" onClick={copy}>
          <Copy />
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({ emailConfigured }: { emailConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<InvitationSent | null>(null);
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    mode: "onTouched",
    defaultValues: { email: "", name: "", roles: ["salesperson"] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await inviteMemberAction(values);
    if (result.ok) {
      setSent(result.data);
      form.reset({ email: "", name: "", roles: ["salesperson"] });
    } else {
      const emailError = result.fieldErrors?.email?.[0];
      if (emailError) form.setError("email", { type: "server", message: emailError });
      toast.error(result.error);
    }
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSent(null);
      form.reset({ email: "", name: "", roles: ["salesperson"] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <MailPlus /> Invite member
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>Share the link if the email does not arrive.</DialogDescription>
            </DialogHeader>
            <div className="my-4">
              <InviteLink sent={sent} emailConfigured={emailConfigured} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSent(null)}>
                Invite another
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>They will get an email with a link to choose a password. Pick the roles they should have.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="my-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input id="invite-email" type="email" autoComplete="off" placeholder="colleague@company.com" {...form.register("email")} />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="invite-name">Name (optional)</FieldLabel>
                  <Input id="invite-name" autoComplete="off" {...form.register("name")} />
                  <FieldError errors={[errors.name]} />
                </Field>
              </div>
              <Field data-invalid={!!errors.roles}>
                <FieldLabel>Roles</FieldLabel>
                <Controller control={form.control} name="roles" render={({ field }) => <RolePicker idPrefix="invite-role" value={(field.value ?? []) as UserRole[]} onChange={field.onChange} />} />
                <FieldDescription>Roles can be changed later from the members list.</FieldDescription>
                <FieldError errors={[errors.roles as { message?: string } | undefined]} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null} Send invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const disabled = !!member.disabledAt;

  function toggleDisabled() {
    startTransition(async () => {
      const result = await setMemberDisabledAction(member.id, !disabled);
      if (result.ok) toast.success(disabled ? `${member.name} can sign in again` : `${member.name} has been deactivated and signed out`);
      else toast.error(result.error);
    });
  }

  return (
    <TableRow className={disabled ? "opacity-60" : undefined}>
      <TableCell className="pl-4">
        <p className="font-medium">
          {member.name}
          {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{member.email}</p>
      </TableCell>
      <TableCell>
        <RoleBadges roles={member.roles} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {disabled ? <Badge variant="outline">Deactivated {formatDate(member.disabledAt)}</Badge> : <Badge variant="outline">Active</Badge>}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <EditRolesDialog member={member} />
          {!isSelf ? (
            disabled ? (
              <Button variant="ghost" size="sm" onClick={toggleDisabled} disabled={pending}>
                {pending ? <Spinner /> : <RefreshCw />} Reactivate
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Deactivate ${member.name}`} disabled={pending} />}>
                  <UserRoundX />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate {member.name}?</AlertDialogTitle>
                    <AlertDialogDescription>They will be signed out immediately and cannot sign in until reactivated. Their invoices, payments and history are kept.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={toggleDisabled}>
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditRolesDialog({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false);
  const form = useForm<MemberRolesInput>({
    resolver: zodResolver(memberRolesSchema),
    defaultValues: { userId: member.id, roles: member.roles },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateMemberRolesAction(values);
    if (result.ok) {
      toast.success(`Roles updated for ${member.name}`);
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) form.reset({ userId: member.id, roles: member.roles });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Change roles for ${member.name}`} />}>
        <ShieldCheck />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Roles for {member.name}</DialogTitle>
            <DialogDescription>Changes apply the next time they load a page.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <Field data-invalid={!!errors.roles}>
              <Controller control={form.control} name="roles" render={({ field }) => <RolePicker idPrefix={`roles-${member.id}`} value={(field.value ?? []) as UserRole[]} onChange={field.onChange} />} />
              <FieldError errors={[errors.roles as { message?: string } | undefined]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} Save roles
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<InvitationSent | null>(null);

  function resend() {
    startTransition(async () => {
      const result = await resendInvitationAction(invitation.id);
      if (result.ok) {
        setSent(result.data);
        toast.success(result.data.emailError ? "New link created; the email failed" : "Invitation resent");
      } else toast.error(result.error);
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeInvitationAction(invitation.id);
      if (result.ok) toast.success("Invitation revoked");
      else toast.error(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell className="pl-4">
        <p className="font-medium">{invitation.name ?? invitation.email}</p>
        {invitation.name ? <p className="text-xs text-muted-foreground">{invitation.email}</p> : null}
        {invitation.invitedByName ? <p className="text-xs text-muted-foreground">Invited by {invitation.invitedByName}</p> : null}
        {sent ? (
          <div className="mt-2">
            <InviteLink sent={sent} emailConfigured={sent.provider !== "console"} />
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <RoleBadges roles={invitation.roles} />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {invitation.expired ? <Badge variant="destructive">Expired</Badge> : <span className="text-sm text-muted-foreground">{formatDate(invitation.expiresAt)}</span>}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={resend} disabled={pending}>
            {pending ? <Spinner /> : <RefreshCw />} Resend
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Revoke invitation" onClick={revoke} disabled={pending}>
            <X />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
