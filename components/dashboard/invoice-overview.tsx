import { cn } from "cn";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { InvoiceStats } from "@/lib/types/dashboard";

const rows: {
  key: Exclude<keyof InvoiceStats, "total">;
  label: string;
  dot: string;
  indicator: string;
}[] = [
  { key: "paid", label: "Paid", dot: "bg-emerald-500", indicator: "[&_[data-slot=progress-indicator]]:bg-emerald-500" },
  { key: "pending", label: "Pending", dot: "bg-amber-500", indicator: "[&_[data-slot=progress-indicator]]:bg-amber-500" },
  { key: "overdue", label: "Overdue", dot: "bg-destructive", indicator: "[&_[data-slot=progress-indicator]]:bg-destructive" },
  { key: "draft", label: "Draft", dot: "bg-muted-foreground/50", indicator: "[&_[data-slot=progress-indicator]]:bg-muted-foreground/50" },
];

interface InvoiceOverviewProps {
  stats: InvoiceStats;
  className?: string;
}

export function InvoiceOverview({ stats, className }: InvoiceOverviewProps) {
  const share = (count: number) => (stats.total === 0 ? 0 : Math.round((count / stats.total) * 100));

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Invoice status</CardTitle>
        <CardDescription>Breakdown of all invoices this year</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{stats.total}</span>
          <span className="text-sm text-muted-foreground">total invoices</span>
        </div>

        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const count = stats[row.key];
            const percent = share(count);
            return (
              <li key={row.key}>
                <Progress value={percent} className={cn("gap-2", row.indicator)}>
                  <ProgressLabel className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-2 rounded-full", row.dot)} aria-hidden />
                    {row.label}
                  </ProgressLabel>
                  <span className="ml-auto text-sm tabular-nums">
                    <span className="font-medium text-foreground">{count}</span>
                    <span className="text-muted-foreground"> ({percent}%)</span>
                  </span>
                </Progress>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
