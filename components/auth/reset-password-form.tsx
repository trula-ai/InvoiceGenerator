"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert, LinkIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { resetPasswordAction } from "@/lib/actions/auth";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/lib/validation/auth";

/** 0-4 strength score from simple, transparent rules (mirrors register-form.tsx). */
export function passwordStrength(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  const label = value.length === 0 ? "" : score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  return { score, label };
}

/**
 * Four-segment strength bar shown under a new-password field. Renders the
 * fallback hint while the field is empty so the layout does not jump.
 */
export function PasswordStrengthMeter({ value }: { value: string }) {
  const strength = passwordStrength(value);
  if (!value) return <FieldDescription>Use 8+ characters with a mix of letters and numbers.</FieldDescription>;
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors",
              step <= strength.score && (strength.score <= 1 ? "bg-destructive" : strength.score === 2 ? "bg-amber-500" : "bg-emerald-500"),
            )}
          />
        ))}
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">{strength.label}</span>
    </div>
  );
}

function InvalidLinkState() {
  return (
    <div className="flex flex-col items-center gap-4 text-center animate-in fade-in-0 slide-in-from-bottom-1" role="alert">
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <LinkIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">This link can&apos;t be used</p>
        <p className="text-sm text-muted-foreground">
          The reset link is missing, has expired or has already been used. Links are valid for 60 minutes and work only once.
        </p>
      </div>
      <Button className="w-full" size="lg" nativeButton={false} render={<Link href="/forgot-password" />}>
        Request a new link <ArrowRight />
      </Button>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(!token);
  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onTouched",
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const busy = isSubmitting || (isSubmitSuccessful && !serverError && !tokenInvalid);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await resetPasswordAction({ token: values.token, password: values.password });
    if (result && !result.ok) {
      if (result.fieldErrors?.token) setTokenInvalid(true);
      else setServerError(result.error);
    }
  });

  if (tokenInvalid) return <InvalidLinkState />;

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" {...form.register("token")} />
      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" autoFocus placeholder="At least 8 characters" {...form.register("password")} />
          <PasswordStrengthMeter value={password} />
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <PasswordInput id="confirmPassword" autoComplete="new-password" placeholder="Repeat your new password" {...form.register("confirmPassword")} />
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
              <Spinner /> Updating password…
            </>
          ) : (
            <>
              Set new password <ArrowRight />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">You&apos;ll be signed out of every other device and signed in here.</p>
      </FieldGroup>
    </form>
  );
}
