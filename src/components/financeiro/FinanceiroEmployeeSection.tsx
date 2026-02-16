import { useState, useMemo, useCallback } from "react";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
      <span className={active ? "text-foreground" : ""}>{label}</span>
      {active ? (
        dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </button>
  );
}

export default function FinanceiroEmployeeSection({ byCloser, closers, onSelectCloser }: Props) {
  const [todaySortKey, setTodaySortKey] = useState<SortKey>("cost");
  const [todaySortDir, setTodaySortDir] = useState<SortDir>("desc");
  const [yestSortKey, setYestSortKey] = useState<SortKey>("net");
  const [yestSortDir, setYestSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((current: SortKey, dir: SortDir, key: SortKey, setKey: (k: SortKey) => void, setDir: (d: SortDir) => void) => {
    if (current === key) {
      setDir(dir === "desc" ? "asc" : "desc");
    } else {
      setKey(key);
      setDir("desc");
    }
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
      } else if (key === "rev") {
        diff = b.data.revYesterday - a.data.revYesterday;
      } else if (key === "margin") {
        diff = b.margin - a.margin;
      } else if (key === "roi") {
        diff = b.roi - a.roi;
      } else if (key === "cost") {
        diff = b.data.costYesterday - a.data.costYesterday;
      }
      return yestSortDir === "asc" ? -diff : diff;
    });
    return rows;
  }, [byCloser, yestSortKey, yestSortDir]);

  const topYesterdayId = yesterdayRows.length > 0 && yesterdayRows[0].net > 0 ? yesterdayRows[0].id : null;

  const resetToday = () => { setTodaySortKey("cost"); setTodaySortDir("desc"); };
  const resetYesterday = () => { setYestSortKey("net"); setYestSortDir("desc"); };

  const sortLabel = yestSortKey === "net" ? "Resultado Líquido" : yestSortKey === "rev" ? "Faturamento" : yestSortKey === "margin" ? "Margem" : yestSortKey === "roi" ? "ROI" : "Custo";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Por Funcionário</h2>
      <Tabs defaultValue="today" className="w-full" onValueChange={() => { resetToday(); resetYesterday(); }}>
        <TabsList className="mb-3">
          <TabsTrigger value="today">Hoje (Custo)</TabsTrigger>
          <TabsTrigger value="yesterday">Ontem (Resultado)</TabsTrigger>
        </TabsList>

        {/* ── TODAY ── */}
        <TabsContent value="today">
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Funcionário</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="Custo Hoje" active={todaySortKey === "cost"} dir={todaySortDir}
                        onClick={() => toggleSort(todaySortKey, todaySortDir, "cost", setTodaySortKey, setTodaySortDir)} />
                    </th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="Registros" active={todaySortKey === "count"} dir={todaySortDir}
                        onClick={() => toggleSort(todaySortKey, todaySortDir, "count", setTodaySortKey, setTodaySortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map(({ id, data }, idx) => {
                    const closer = closers.find((c) => c.id === id);
                    const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                    return (
                      <tr key={id} className={`border-b border-border/20 ${zebraClass}`}>
                        <td className="py-2.5 px-4">
                          <button onClick={() => closer && onSelectCloser(closer)} className="text-sm font-medium text-primary hover:underline text-left">
                            {closer?.nome || "—"}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums font-medium">{formatBRL(data.costToday)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{data.countToday}</td>
                      </tr>
                    );
                  })}
                  {todayRows.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">Nenhum registro hoje.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── YESTERDAY ── */}
        <TabsContent value="yesterday">
          <div className="mb-2 text-[11px] text-muted-foreground">
            Ordenado por: <span className="font-medium text-foreground">{sortLabel}</span> ({yestSortDir === "desc" ? "maior → menor" : "menor → maior"})
          </div>
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Funcionário</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="Fat. Bruto" active={yestSortKey === "rev"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "rev", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxas (5%)</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="Líquido" active={yestSortKey === "net"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "net", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="Margem" active={yestSortKey === "margin"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "margin", setYestSortKey, setYestSortDir)} />
                    </th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      <SortHeader label="ROI" active={yestSortKey === "roi"} dir={yestSortDir}
                        onClick={() => toggleSort(yestSortKey, yestSortDir, "roi", setYestSortKey, setYestSortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {yesterdayRows.map(({ id, data, taxes, net, margin, roi }, idx) => {
                    const closer = closers.find((c) => c.id === id);
                    const isTop = id === topYesterdayId;
                    const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                    const topClass = "bg-emerald-50/60 dark:bg-emerald-950/20";
                    return (
                      <tr key={id} className={`border-b border-border/20 ${isTop ? topClass : zebraClass}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => closer && onSelectCloser(closer)} className="text-sm font-medium text-primary hover:underline text-left">
                              {closer?.nome || "—"}
                            </button>
                            {isTop && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                                <Trophy className="h-3 w-3" /> TOP
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(data.revYesterday)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(taxes)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {formatBRL(net)}
                        </td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {margin.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${roi >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {roi.toFixed(2)}x
                        </td>
                      </tr>
                    );
                  })}
                  {yesterdayRows.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Nenhum registro ontem.</td></tr>
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
