import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatBRL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  filterStart: string;
  filterEnd: string;
}

export default function FinanceiroDeltaStrip({ byDate, today, filterStart, filterEnd }: Props) {
  const { lastData, prevData, hasComparison } = useMemo(() => {
    const closed = Array.from(byDate.entries())
      .filter(([d]) => d !== today && d >= filterStart && d <= filterEnd)
      .sort((a, b) => b[0].localeCompare(a[0]));

    if (closed.length < 2) {
      return { lastData: null, prevData: null, hasComparison: false };
    }
    return { lastData: closed[0][1], prevData: closed[1][1], hasComparison: true };
  }, [byDate, today, filterStart, filterEnd]);

  if (!hasComparison || !lastData || !prevData) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white px-5 py-4 text-center shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        <span className="text-[13px] text-slate-500">Sem base de comparação (precisa de 2 dias fechados no período)</span>
      </div>
    );
  }

  const dCost = lastData.cost - prevData.cost;
  const dRev = lastData.revenue - prevData.revenue;
  const costPositive = dCost <= 0;
  const revPositive = dRev >= 0;

  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/5">
        <div className="px-5 py-4 space-y-2">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em]">
            Delta fechado — ontem vs anteontem
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <DeltaItem label="Gasto" value={dCost} positive={costPositive} />
            <DeltaItem label="Faturamento" value={dRev} positive={revPositive} />
          </div>
        </div>
        <div className="px-5 py-4 space-y-2 bg-[#FAF9F6]/60">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em]">
            Anteontem (base)
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <span className="text-slate-500">Gasto: <span className="font-medium text-slate-950 tabular-nums">{formatBRL(prevData.cost)}</span></span>
            <span className="text-slate-500">Faturamento: <span className="font-medium text-slate-950 tabular-nums">{formatBRL(prevData.revenue)}</span></span>
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
    ? "text-slate-500"
    : positive
    ? "text-emerald-600"
    : "text-rose-500";

  return (
    <span className="text-[13px]">
      <span className="text-slate-500">{label}: </span>
      <span className={`font-medium tabular-nums ${color}`}>
        {icon} {sign}{formatBRL(value)}
      </span>
    </span>
  );
}
