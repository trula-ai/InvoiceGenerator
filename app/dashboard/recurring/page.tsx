import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecurringActions } from "@/components/recurring/recurring-actions";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listRecurringProfiles } from "@/lib/data/recurring";
import { todayIso } from "@/lib/fiscal-year";
import { formatDate } from "@/lib/format";
import { FREQUENCY_LABELS, RECURRING_STATUS_LABELS } from "@/lib/recurring";

export const metadata: Metadata = { title: "Recurring invoices" };

const STATUS_VARIANT = { active: "default", paused: "secondary", ended: "outline" } as const;

export default async function RecurringPage() {
  const { business } = await requireUser();
  const profiles = await listRecurringProfiles(business.id);
  const today = todayIso();

  return (
    <>
      <PageHeader title="Recurring invoices" description="Schedules that generate and send invoices automatically. Create one from any issued invoice.">
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/invoices" />}>
          Pick an invoice to repeat
        </Button>
      </PageHeader>

      {profiles.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Repeat />
            </EmptyMedia>
            <EmptyTitle>No recurring schedules yet</EmptyTitle>
            <EmptyDescription>Open an issued invoice and choose &ldquo;Make recurring&rdquo; to bill the same lines weekly, monthly, quarterly or yearly.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/dashboard/invoices" />}>
              Go to invoices
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Repeats</TableHead>
                <TableHead>Next invoice</TableHead>
                <TableHead className="hidden lg:table-cell">Last invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/dashboard/recurring/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      From {p.sourceInvoiceNumber ?? "invoice"} · {p.occurrences} generated{p.autoSend ? " · auto-send" : ""}
                    </p>
                    {p.lastError ? <p className="text-xs text-destructive">Last run failed: {p.lastError}</p> : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.clientName}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{FREQUENCY_LABELS[p.frequency]}</TableCell>
                  <TableCell>
                    {p.status === "active" ? (
                      <span className={p.nextRunDate <= today ? "font-medium text-amber-600 dark:text-amber-400" : ""}>{formatDate(p.nextRunDate)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {p.lastInvoiceId && p.lastInvoiceNumber ? (
                      <Link href={`/dashboard/invoices/${p.lastInvoiceId}`} className="hover:underline">
                        {p.lastInvoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status]}>{RECURRING_STATUS_LABELS[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <RecurringActions id={p.id} status={p.status} compact />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
