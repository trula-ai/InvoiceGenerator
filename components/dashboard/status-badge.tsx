import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/db/schema";
import { INVOICE_STATUS_LABELS } from "@/lib/format";

const dots: Record<InvoiceStatus, string> = {
  draft: "bg-muted-foreground/50",
  pending: "bg-amber-500",
  partially_paid: "bg-sky-500",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  cancelled: "bg-muted-foreground/30",
};

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", status === "cancelled" && "text-muted-foreground line-through", className)}>
      <span className={cn("size-1.5 rounded-full", dots[status])} aria-hidden />
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
