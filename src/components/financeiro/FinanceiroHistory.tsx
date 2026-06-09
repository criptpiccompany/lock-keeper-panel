import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { brandTableWrapClass } from "@/components/PageHeader";
import { formatBRL, fmtDate, computeNet, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  yesterday: string;
  filterStart: string;
  filterEnd: string;
}

type SortKey = "date" | "net" | "margin";

const TH_CLS = "py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-slate-500 bg-[#FAF9F6]";
const TD_CLS = "py-3 px-5 text-[13px]";

export default function FinanceiroHistory({ byDate, today, yesterday, filterStart, filterEnd }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [limit, setLimit] = useState(30);

  const rows = useMemo(() => {
    const entries = Array.from(byDate.entries())
      .filter(([d]) => d !== today && d >= filterStart && d <= filterEnd)
      .map(([date, { cost, revenue }]) => {
        const taxes = revenue * TAX_TOTAL;
        const net = computeNet(revenue, cost);
        const margin = revenue > 0 ? (net / revenue) * 100 : 0;
        return { date, cost, revenue, taxes, net, margin };
      });

    entries.sort((a, b) => {
      if (sortKey === "date") return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      if (sortKey === "margin") return sortAsc ? a.margin - b.margin : b.margin - a.margin;
      return sortAsc ? a.net - b.net : b.net - a.net;
    });

    return entries;
  }, [byDate, today, filterStart, filterEnd, sortKey, sortAsc]);

  const bestNetDate = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((best, r) => r.net > best.net ? r : best, rows[0]).date;
  }, [rows]);

  const visibleRows = rows.slice(0, limit);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-950">
        {label}
        {active ? (
          sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[20px] font-medium tracking-[-0.02em] text-slate-950">Histórico diário</h2>
      <div className={brandTableWrapClass}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/5">
                <th className={TH_CLS + " text-left"}>
                  <SortBtn label="Data" k="date" />
                </th>
                <th className={TH_CLS + " text-right"}>Custo op.</th>
                <th className={TH_CLS + " text-right"}>Fat. bruto</th>
                <th className={TH_CLS + " text-right"}>Taxas (5%)</th>
                <th className={TH_CLS + " text-right"}>
                  <SortBtn label="Líquido" k="net" />
                </th>
                <th className={TH_CLS + " text-right"}>
                  <SortBtn label="Margem" k="margin" />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const isBest = row.date === bestNetDate && rows.length > 1;
                const isYest = row.date === yesterday;
                return (
                  <tr key={row.date} className={`border-b border-black/5 last:border-0 transition-colors ${isBest ? "bg-emerald-50/40" : "hover:bg-[#FAF9F6]/70"}`}>
                    <td className={TD_CLS + " font-medium text-slate-950 tabular-nums"}>
                      {fmtDate(row.date)}
                      {isYest && <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">Fechado</span>}
                      {isBest && <span className="ml-2 text-[11px] text-emerald-600">★</span>}
                    </td>
                    <td className={TD_CLS + " text-right tabular-nums text-slate-700"}>{formatBRL(row.cost)}</td>
                    <td className={TD_CLS + " text-right tabular-nums text-slate-700"}>{formatBRL(row.revenue)}</td>
                    <td className={TD_CLS + " text-right tabular-nums text-slate-500"}>{formatBRL(row.taxes)}</td>
                    <td className={`${TD_CLS} text-right tabular-nums font-medium ${row.net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {formatBRL(row.net)}
                    </td>
                    <td className={`${TD_CLS} text-right tabular-nums font-medium ${row.margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {row.margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[13px] text-slate-500">Nenhum histórico no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="px-5 py-3 text-center border-t border-black/5 bg-[#FAF9F6]/60">
            <button onClick={() => setLimit((l) => l + 30)} className="text-[11px] uppercase tracking-[0.14em] font-medium text-slate-950 hover:underline underline-offset-4">
              Carregar mais ({rows.length - limit} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
