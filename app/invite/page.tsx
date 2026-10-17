import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { describeRoles } from "@/lib/auth/permissions";
import { getInvitationByToken } from "@/lib/data/team";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * Landing page of the emailed invitation link. Shows who invited the person
 * and as what, then asks for a name and password. Signed-in users are asked
 * to sign out first: an account belongs to exactly one business.
 */
export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const [invitation, current] = await Promise.all([token ? getInvitationByToken(token) : Promise.resolve(null), getCurrentUser()]);

  const footer = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
        Sign in
      </Link>
    </>
  );

  if (!invitation) {
    return (
      <AuthShell title="This invitation cannot be used" description="The link is invalid, has expired or has already been used." footer={footer}>
        <p className="text-sm text-muted-foreground">Ask the admin who invited you to send a new invitation from their team settings.</p>
      </AuthShell>
    );
  }

  if (current) {
    return (
      <AuthShell title={`Join ${invitation.businessName}`} description="You are already signed in." footer={footer}>
        <p className="text-sm text-muted-foreground">
          You are signed in as <span className="font-medium text-foreground">{current.user.email}</span>. An account belongs to one business, so sign out first,
          then open this link again to create a new account for {invitation.email}.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invitation.businessName}`}
      description={`${invitation.invitedByName ? `${invitation.invitedByName} invited you` : "You were invited"} to join as ${describeRoles(invitation.roles)}. Choose a password to get started.`}
      footer={footer}
    >
      <AcceptInviteForm token={token} email={invitation.email} defaultName={invitation.name ?? ""} />
    </AuthShell>
  );
}
