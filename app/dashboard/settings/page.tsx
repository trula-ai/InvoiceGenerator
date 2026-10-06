import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AccountSettings } from "@/components/settings/account-settings";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { isEmailConfigured } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const { user, business } = await requireUser();
  const params = await searchParams;
  const welcome = params.welcome === "1";

  return (
    <>
      <PageHeader title="Business settings" description="Your details, GST configuration and invoice defaults." />
      {welcome ? (
        <Alert>
          <Sparkles />
          <AlertTitle>Welcome! Let&apos;s set up your business.</AlertTitle>
          <AlertDescription>
            Fill in your address, enable GST if you are registered, and add your bank details so they appear on invoices. Then add your first client.
          </AlertDescription>
        </Alert>
      ) : null}
      {!isEmailConfigured() ? (
        <Alert>
          <AlertTitle>Email delivery is in console mode</AlertTitle>
          <AlertDescription>
            Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">RESEND_API_KEY</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">EMAIL_FROM</code> in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> to deliver invoice emails. Until then they are printed to the server console.
          </AlertDescription>
        </Alert>
      ) : null}
      <BusinessSettingsForm business={business} />

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
