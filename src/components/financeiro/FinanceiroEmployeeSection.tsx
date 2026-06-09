import { useState, useMemo, useCallback } from "react";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brandTabsListClass, brandTabsTriggerClass, brandTableWrapClass } from "@/components/PageHeader";
import { formatBRL, TAX_TOTAL, type CloserProfile, type EmployeeDayData } from "./financeiroHelpers";

type SortKey = "cost" | "rev" | "net" | "margin" | "roi" | "count";
type SortDir = "asc" | "desc";

interface Props {
  byCloser: Map<string, EmployeeDayData>;
  closers: CloserProfile[];
  onSelectCloser: (closer: CloserProfile) => void;
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 group">
      <span className={active ? "text-slate-950" : ""}>{label}</span>
      {active ? (
        dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </button>
  );
}

const TH_CLS = "text-left py-3 px-5 font-medium text-[10px] uppercase tracking-[0.14em] text-slate-500 bg-[#FAF9F6]";
const TD_CLS = "py-3 px-5 text-[13px]";

export default function FinanceiroEmployeeSection({ byCloser, closers, onSelectCloser }: Props) {
  const [todaySortKey, setTodaySortKey] = useState<SortKey>("cost");
  const [todaySortDir, setTodaySortDir] = useState<SortDir>("desc");
  const [yestSortKey, setYestSortKey] = useState<SortKey>("net");
  const [yestSortDir, setYestSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((current: SortKey, dir: SortDir, key: SortKey, setKey: (k: SortKey) => void, setDir: (d: SortDir) => void) => {
    if (current === key) setDir(dir === "desc" ? "asc" : "desc");
    else { setKey(key); setDir("desc"); }
  }, []);

  const todayRows = useMemo(() => {
    const rows = Array.from(byCloser.entries())
      .filter(([, d]) => d.costToday > 0 || d.countToday > 0)
      .map(([id, data]) => ({ id, data }));

    rows.sort((a, b) => {
      const valA = todaySortKey === "cost" ? a.data.costToday : a.data.countToday;
      const valB = todaySortKey === "cost" ? b.data.costToday : b.data.countToday;
      return todaySortDir === "desc" ? valB - valA : valA - valB;
    });
    return rows;
  }, [byCloser, todaySortKey, todaySortDir]);

  const yesterdayRows = useMemo(() => {
    const rows = Array.from(byCloser.entries())
      .filter(([, d]) => d.revYesterday > 0 || d.costYesterday > 0)
      .map(([id, data]) => {
        const taxes = data.revYesterday * TAX_TOTAL;
        const net = data.revYesterday - taxes;
        const margin = data.revYesterday > 0 ? (net / data.revYesterday) * 100 : 0;
        const roi = data.costYesterday > 0 ? (net / data.costYesterday) : 0;
        return { id, data, taxes, net, margin, roi };
      });

    rows.sort((a, b) => {
      let diff = 0;
      const key = yestSortKey;
      if (key === "net") {
        diff = b.net - a.net;
        if (diff === 0) diff = b.data.revYesterday - a.data.revYesterday;
        if (diff === 0) diff = a.data.costYesterday - b.data.costYesterday;
      } else if (key === "rev") diff = b.data.revYesterday - a.data.revYesterday;
      else if (key === "margin") diff = b.margin - a.margin;
      else if (key === "roi") diff = b.roi - a.roi;
      else if (key === "cost") diff = b.data.costYesterday - a.data.costYesterday;
      return yestSortDir === "asc" ? -diff : diff;
    });
    return rows;
  }, [byCloser, yestSortKey, yestSortDir]);

  const topYesterdayId = yesterdayRows.length > 0 && yesterdayRows[0].net > 0 ? yesterdayRows[0].id : null;

  const resetToday = () => { setTodaySortKey("cost"); setTodaySortDir("desc"); };
  const resetYesterday = () => { setYestSortKey("net"); setYestSortDir("desc"); };

  const sortLabel = yestSortKey === "net" ? "Resultado líquido" : yestSortKey === "rev" ? "Faturamento" : yestSortKey === "margin" ? "Margem" : yestSortKey === "roi" ? "ROI" : "Custo";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-[20px] font-medium tracking-[-0.02em] text-slate-950">Por funcionário</h2>
      </div>
      <Tabs defaultValue="today" className="w-full" onValueChange={() => { resetToday(); resetYesterday(); }}>
        <TabsList className={brandTabsListClass}>
          <TabsTrigger value="today" className={brandTabsTriggerClass}>Hoje (custo)</TabsTrigger>
          <TabsTrigger value="yesterday" className={brandTabsTriggerClass}>Ontem (resultado)</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <div className={brandTableWrapClass}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className={TH_CLS}>Funcionário</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Custo hoje" active={todaySortKey === "cost"} dir={todaySortDir}
                        onClick={() => toggleSort(todaySortKey, todaySortDir, "cost", setTodaySortKey, setTodaySortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Registros" active={todaySortKey === "count"} dir={todaySortDir}
                        onClick={() => toggleSort(todaySortKey, todaySortDir, "count", setTodaySortKey, setTodaySortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map(({ id, data }) => {
                    const closer = closers.find((c) => c.id === id);
                    return (
                      <tr key={id} className="border-b border-black/5 last:border-0 hover:bg-[#FAF9F6]/70 transition-colors">
                        <td className={TD_CLS}>
                          <button onClick={() => closer && onSelectCloser(closer)} className="font-medium text-slate-950 hover:underline underline-offset-4 text-left">
                            {closer?.nome || "—"}
                          </button>
                        </td>
                        <td className={TD_CLS + " text-right tabular-nums font-medium text-slate-950"}>{formatBRL(data.costToday)}</td>
                        <td className={TD_CLS + " text-right tabular-nums text-slate-500"}>{data.countToday}</td>
                      </tr>
                    );
                  })}
                  {todayRows.length === 0 && (
                    <tr><td colSpan={3} className="py-16 text-center text-[13px] text-slate-500">Nenhum registro hoje.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="yesterday" className="mt-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Ordenado por <span className="font-medium text-slate-950">{sortLabel}</span> ({yestSortDir === "desc" ? "maior → menor" : "menor → maior"})
          </div>
          <div className={brandTableWrapClass}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className={TH_CLS}>Funcionário</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Fat. bruto" active={yestSortKey === "rev"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "rev", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>Taxas (5%)</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Líquido" active={yestSortKey === "net"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "net", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Margem" active={yestSortKey === "margin"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "margin", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="ROI" active={yestSortKey === "roi"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "roi", setYestSortKey, setYestSortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {yesterdayRows.map(({ id, data, taxes, net, margin, roi }) => {
                    const closer = closers.find((c) => c.id === id);
                    const isTop = id === topYesterdayId;
                    return (
                      <tr key={id} className={`border-b border-black/5 last:border-0 transition-colors ${isTop ? "bg-emerald-50/40" : "hover:bg-[#FAF9F6]/70"}`}>
                        <td className={TD_CLS}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => closer && onSelectCloser(closer)} className="font-medium text-slate-950 hover:underline underline-offset-4 text-left">
                              {closer?.nome || "—"}
                            </button>
                            {isTop && (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0 gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <Trophy className="h-3 w-3" /> TOP
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={TD_CLS + " text-right tabular-nums text-slate-950"}>{formatBRL(data.revYesterday)}</td>
                        <td className={TD_CLS + " text-right tabular-nums text-slate-500"}>{formatBRL(taxes)}</td>
                        <td className={`${TD_CLS} text-right tabular-nums font-medium ${net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                          {formatBRL(net)}
                        </td>
                        <td className={`${TD_CLS} text-right tabular-nums font-medium ${margin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                          {margin.toFixed(1)}%
                        </td>
                        <td className={`${TD_CLS} text-right tabular-nums font-medium ${roi >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                          {roi.toFixed(2)}x
                        </td>
                      </tr>
                    );
                  })}
                  {yesterdayRows.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-[13px] text-slate-500">Nenhum registro ontem.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
