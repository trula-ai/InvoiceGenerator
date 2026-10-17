import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/current-user";
import { describeRoles } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Access denied" };

/** Shown by `requirePermission` when a signed-in user opens a page their roles do not allow. */
export default async function AccessDeniedPage({ searchParams }: PageProps<"/dashboard/access-denied">) {
  const { user } = await requireUser();
  const params = await searchParams;
  const need = typeof params.need === "string" ? params.need : null;

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>You do not have access to that page</EmptyTitle>
        <EmptyDescription>
          Your role{user.roles.length === 1 ? " is" : "s are"} {describeRoles(user.roles)}.{need ? ` This page needs the "${need}" permission.` : ""} Ask an admin of your business to change
          your role if you need it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </EmptyContent>
    </Empty>
  );
}
