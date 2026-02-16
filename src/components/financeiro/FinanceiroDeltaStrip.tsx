import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatBRL, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  filterStart: string;
  filterEnd: string;
}

export default function FinanceiroDeltaStrip({ byDate, today, filterStart, filterEnd }: Props) {
  const { lastDay, prevDay, lastData, prevData, hasComparison } = useMemo(() => {
    // Get all closed days (exclude today) within filter, sorted desc
    const closed = Array.from(byDate.entries())
      .filter(([d]) => d !== today && d >= filterStart && d <= filterEnd)
      .sort((a, b) => b[0].localeCompare(a[0]));

    if (closed.length < 2) {
      return { lastDay: null, prevDay: null, lastData: null, prevData: null, hasComparison: false };
    }

    return {
      lastDay: closed[0][0],
      prevDay: closed[1][0],
      lastData: closed[0][1],
      prevData: closed[1][1],
      hasComparison: true,
    };
  }, [byDate, today, filterStart, filterEnd]);

  if (!hasComparison || !lastData || !prevData) {
    return (
      <div className="rounded-lg border border-border/30 bg-muted/20 px-5 py-3 text-center">
        <span className="text-xs text-muted-foreground">Sem base de comparação (precisa de 2 dias fechados no período)</span>
      </div>
    );
  }

  const dCost = lastData.cost - prevData.cost;
  const dRev = lastData.revenue - prevData.revenue;

  // Cost: decrease = good (green), increase = bad (red)
  const costPositive = dCost <= 0;
  // Revenue: increase = good (green), decrease = bad (red)
  const revPositive = dRev >= 0;

  return (
    <div className="rounded-xl border border-border/30 bg-card shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* Column 1: Delta */}
        <div className="px-5 py-3.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Delta Fechado — Ontem vs Anteontem
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <DeltaItem
              label="Gasto"
              value={dCost}
              positive={costPositive}
            />
            <DeltaItem
              label="Faturamento"
              value={dRev}
              positive={revPositive}
            />
          </div>
        </div>

        {/* Column 2: Base values */}
        <div className="px-5 py-3.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Anteontem (Base)
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">Gasto: <span className="font-medium text-foreground tabular-nums">{formatBRL(prevData.cost)}</span></span>
            <span className="text-muted-foreground">Faturamento: <span className="font-medium text-foreground tabular-nums">{formatBRL(prevData.revenue)}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeltaItem({ label, value, positive }: { label: string; value: number; positive: boolean }) {
  const sign = value > 0 ? "+" : "";
  const icon = value > 0
    ? <TrendingUp className="h-3.5 w-3.5 inline" />
    : value < 0
    ? <TrendingDown className="h-3.5 w-3.5 inline" />
    : null;
  const color = value === 0
    ? "text-muted-foreground"
    : positive
    ? "text-emerald-600"
    : "text-red-500";

  return (
    <span className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className={`font-medium tabular-nums ${color}`}>
        {icon} {sign}{formatBRL(value)}
      </span>
    </span>
  );
}
