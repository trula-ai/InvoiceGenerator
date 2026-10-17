import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewScheduleCard } from "@/components/scheduled/new-schedule-card";
import { RecurringActions } from "@/components/scheduled/recurring-actions";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listInvoicePickerOptions } from "@/lib/data/invoice-picker";
import { listRecurringProfiles } from "@/lib/data/recurring";
import { todayIso } from "@/lib/fiscal-year";
import { formatDate } from "@/lib/format";
import { FREQUENCY_LABELS, RECURRING_STATUS_LABELS } from "@/lib/recurring";

export const metadata: Metadata = { title: "Scheduled invoices" };

const STATUS_VARIANT = { active: "default", paused: "secondary", ended: "outline" } as const;

export default async function RecurringPage({ searchParams }: PageProps<"/dashboard/scheduled">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const preselectedId = typeof params.invoice === "string" ? params.invoice : undefined;
  const [profiles, invoiceOptions] = await Promise.all([listRecurringProfiles(business.id), listInvoicePickerOptions(business.id)]);
  const today = todayIso();

  return (
    <>
      <PageHeader title="Scheduled invoices" description="Schedules that generate and send invoices automatically. Create one from any issued invoice." />

      <NewScheduleCard key={preselectedId ?? "none"} options={invoiceOptions} preselectedId={preselectedId} />

      {profiles.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Repeat />
            </EmptyMedia>
            <EmptyTitle>No scheduled invoices yet</EmptyTitle>
            <EmptyDescription>Use &ldquo;New schedule&rdquo; above to pick any issued invoice and bill the same lines weekly, monthly, quarterly or yearly.</EmptyDescription>
          </EmptyHeader>
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
                    <Link href={`/dashboard/scheduled/${p.id}`} className="font-medium hover:underline">
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
