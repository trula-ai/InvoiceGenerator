"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/reset-password-form";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/account";
import { changePasswordSchema, profileSchema, type ChangePasswordInput, type ProfileInput } from "@/lib/validation/account";
import type { ActionResult } from "@/lib/validation/common";

interface AccountSettingsProps {
  user: { name: string; email: string };
}

/** Copies server-side field errors onto the matching react-hook-form fields. */
function applyFieldErrors<T extends Record<string, unknown>>(
  result: Extract<ActionResult, { ok: false }>,
  setError: (name: keyof T & string, error: { type: string; message: string }) => void,
  fields: readonly (keyof T & string)[],
) {
  for (const field of fields) {
    const message = result.fieldErrors?.[field]?.[0];
    if (message) setError(field, { type: "server", message });
  }
}

export function AccountSettings({ user }: AccountSettingsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard user={user} />
      <ChangePasswordCard />
    </div>
  );
}

function CardIcon({ icon: Icon }: { icon: typeof UserRound }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-4" />
    </span>
  );
}

function ProfileCard({ user }: AccountSettingsProps) {
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
    defaultValues: { name: user.name, email: user.email },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateProfileAction(values);
    if (result.ok) {
      toast.success("Profile updated");
      form.reset(values);
      return;
    }
    applyFieldErrors<ProfileInput>(result, form.setError, ["name", "email"]);
    toast.error(result.error);
  });

  return (
    <Card className="gap-0 py-0">
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <CardHeader className="flex-row items-start gap-3 px-4 py-3.5">
          <CardIcon icon={UserRound} />
          <div className="flex flex-col gap-1">
            <CardTitle>Your profile</CardTitle>
            <CardDescription>The name and email you sign in with. Not printed on invoices.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="border-t px-4 py-5">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="account-name">Name</FieldLabel>
              <Input id="account-name" autoComplete="name" {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="account-email">Email</FieldLabel>
              <Input id="account-email" type="email" autoComplete="email" {...form.register("email")} />
              <FieldDescription>Used to sign in and to receive password reset links.</FieldDescription>
              <FieldError errors={[errors.email]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Spinner /> : null} Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ChangePasswordCard() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" }) ?? "";

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await changePasswordAction(values);
    if (result.ok) {
      form.reset();
      toast.success("Password updated. Other devices have been signed out.");
      return;
    }
    applyFieldErrors<ChangePasswordInput>(result, form.setError, ["currentPassword", "newPassword", "confirmPassword"]);
    if (result.fieldErrors?.currentPassword) form.setFocus("currentPassword");
    toast.error(result.error);
  });

  return (
    <Card className="gap-0 py-0">
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <CardHeader className="flex-row items-start gap-3 px-4 py-3.5">
          <CardIcon icon={KeyRound} />
          <div className="flex flex-col gap-1">
            <CardTitle>Change password</CardTitle>
            <CardDescription>Choosing a new password signs you out everywhere except this device.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="border-t px-4 py-5">
          <FieldGroup>
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <PasswordInput id="currentPassword" autoComplete="current-password" {...form.register("currentPassword")} />
              <FieldError errors={[errors.currentPassword]} />
            </Field>
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <PasswordInput id="newPassword" autoComplete="new-password" placeholder="At least 8 characters" {...form.register("newPassword")} />
              <PasswordStrengthMeter value={newPassword} />
              <FieldError errors={[errors.newPassword]} />
            </Field>
            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null} Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
