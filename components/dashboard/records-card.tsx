import Link from "next/link";
import { FileText, Users, Wallet } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { BASE_CURRENCY } from "@/lib/currency";
import { formatCurrency, formatDate } from "@/lib/format";
import type { RecordsOverview } from "@/lib/types/dashboard";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

interface RecordsCardProps {
  records: RecordsOverview;
  className?: string;
}

const PANEL = "max-h-[26rem] overflow-y-auto rounded-lg ring-1 ring-foreground/10";

/**
 * One card that lists every client, invoice and payment, switchable by tab.
 * Rows link to their detail pages; the "Manage" button opens the full list
 * page for the active section.
 */
export function RecordsCard({ records, className }: RecordsCardProps) {
  const { clients, invoices, payments } = records;

  return (
    <Card className={cn("flex flex-col", className)}>
      <Tabs defaultValue="invoices" className="gap-0">
        <CardHeader>
          <CardTitle>All records</CardTitle>
          <CardDescription>Every client, invoice and payment in one place</CardDescription>
          <CardAction>
            <TabsList>
              <TabsTrigger value="clients">
                <Users /> Clients <Count value={clients.length} />
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <FileText /> Invoices <Count value={invoices.length} />
              </TabsTrigger>
              <TabsTrigger value="payments">
                <Wallet /> Payments <Count value={payments.length} />
              </TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-4">
          <TabsContent value="clients">
            {clients.length === 0 ? (
              <EmptyState icon={Users} title="No clients yet" description="Clients you add will appear here." />
            ) : (
              <div className={PANEL}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Invoices</TableHead>
                      <TableHead className="text-right">Invoiced ({BASE_CURRENCY})</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Link href={`/dashboard/clients/${client.id}`} className="font-medium hover:underline">
                            {client.name}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] uppercase">
                              {client.type}
                            </Badge>
                            {client.currency}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{client.email ?? "—"}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{client.invoiceCount}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(client.totalInvoicedInr, BASE_CURRENCY)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              Number(client.outstandingInr) > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                            }
                          >
                            {formatCurrency(client.outstandingInr, BASE_CURRENCY)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Footer href="/dashboard/clients" label="Manage clients" />
          </TabsContent>

          <TabsContent value="invoices">
            {invoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" description="Invoices you create will appear here." />
            ) : (
              <div className={PANEL}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="hidden sm:table-cell">Client</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/invoices/${invoice.id}`} className="hover:underline">
                            {invoice.number}
                          </Link>
                          <span className="block text-xs font-normal text-muted-foreground sm:hidden">{invoice.client}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{invoice.client}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(invoice.issuedAt)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Footer href="/dashboard/invoices" label="Manage invoices" />
          </TabsContent>

          <TabsContent value="payments">
            {payments.length === 0 ? (
              <EmptyState icon={Wallet} title="No payments yet" description="Payments recorded against invoices will appear here." />
            ) : (
              <div className={PANEL}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="hidden sm:table-cell">Client</TableHead>
                      <TableHead className="hidden md:table-cell">Invoice</TableHead>
                      <TableHead className="hidden lg:table-cell">Method</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.receiptNumber}
                          <span className="block text-xs font-normal text-muted-foreground sm:hidden">{payment.client}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{payment.client}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Link href={`/dashboard/invoices/${payment.invoiceId}`} className="hover:underline">
                            {payment.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(payment.paidAt)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(payment.amount, payment.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Footer href="/dashboard/payments" label="Manage payments" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-foreground/70">
      {value}
    </span>
  );
}

function Footer({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex justify-end pt-3">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
        {label}
      </Button>
    </div>
  );
}
