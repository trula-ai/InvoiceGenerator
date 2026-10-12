import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RecurringActions } from "@/components/recurring/recurring-actions";
import type { InvoiceStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { calculateInvoice } from "@/lib/calculations";
import { getRecurringProfile, listGeneratedInvoices } from "@/lib/data/recurring";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { FREQUENCY_LABELS, RECURRING_STATUS_LABELS, describeSchedule } from "@/lib/recurring";

export const metadata: Metadata = { title: "Recurring schedule" };

const STATUS_VARIANT = { active: "default", paused: "secondary", ended: "outline" } as const;

export default async function RecurringDetailPage({ params }: PageProps<"/dashboard/recurring/[id]">) {
  const { business } = await requireUser();
  const { id } = await params;
  const [profile, generated] = await Promise.all([getRecurringProfile(business.id, id), listGeneratedInvoices(business.id, id)]);
  if (!profile) notFound();
  const t = profile.template;
  const totals = calculateInvoice({
    items: t.items,
    discountType: t.discountType,
    discountValue: t.discountValue,
    gstEnabled: business.gstEnabled,
    isInterState: business.gstEnabled && !!t.placeOfSupplyCode && t.placeOfSupplyCode !== business.stateCode,
    exchangeRate: "1",
    roundTotals: business.roundTotals,
  });

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
            <Badge variant={STATUS_VARIANT[profile.status]}>{RECURRING_STATUS_LABELS[profile.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{describeSchedule(profile, formatDate, formatDate(profile.startDate))}</p>
        </div>
        <RecurringActions id={profile.id} status={profile.status} />
      </div>

      {profile.lastError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Last run failed</CardTitle>
            <CardDescription>{profile.lastError}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Client" value={<Link href={`/dashboard/clients/${profile.clientId}`} className="hover:underline">{profile.clientName}</Link>} />
            <Row label="Repeats" value={FREQUENCY_LABELS[profile.frequency]} />
            <Row label="Next invoice" value={profile.status === "active" ? formatDate(profile.nextRunDate) : "—"} />
            <Row label="Ends" value={profile.endDate ? formatDate(profile.endDate) : profile.maxOccurrences ? `after ${profile.maxOccurrences} invoices` : "Never"} />
            <Row label="Generated so far" value={String(profile.occurrences)} />
            <Row label="Last run" value={profile.lastRunAt ? formatDateTime(profile.lastRunAt) : "—"} />
            <Row label="Auto-send" value={profile.autoSend ? (profile.clientEmail ? `Yes, to ${profile.clientEmail}` : "Yes, but the client has no email") : "No"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>Copied from {profile.sourceInvoiceNumber ?? "an invoice"}. Each generated invoice gets a fresh number, dates and exchange rate.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Tax %</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(item.unitPrice, t.currency)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{Number(item.taxRate).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(totals.items[i]?.lineSubtotal ?? "0", t.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
              <span>Total per invoice</span>
              <span className="tabular-nums">{formatCurrency(totals.total, t.currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated invoices</CardTitle>
          <CardDescription>{generated.length === 0 ? "Nothing generated yet." : `${generated.length} invoice${generated.length === 1 ? "" : "s"} created by this schedule.`}</CardDescription>
        </CardHeader>
        <CardContent>
          {generated.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" description="The first invoice is created on the start date, or press Generate now." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead className="hidden md:table-cell">Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generated.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total, inv.currency)}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status as InvoiceStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
