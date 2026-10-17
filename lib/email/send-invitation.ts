import { render } from "@react-email/components";
import { createElement } from "react";

import { describeRoles, type UserRole } from "@/lib/auth/permissions";
import { appConfig } from "@/lib/config";
import { INVITATION_TTL_DAYS } from "@/lib/data/team";

import { getEmailProvider, type EmailSendResult } from "./provider";
import { InvitationEmail, invitationEmailText, type InvitationEmailProps } from "./templates/invitation-email";
import { appBaseUrl } from "./urls";

export interface SendInvitationOptions {
  to: string;
  name: string | null;
  roles: UserRole[];
  businessName: string;
  inviterName: string | null;
  /** Raw (unhashed) token from `createInvitation` / `refreshInvitation`. */
  token: string;
}

/** Absolute URL of the accept page for a given raw token. */
export function invitationUrl(token: string): string {
  return `${appBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
}

/**
 * Renders and sends the invitation email through the configured provider.
 * Not recorded in `email_logs`: that table is the per-business invoice audit
 * trail and this is an account email.
 */
export async function sendInvitationEmail(options: SendInvitationOptions): Promise<EmailSendResult> {
  const props: InvitationEmailProps = {
    appName: appConfig.name,
    businessName: options.businessName,
    inviterName: options.inviterName,
    name: options.name,
    rolesLabel: describeRoles(options.roles),
    acceptUrl: invitationUrl(options.token),
    expiresInDays: INVITATION_TTL_DAYS,
  };

  const html = await render(createElement(InvitationEmail, props));

  return getEmailProvider().send({
    to: options.to.trim().toLowerCase(),
    subject: `${options.inviterName ? `${options.inviterName} invited you` : "You are invited"} to join ${options.businessName} on ${appConfig.name}`,
    html,
    text: invitationEmailText(props),
  });
}
