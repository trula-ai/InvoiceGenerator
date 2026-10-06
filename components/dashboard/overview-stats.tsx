import { CircleCheck, Clock, DollarSign, TriangleAlert, type LucideIcon } from "lucide-react";

import { StatCard, type StatTone } from "@/components/dashboard/stat-card";
import type { OverviewStat, OverviewStatKind } from "@/lib/types/dashboard";
import { formatCurrency } from "@/lib/format";

const presentation: Record<
  OverviewStatKind,
  { title: string; icon: LucideIcon; tone: StatTone; higherIsBetter: boolean }
> = {
  revenue: { title: "Total Revenue", icon: DollarSign, tone: "default", higherIsBetter: true },
  paid: { title: "Paid Amount", icon: CircleCheck, tone: "success", higherIsBetter: true },
  pending: { title: "Pending Amount", icon: Clock, tone: "warning", higherIsBetter: false },
  overdue: { title: "Overdue Amount", icon: TriangleAlert, tone: "danger", higherIsBetter: false },
};

interface OverviewStatsProps {
  stats: OverviewStat[];
  currency: string;
}

export function OverviewStats({ stats, currency }: OverviewStatsProps) {
  return (
    <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const { title, icon, tone, higherIsBetter } = presentation[stat.kind];
        return (
          <StatCard
            key={stat.kind}
            title={title}
            value={formatCurrency(stat.amount, currency)}
            icon={icon}
            tone={tone}
            change={stat.change}
            changeLabel={stat.changeLabel}
            higherIsBetter={higherIsBetter}
          />
        );
      })}
    </section>
  );
}
