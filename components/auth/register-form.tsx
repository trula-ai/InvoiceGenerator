"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { registerAction } from "@/lib/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

/** 0-4 strength score from simple, transparent rules. */
function passwordStrength(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  const label = value.length === 0 ? "" : score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  return { score, label };
}

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { businessName: "", name: "", email: "", password: "" },
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const strength = passwordStrength(password);
  const busy = isSubmitting || (isSubmitSuccessful && !serverError);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await registerAction(values);
    if (result && !result.ok) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.businessName}>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input id="businessName" autoComplete="organization" autoFocus placeholder="Acme Traders" {...form.register("businessName")} />
          <FieldDescription>You can add GST details and your address in Settings afterwards.</FieldDescription>
          <FieldError errors={[errors.businessName]} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoComplete="name" {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register("password")} />
          {password ? (
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
          ) : (
            <FieldDescription>Use 8+ characters with a mix of letters and numbers.</FieldDescription>
          )}
          <FieldError errors={[errors.password]} />
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
              Create account <ArrowRight />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">By continuing you agree to keep your login details private.</p>
      </FieldGroup>
    </form>
  );
}
