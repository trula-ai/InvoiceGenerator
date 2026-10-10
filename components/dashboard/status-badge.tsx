import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import type { DocumentKind, InvoiceStatus } from "@/db/schema";
import { statusLabel } from "@/lib/documents";

const dots: Record<InvoiceStatus, string> = {
  draft: "bg-muted-foreground/50",
  pending: "bg-amber-500",
  partially_paid: "bg-sky-500",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  cancelled: "bg-muted-foreground/30",
  accepted: "bg-emerald-500",
  declined: "bg-destructive",
  expired: "bg-muted-foreground/60",
  converted: "bg-sky-500",
};

interface StatusBadgeProps {
  status: InvoiceStatus;
  /** Words the label for the document kind ("Open" instead of "Pending" on a quote). */
  kind?: DocumentKind;
  className?: string;
}

export function StatusBadge({ status, kind = "invoice", className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", status === "cancelled" && "text-muted-foreground line-through", className)}>
      <span className={cn("size-1.5 rounded-full", dots[status])} aria-hidden />
      {statusLabel(status, kind)}
    </Badge>
  );
}
