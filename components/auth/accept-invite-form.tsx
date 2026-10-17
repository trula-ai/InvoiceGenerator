"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthMeter } from "@/components/auth/reset-password-form";
import { acceptInvitationAction } from "@/lib/actions/auth";
import { acceptInvitationFormSchema, type AcceptInvitationFormInput } from "@/lib/validation/team";

interface AcceptInviteFormProps {
  token: string;
  /** The invited address; fixed, since the invitation is for this person. */
  email: string;
  defaultName: string;
}

export function AcceptInviteForm({ token, email, defaultName }: AcceptInviteFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const form = useForm<AcceptInvitationFormInput>({
    resolver: zodResolver(acceptInvitationFormSchema),
    mode: "onTouched",
    defaultValues: { token, name: defaultName, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const busy = isSubmitting || (isSubmitSuccessful && !serverError);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await acceptInvitationAction({ token: values.token, name: values.name, password: values.password });
    if (result && !result.ok) {
      setServerError(result.error);
      if (result.fieldErrors?.token) setTokenInvalid(true);
    }
  });

  if (tokenInvalid) {
    return (
      <div className="flex flex-col gap-4">
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
        <Button nativeButton={false} render={<Link href="/login" />} variant="outline">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input id="invite-email" type="email" value={email} readOnly disabled />
          <FieldDescription>You will sign in with this address.</FieldDescription>
        </Field>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="invite-name">Your name</FieldLabel>
          <Input id="invite-name" autoComplete="name" autoFocus {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="invite-password">Password</FieldLabel>
          <PasswordInput id="invite-password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register("password")} />
          <PasswordStrengthMeter value={password} />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="invite-confirm">Confirm password</FieldLabel>
          <PasswordInput id="invite-confirm" autoComplete="new-password" {...form.register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>

        {serverError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Creating your account…
            </>
          ) : (
            <>
              Accept and continue <ArrowRight />
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
