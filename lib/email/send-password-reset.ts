import { render } from "@react-email/components";
import { createElement } from "react";

import { appConfig } from "@/lib/config";
import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/data/password-reset";

import { getEmailProvider, type EmailSendResult } from "./provider";
import { PasswordResetEmail, passwordResetEmailText, type PasswordResetEmailProps } from "./templates/password-reset-email";

export interface SendPasswordResetOptions {
  to: string;
  name: string;
  /** Raw (unhashed) token from `createPasswordResetToken`. */
  token: string;
}

/** Absolute URL of the reset page for a given raw token. */
export function passwordResetUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Renders and sends the password reset email through the configured provider.
 * Not recorded in `email_logs`: that table is the per-business invoice audit
 * trail and this is an account email.
 */
export async function sendPasswordResetEmail({ to, name, token }: SendPasswordResetOptions): Promise<EmailSendResult> {
  const props: PasswordResetEmailProps = {
    appName: appConfig.name,
    name: name.trim() || "there",
    resetUrl: passwordResetUrl(token),
    expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
  };

  const html = await render(createElement(PasswordResetEmail, props));

  return getEmailProvider().send({
    to: to.trim().toLowerCase(),
    subject: `Reset your ${appConfig.name} password`,
    html,
    text: passwordResetEmailText(props),
  });
}
