import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/db/schema";

const STYLES: Record<PaymentStatus, { dot: string; label: string; className?: string }> = {
  pending: { dot: "bg-amber-500", label: "Pending verification" },
  verified: { dot: "bg-emerald-500", label: "Verified" },
  rejected: { dot: "bg-destructive", label: "Rejected", className: "text-muted-foreground" },
  reversed: { dot: "bg-destructive", label: "Reversed", className: "text-muted-foreground line-through" },
};

/** Verification state of one payment record. Safe in server and client components. */
export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", style.className, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </Badge>
  );
}
