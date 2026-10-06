import { cn } from "cn";

import { formatCompactCurrency, formatCurrency } from "@/lib/format";

export interface MonthlyBarsRow {
  label: string;
  invoicedInr: string;
  collectedInr: string;
}

/** Rounds a chart maximum up to a "nice" axis ceiling. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

const TICKS = [0, 0.5, 1];

/** Pure CSS grouped bar chart: invoiced vs collected per month, in INR. */
export function MonthlyBars({ rows, currency = "INR", className }: { rows: MonthlyBarsRow[]; currency?: string; className?: string }) {
  const max = Math.max(0, ...rows.map((r) => Math.max(Number(r.invoicedInr), Number(r.collectedInr))));
  const axisMax = niceCeiling(max);
  const pct = (v: string) => `${(Number(v) / axisMax) * 100}%`;

  return (
    <figure className={cn("flex gap-3", className)} aria-label="Monthly invoiced versus collected">
      <div className="relative h-48 w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
        {TICKS.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ bottom: `${t * 100}%` }}>
            {formatCompactCurrency(t * axisMax, currency)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-48">
          {TICKS.map((t) => (
            <div key={t} aria-hidden className={cn("absolute inset-x-0 border-t", t === 0 ? "border-border" : "border-dashed border-border/60")} style={{ bottom: `${t * 100}%` }} />
          ))}
          <ol className="absolute inset-0 flex items-end justify-between gap-1">
            {rows.map((r) => (
              <li key={r.label} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
                <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                  <p className="mb-1 font-medium">{r.label}</p>
                  <p className="flex justify-between gap-3 text-muted-foreground">
                    Invoiced <span className="font-medium text-foreground tabular-nums">{formatCurrency(r.invoicedInr, currency)}</span>
                  </p>
                  <p className="flex justify-between gap-3 text-muted-foreground">
                    Collected <span className="font-medium text-foreground tabular-nums">{formatCurrency(r.collectedInr, currency)}</span>
                  </p>
                </div>
                <div className="w-full max-w-3 rounded-t-sm bg-primary/25 transition-colors group-hover:bg-primary/40" style={{ height: pct(r.invoicedInr) }} />
                <div className="w-full max-w-3 rounded-t-sm bg-primary transition-colors group-hover:bg-primary/80" style={{ height: pct(r.collectedInr) }} />
              </li>
            ))}
          </ol>
        </div>
        <ol className="mt-2 flex justify-between gap-1 text-[10px] text-muted-foreground">
          {rows.map((r, i) => (
            <li key={r.label} className="flex-1 truncate text-center">
              <span className={cn(rows.length > 8 && i % 2 === 1 && "invisible sm:visible")}>{r.label.split(" ")[0]}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
