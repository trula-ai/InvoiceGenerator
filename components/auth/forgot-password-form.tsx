"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await requestPasswordResetAction(values);
    if (result.ok) setSent(true);
    else setServerError(result.error);
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center animate-in fade-in-0 slide-in-from-bottom-1" role="status" aria-live="polite">
        <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <MailCheck className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted-foreground">If an account exists for that email, we&apos;ve sent a link. It expires in 60 minutes.</p>
        </div>
        <p className="text-xs text-muted-foreground">Didn&apos;t get it? Check your spam folder, or try again in a few minutes.</p>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...form.register("email")} />
          <FieldDescription>We&apos;ll email you a link to choose a new password.</FieldDescription>
          <FieldError errors={[errors.email]} />
        </Field>

        {serverError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner /> Sending link…
            </>
          ) : (
            <>
              Send reset link <ArrowRight />
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
