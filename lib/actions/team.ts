"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorize } from "@/lib/auth/current-user";
import { createInvitation, refreshInvitation, revokeInvitation, setMemberDisabled, updateMemberRoles, type CreatedInvitation } from "@/lib/data/team";
import { getEmailProvider } from "@/lib/email/provider";
import { invitationUrl, sendInvitationEmail } from "@/lib/email/send-invitation";
import type { ActionResult } from "@/lib/validation/common";
import { inviteMemberSchema, memberRolesSchema, type InviteMemberInput, type MemberRolesInput } from "@/lib/validation/team";

import { failure, validationFailure } from "./utils";

function revalidateTeam() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}

export interface InvitationSent {
  email: string;
  /** Link the admin can copy and share, for when email delivery is not set up. */
  inviteUrl: string;
  /** Null when the provider accepted the email; otherwise why it did not. */
  emailError: string | null;
  /** Which provider handled it ("smtp", "resend" or "console", which only prints to the server log). */
  provider: string;
}

/** Emails the invitation and reports delivery, without ever failing the invitation itself. */
async function deliver(invitation: CreatedInvitation, businessName: string, inviterName: string): Promise<InvitationSent> {
  const inviteUrl = invitationUrl(invitation.token);
  const provider = getEmailProvider().name;
  try {
    await sendInvitationEmail({
      to: invitation.email,
      name: invitation.name,
      roles: invitation.roles,
      businessName,
      inviterName,
      token: invitation.token,
    });
    return { email: invitation.email, inviteUrl, emailError: null, provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[team] invitation email failed:", message);
    return { email: invitation.email, inviteUrl, emailError: message, provider };
  }
}

/** Admin invites a colleague. The invitation is created even when the email cannot be delivered. */
export async function inviteMemberAction(input: InviteMemberInput): Promise<ActionResult<InvitationSent>> {
  const auth = await authorize("team.manage");
  if (!auth.ok) return auth;
  const { user, business } = auth.current;
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let invitation: CreatedInvitation;
  try {
    invitation = await createInvitation(business.id, user.id, parsed.data);
  } catch (error) {
    return failure(error, "Could not create the invitation.");
  }

  const sent = await deliver(invitation, business.name, user.name);
  revalidateTeam();
  return { ok: true, data: sent };
}

/** Issues a fresh link for an open invitation and emails it again. */
export async function resendInvitationAction(invitationId: string): Promise<ActionResult<InvitationSent>> {
  const auth = await authorize("team.manage");
  if (!auth.ok) return auth;
  const { user, business } = auth.current;
  if (!z.uuid().safeParse(invitationId).success) return { ok: false, error: "Invalid invitation." };

  let invitation: CreatedInvitation;
  try {
    invitation = await refreshInvitation(business.id, invitationId);
  } catch (error) {
    return failure(error, "Could not resend the invitation.");
  }

  const sent = await deliver(invitation, business.name, user.name);
  revalidateTeam();
  return { ok: true, data: sent };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const auth = await authorize("team.manage");
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(invitationId).success) return { ok: false, error: "Invalid invitation." };

  try {
    await revokeInvitation(auth.current.business.id, invitationId);
  } catch (error) {
    return failure(error, "Could not revoke the invitation.");
  }
  revalidateTeam();
  return { ok: true, data: undefined };
}

export async function updateMemberRolesAction(input: MemberRolesInput): Promise<ActionResult> {
  const auth = await authorize("team.manage");
  if (!auth.ok) return auth;
  const parsed = memberRolesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateMemberRoles(auth.current.business.id, parsed.data.userId, parsed.data.roles);
  } catch (error) {
    return failure(error, "Could not update the member's roles.");
  }
  revalidateTeam();
  return { ok: true, data: undefined };
}

export async function setMemberDisabledAction(userId: string, disabled: boolean): Promise<ActionResult> {
  const auth = await authorize("team.manage");
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Invalid member." };

  try {
    await setMemberDisabled(auth.current.business.id, auth.current.user.id, userId, disabled === true);
  } catch (error) {
    return failure(error, disabled ? "Could not deactivate the member." : "Could not reactivate the member.");
  }
  revalidateTeam();
  return { ok: true, data: undefined };
}
