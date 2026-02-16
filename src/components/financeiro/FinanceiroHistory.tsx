import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatBRL, fmtDate, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  yesterday: string;
  filterStart: string;
  filterEnd: string;
}

type SortKey = "date" | "net" | "margin";

export default function FinanceiroHistory({ byDate, today, yesterday, filterStart, filterEnd }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [limit, setLimit] = useState(30);

  const rows = useMemo(() => {
    const entries = Array.from(byDate.entries())
      .filter(([d]) => d !== today && d >= filterStart && d <= filterEnd)
      .map(([date, { cost, revenue }]) => {
        const taxes = revenue * TAX_TOTAL;
        const net = revenue - taxes;
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
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-primary">
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
    <div>
      <h2 className="text-lg font-semibold mb-3">Histórico Diário</h2>
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                  <SortBtn label="Data" k="date" />
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Custo Op.</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Fat. Bruto</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxas (5%)</th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                  <SortBtn label="Líquido" k="net" />
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                  <SortBtn label="Margem" k="margin" />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const isBest = row.date === bestNetDate && rows.length > 1;
                const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                const isYest = row.date === yesterday;
                return (
                  <tr key={row.date} className={`border-b border-border/20 ${isBest ? "bg-emerald-50/50 dark:bg-emerald-950/15" : zebraClass}`}>
                    <td className="py-2.5 px-4 text-xs font-medium">
                      {fmtDate(row.date)}
                      {isYest && <span className="ml-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">FECHADO</span>}
                      {isBest && <span className="ml-2 text-[10px] font-semibold text-emerald-600">★</span>}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(row.cost)}</td>
                    <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(row.revenue)}</td>
                    <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(row.taxes)}</td>
                    <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${row.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatBRL(row.net)}
                    </td>
                    <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${row.margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {row.margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Nenhum histórico no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="p-3 text-center border-t border-border/20">
            <button onClick={() => setLimit((l) => l + 30)} className="text-xs text-primary hover:underline font-medium">
              Carregar mais ({rows.length - limit} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
