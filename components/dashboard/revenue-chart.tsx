import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RevenuePoint, RevenueSummary } from "@/lib/types/dashboard";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";

interface RevenueChartProps {
  data: RevenuePoint[];
  summary: RevenueSummary;
  currency: string;
  className?: string;
}

/** Rounds a chart maximum up to a "nice" axis ceiling (1, 2, 2.5 or 5 times a power of ten). */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Pure CSS bar chart (no charting dependency). Renders invoiced vs. collected
 * revenue per month with hover tooltips. Data is passed in; nothing is fetched.
 */
export function RevenueChart({ data, summary, currency, className }: RevenueChartProps) {
  // Display-only scaling; amounts may be numeric strings from PostgreSQL.
  const maxValue = Math.max(0, ...data.map((d) => Math.max(Number(d.invoiced), Number(d.collected))));
  const axisMax = niceCeiling(maxValue);
  const toPercent = (value: RevenuePoint["invoiced"]) => `${(Number(value) / axisMax) * 100}%`;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Revenue overview</CardTitle>
        <CardDescription>Invoiced vs. collected, last 12 months</CardDescription>
        <CardAction>
          <ul className="flex items-center gap-4 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden />
              Invoiced
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
              Collected
            </li>
          </ul>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Total invoiced</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(summary.totalInvoiced, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total collected</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(summary.totalCollected, currency)}
            </p>
          </div>
          {summary.change !== undefined ? (
            <Badge
              variant="outline"
              className={cn(
                "mb-1 gap-1",
                summary.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {formatPercent(summary.change)}
              <span className="font-normal text-muted-foreground">{summary.changeLabel}</span>
            </Badge>
          ) : null}
        </div>

        <figure className="flex gap-3" aria-label="Monthly revenue bar chart">
          <div className="relative h-56 w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
            {TICKS.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 leading-none"
                style={{ bottom: `${tick * 100}%` }}
              >
                {formatCompactCurrency(tick * axisMax, currency)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-56">
              {TICKS.map((tick) => (
                <div
                  key={tick}
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 border-t",
                    tick === 0 ? "border-border" : "border-dashed border-border/60",
                  )}
                  style={{ bottom: `${tick * 100}%` }}
                />
              ))}

              <ol className="absolute inset-0 flex items-end justify-between gap-1 sm:gap-2">
                {data.map((point) => (
                  <li
                    key={point.month}
                    className="group relative flex h-full flex-1 items-end justify-center gap-0.5 sm:gap-1"
                  >
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                    >
                      <p className="mb-1 font-medium">{point.month}</p>
                      <p className="flex justify-between gap-3 text-muted-foreground">
                        Invoiced
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCurrency(point.invoiced, currency)}
                        </span>
                      </p>
                      <p className="flex justify-between gap-3 text-muted-foreground">
                        Collected
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCurrency(point.collected, currency)}
                        </span>
                      </p>
                    </div>
                    <div
                      className="w-full max-w-3.5 rounded-t-sm bg-primary/25 transition-colors group-hover:bg-primary/40"
                      style={{ height: toPercent(point.invoiced) }}
                    />
                    <div
                      className="w-full max-w-3.5 rounded-t-sm bg-primary transition-colors group-hover:bg-primary/80"
                      style={{ height: toPercent(point.collected) }}
                    />
                  </li>
                ))}
              </ol>
            </div>

            <ol className="mt-2 flex justify-between gap-1 text-xs text-muted-foreground sm:gap-2">
              {data.map((point, index) => (
                <li key={point.month} className="flex-1 text-center">
                  <span className={cn(index % 2 === 1 && "invisible sm:visible")}>{point.month}</span>
                </li>
              ))}
            </ol>
          </div>
        </figure>
      </CardContent>
    </Card>
  );
}
