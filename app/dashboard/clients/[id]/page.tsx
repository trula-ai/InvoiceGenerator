import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { SendStatementDialog } from "@/components/clients/send-statement-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmailDialog } from "@/components/invoices/invoice-actions";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getClient, getClientInvoiceHistory } from "@/lib/data/clients";
import { PAYABLE_STATUSES } from "@/lib/data/invoices";
import { BASE_CURRENCY } from "@/lib/currency";
import { documentLabel, documentPath } from "@/lib/documents";
import { isEmailConfigured } from "@/lib/email/provider";
import { formatCurrency, formatDate } from "@/lib/format";
import { D, toMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { business } = await requireUser();
  const { id } = await params;
  const [client, history] = await Promise.all([getClient(business.id, id), getClientInvoiceHistory(business.id, id)]);
  if (!client) notFound();

  const emailConfigured = isEmailConfigured();
  const issued = history.filter((i) => i.documentKind === "invoice" && !["draft", "cancelled"].includes(i.status));
  const outstandingInvoices = issued.filter((i) => PAYABLE_STATUSES.includes(i.status) && Number(i.balanceDue) > 0);
  const totalInr = toMoney(issued.reduce((acc, i) => acc.plus(D(i.totalInr)), D(0)));
  const outstandingInr = toMoney(
    issued
      .filter((i) => i.status !== "paid")
      .reduce((acc, i) => acc.plus(D(i.balanceDue).times(D(i.exchangeRate))), D(0)),
  );
  const address = [client.addressLine1, client.addressLine2, [client.city, client.state, client.postalCode].filter(Boolean).join(", "), client.country].filter(Boolean);

  return (
    <>
      <PageHeader title={client.name} description={client.contactName ? `Contact: ${client.contactName}` : undefined}>
        <ArchiveClientButton clientId={client.id} archived={!!client.archivedAt} />
        <SendStatementDialog
          clientId={client.id}
          clientName={client.name}
          clientEmail={client.email}
          hasOutstanding={outstandingInvoices.length > 0}
          outstandingLabel={
            outstandingInvoices.length
              ? `${outstandingInvoices.length} invoice${outstandingInvoices.length === 1 ? "" : "s"}, ${formatCurrency(outstandingInr, BASE_CURRENCY)} outstanding`
              : undefined
          }
          emailConfigured={emailConfigured}
        />
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/clients/${client.id}/edit`} />}>
          <Pencil /> Edit
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotes/new?client=${client.id}`} />}>
          <Plus /> New quote
        </Button>
        <Button nativeButton={false} render={<Link href={`/dashboard/invoices/new?client=${client.id}`} />}>
          <Plus /> New invoice
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase">
                {client.type}
              </Badge>
              <Badge variant="outline">{client.currency}</Badge>
              {client.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
            </div>
            <dl className="grid gap-2">
              <Row label="Email" value={client.email} />
              <Row label="Phone" value={client.phone} />
              <Row label="GSTIN" value={client.gstin} mono />
              <Row label="Address" value={address.length ? address.join("\n") : null} pre />
              {client.shippingAddress ? <Row label="Ship to" value={client.shippingAddress} pre /> : null}
              <Row label="Reminders" value={client.autoReminders ? "Automatic reminders on" : "Automatic reminders off (manual only)"} />
              <Row label="Notes" value={client.notes} pre />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {issued.length} invoice{issued.length === 1 ? "" : "s"} issued · {formatCurrency(totalInr, BASE_CURRENCY)} invoiced ·{" "}
              <span className={Number(outstandingInr) > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                {formatCurrency(outstandingInr, BASE_CURRENCY)} outstanding
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" description="Create the first invoice for this client." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="hidden sm:table-cell">Issued</TableHead>
                    <TableHead className="hidden md:table-cell">Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Send reminder</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((inv) => {
                    const payable = inv.documentKind === "invoice" && PAYABLE_STATUSES.includes(inv.status) && Number(inv.balanceDue) > 0;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          <Link href={documentPath(inv.documentKind, inv.id)} className="hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                          {inv.documentKind !== "invoice" ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{documentLabel(inv.documentKind)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(inv.issueDate)}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {formatDate(inv.dueDate)}
                          {inv.lastReminderAt && payable ? (
                            <span className="block text-xs text-muted-foreground/80">Reminded {formatDate(inv.lastReminderAt)}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total, inv.currency)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {inv.documentKind === "invoice" ? formatCurrency(inv.balanceDue, inv.currency) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inv.status} kind={inv.documentKind} />
                        </TableCell>
                        <TableCell className="text-right">
                          {payable ? (
                            <EmailDialog
                              compact
                              kind="reminder"
                              invoiceId={inv.id}
                              clientEmail={client.email}
                              emailConfigured={emailConfigured}
                              overdue={inv.status === "overdue"}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, mono, pre }: { label: string; value: string | null | undefined; mono?: boolean; pre?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={[mono ? "font-mono text-xs" : "", pre ? "whitespace-pre-line" : ""].join(" ")}>{value || "—"}</dd>
    </div>
  );
}
