import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AccountSettings } from "@/components/settings/account-settings";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { TeamSettings } from "@/components/settings/team-settings";
import { PageHeader } from "@/components/shared/page-header";
import { can, requireUser } from "@/lib/auth/current-user";
import { describeRoles } from "@/lib/auth/permissions";
import { listPendingInvitations, listTeamMembers } from "@/lib/data/team";
import { isEmailConfigured } from "@/lib/email/provider";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings is visible to every member: everyone can manage their own
 * account, while the business settings and the team are shown only to users
 * whose roles allow them (the actions behind them check again).
 */
export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const current = await requireUser();
  const { user, business } = current;
  const params = await searchParams;
  const welcome = params.welcome === "1";
  const manageSettings = can(current, "settings.manage");
  const manageTeam = can(current, "team.manage");
  const emailConfigured = isEmailConfigured();

  const [members, invitations] = manageTeam ? await Promise.all([listTeamMembers(business.id), listPendingInvitations(business.id)]) : [[], []];

  return (
    <>
      <PageHeader
        title={manageSettings ? "Business settings" : "Settings"}
        description={manageSettings ? "Your details, GST configuration and invoice defaults." : `Your account in ${business.name}. You are signed in as ${describeRoles(user.roles)}.`}
      />
      {welcome ? (
        <Alert>
          <Sparkles />
          <AlertTitle>Welcome! Let&apos;s set up your business.</AlertTitle>
          <AlertDescription>
            Fill in your address, enable GST if you are registered, and add your bank details so they appear on invoices. Then add your first client.
          </AlertDescription>
        </Alert>
      ) : null}
      {manageSettings && !emailConfigured ? (
        <Alert>
          <AlertTitle>Email delivery is in console mode</AlertTitle>
          <AlertDescription>
            Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">RESEND_API_KEY</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">EMAIL_FROM</code> in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> to deliver invoice emails. Until then they are printed to the server console.
          </AlertDescription>
        </Alert>
      ) : null}
      {manageSettings ? <BusinessSettingsForm business={business} razorpayConfigured={isRazorpayConfigured()} /> : null}

      {manageTeam ? (
        <section aria-labelledby="team-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="team-heading" className="text-xl font-semibold tracking-tight">
              Team
            </h2>
            <p className="text-sm text-muted-foreground">
              Who can sign in to {business.name} and what they may do. Invite colleagues by email and give each one or more roles.
            </p>
          </div>
          <TeamSettings currentUserId={user.id} members={members} invitations={invitations} emailConfigured={emailConfigured} />
        </section>
      ) : null}

      <section aria-labelledby="account-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="account-heading" className="text-xl font-semibold tracking-tight">
            Account
          </h2>
          <p className="text-sm text-muted-foreground">Your sign-in details. These are personal to you and are not shown on invoices.</p>
        </div>
        <AccountSettings user={{ name: user.name, email: user.email }} />
      </section>
    </>
  );
}
