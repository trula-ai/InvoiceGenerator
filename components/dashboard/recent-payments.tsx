import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn } from "cn";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { RecentPayment } from "@/lib/types/dashboard";
import { formatCurrency, formatDate, getInitials } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

interface RecentPaymentsProps {
  payments: RecentPayment[];
  className?: string;
}

export function RecentPayments({ payments, className }: RecentPaymentsProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Recent payments</CardTitle>
        <CardDescription>Payments received against your invoices</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/payments" />}>
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {payments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Payments recorded against invoices will appear here." />
        ) : (
          <ul className="divide-y">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar>
                  <AvatarFallback>{getInitials(payment.client)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{payment.client}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payment.invoiceNumber} · {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(payment.amount, payment.currency)}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
