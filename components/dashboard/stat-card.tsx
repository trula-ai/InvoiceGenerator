import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";

export type StatTone = "default" | "success" | "warning" | "danger";

const toneClasses: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  /** Percentage change versus the comparison period. Omit to hide the trend line. */
  change?: number;
  changeLabel?: string;
  /** Set false when an increase is undesirable (e.g. overdue amount). */
  higherIsBetter?: boolean;
  tone?: StatTone;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  higherIsBetter = true,
  tone = "default",
  className,
}: StatCardProps) {
  const hasTrend = change !== undefined;
  const isFlat = change === 0;
  const isGood = !hasTrend || isFlat ? null : change > 0 === higherIsBetter;
  const TrendIcon = isFlat ? Minus : hasTrend && change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <CardAction>
          <span className={cn("flex size-9 items-center justify-center rounded-lg", toneClasses[tone])}>
            <Icon className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hasTrend ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                isGood === true && "text-emerald-600 dark:text-emerald-400",
                isGood === false && "text-destructive",
              )}
            >
              <TrendIcon className="size-3.5" />
              {formatPercent(change)}
            </span>
            {changeLabel}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No comparison period yet</p>
        )}
      </CardContent>
    </Card>
  );
}
