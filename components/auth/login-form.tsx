"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface LoginFormProps {
  next?: string;
  /** Cloudflare Turnstile site key; the challenge is skipped when absent. */
  turnstileSiteKey?: string;
}

export function LoginForm({ next, turnstileSiteKey }: LoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const captcha = !!turnstileSiteKey;

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const email = useWatch({ control: form.control, name: "email" }) ?? "";
  const emailLooksValid = EMAIL_OK.test(email.trim());
  const busy = isSubmitting || (isSubmitSuccessful && !serverError);
  const waitingForCaptcha = captcha && !turnstileToken;

  const onToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
    if (token) setTurnstileError(null);
  }, []);
  const onTurnstileError = useCallback((code: string) => setTurnstileError(code), []);

  const onSubmit = form.handleSubmit(async (values) => {
    if (waitingForCaptcha) {
      setServerError("Please complete the human verification to sign in.");
      return;
    }
    setServerError(null);
    const result = await loginAction({ ...values, turnstileToken: turnstileToken ?? undefined }, next);
    if (result && !result.ok) {
      setServerError(result.error);
      setShake(true);
      // Turnstile tokens are single-use: ask for a fresh challenge before the next attempt.
      if (captcha) setTurnstileReset((n) => n + 1);
      form.setFocus("password");
    }
  });

  function trackCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn(shake && "motion-safe:animate-[auth-shake_0.4s_ease-in-out]")} onAnimationEnd={() => setShake(false)}>
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <div className="relative">
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@company.com" className="pr-9" {...form.register("email")} />
            <CheckCircle2
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-emerald-500 transition-all duration-200",
                emailLooksValid && !errors.email ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
            />
          </div>
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline" tabIndex={-1}>
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...form.register("password")}
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={(e) => {
              setCapsLock(false);
              void form.register("password").onBlur(e);
            }}
          />
          {capsLock ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 animate-in fade-in-0 slide-in-from-top-1 dark:text-amber-400" aria-live="polite">
              <KeyRound className="size-3.5" /> Caps Lock is on
            </p>
          ) : null}
          <FieldError errors={[errors.password]} />
        </Field>

        {turnstileSiteKey ? (
          <Field data-invalid={!!turnstileError}>
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={onToken} onError={onTurnstileError} resetSignal={turnstileReset} action="login" className="min-h-16" />
            {turnstileError ? (
              <p className="text-xs text-destructive" role="alert">
                Human verification could not load (Cloudflare error {turnstileError}).
                {turnstileError === "110200" ? " This hostname is not allowed for the Turnstile widget; add it in the Cloudflare dashboard." : " Reload the page to try again."}
              </p>
            ) : null}
          </Field>
        ) : null}

        {serverError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <Button type="submit" className="group w-full" size="lg" disabled={busy || waitingForCaptcha} title={waitingForCaptcha ? "Complete the verification first" : undefined}>
          {busy ? (
            <>
              <Spinner /> {isSubmitSuccessful ? "Signed in, taking you to your dashboard…" : "Signing in…"}
            </>
          ) : (
            <>
              Sign in <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {waitingForCaptcha ? (
            "Waiting for the human verification…"
          ) : (
            <>
              Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to sign in
            </>
          )}
        </p>
      </FieldGroup>
    </form>
  );
}
