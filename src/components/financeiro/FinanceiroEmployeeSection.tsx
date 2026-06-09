import { useState, useMemo, useCallback } from "react";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brandTabsListClass, brandTabsTriggerClass, brandTableWrapClass } from "@/components/PageHeader";
import { formatBRL, computeNet, TAX_TOTAL, type CloserProfile, type EmployeeDayData } from "./financeiroHelpers";

type SortKey = "cost" | "rev" | "net" | "margin" | "roi" | "count";
type SortDir = "asc" | "desc";

interface Props {
  byCloser: Map<string, EmployeeDayData>;
  closers: CloserProfile[];
  onSelectCloser: (closer: CloserProfile) => void;
  currentLabel: string;
  previousLabel: string;
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

export default function FinanceiroEmployeeSection({ byCloser, closers, onSelectCloser, currentLabel, previousLabel }: Props) {
  const [currentSortKey, setCurrentSortKey] = useState<SortKey>("cost");
  const [currentSortDir, setCurrentSortDir] = useState<SortDir>("desc");
  const [prevSortKey, setPrevSortKey] = useState<SortKey>("net");
  const [prevSortDir, setPrevSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((current: SortKey, dir: SortDir, key: SortKey, setKey: (k: SortKey) => void, setDir: (d: SortDir) => void) => {
    if (current === key) setDir(dir === "desc" ? "asc" : "desc");
    else { setKey(key); setDir("desc"); }
  }, []);

  const currentRows = useMemo(() => {
    const rows = Array.from(byCloser.entries())
      .filter(([, d]) => d.costCurrent > 0 || d.countCurrent > 0)
      .map(([id, data]) => ({ id, data }));

    rows.sort((a, b) => {
      const valA = currentSortKey === "cost" ? a.data.costCurrent : a.data.countCurrent;
      const valB = currentSortKey === "cost" ? b.data.costCurrent : b.data.countCurrent;
      return currentSortDir === "desc" ? valB - valA : valA - valB;
    });
    return rows;
  }, [byCloser, currentSortKey, currentSortDir]);

  const previousRows = useMemo(() => {
    const rows = Array.from(byCloser.entries())
      .filter(([, d]) => d.revPrevious > 0 || d.costPrevious > 0)
      .map(([id, data]) => {
        const taxes = data.revPrevious * TAX_TOTAL;
        const net = computeNet(data.revPrevious, data.costPrevious);
        const margin = data.revPrevious > 0 ? (net / data.revPrevious) * 100 : 0;
        // ROI verdadeiro: lucro líquido sobre investimento
        const roi = data.costPrevious > 0 ? (net / data.costPrevious) : 0;
        return { id, data, taxes, net, margin, roi };
      });

    rows.sort((a, b) => {
      let diff = 0;
      const key = prevSortKey;
      if (key === "net") {
        diff = b.net - a.net;
        if (diff === 0) diff = b.data.revPrevious - a.data.revPrevious;
        if (diff === 0) diff = a.data.costPrevious - b.data.costPrevious;
      } else if (key === "rev") diff = b.data.revPrevious - a.data.revPrevious;
      else if (key === "margin") diff = b.margin - a.margin;
      else if (key === "roi") diff = b.roi - a.roi;
      else if (key === "cost") diff = b.data.costPrevious - a.data.costPrevious;
      return prevSortDir === "asc" ? -diff : diff;
    });
    return rows;
  }, [byCloser, prevSortKey, prevSortDir]);

  const topPrevId = previousRows.length > 0 && previousRows[0].net > 0 ? previousRows[0].id : null;

  const resetCurrent = () => { setCurrentSortKey("cost"); setCurrentSortDir("desc"); };
  const resetPrev = () => { setPrevSortKey("net"); setPrevSortDir("desc"); };

  const sortLabel = prevSortKey === "net" ? "Resultado líquido" : prevSortKey === "rev" ? "Faturamento" : prevSortKey === "margin" ? "Margem" : prevSortKey === "roi" ? "ROI" : "Custo";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-[20px] font-medium tracking-[-0.02em] text-slate-950">Por funcionário</h2>
      </div>
      <Tabs defaultValue="current" className="w-full" onValueChange={() => { resetCurrent(); resetPrev(); }}>
        <TabsList className={brandTabsListClass}>
          <TabsTrigger value="current" className={brandTabsTriggerClass}>{currentLabel} (custo)</TabsTrigger>
          <TabsTrigger value="previous" className={brandTabsTriggerClass}>{previousLabel} (resultado)</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          <div className={brandTableWrapClass}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className={TH_CLS}>Funcionário</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label={`Custo — ${currentLabel.toLowerCase()}`} active={currentSortKey === "cost"} dir={currentSortDir}
                        onClick={() => toggleSort(currentSortKey, currentSortDir, "cost", setCurrentSortKey, setCurrentSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Registros" active={currentSortKey === "count"} dir={currentSortDir}
                        onClick={() => toggleSort(currentSortKey, currentSortDir, "count", setCurrentSortKey, setCurrentSortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map(({ id, data }) => {
                    const closer = closers.find((c) => c.id === id);
                    return (
                      <tr key={id} className="border-b border-black/5 last:border-0 hover:bg-[#FAF9F6]/70 transition-colors">
                        <td className={TD_CLS}>
                          <button onClick={() => closer && onSelectCloser(closer)} className="font-medium text-slate-950 hover:underline underline-offset-4 text-left">
                            {closer?.nome || "—"}
                          </button>
                        </td>
                        <td className={TD_CLS + " text-right tabular-nums font-medium text-slate-950"}>{formatBRL(data.costCurrent)}</td>
                        <td className={TD_CLS + " text-right tabular-nums text-slate-500"}>{data.countCurrent}</td>
                      </tr>
                    );
                  })}
                  {currentRows.length === 0 && (
                    <tr><td colSpan={3} className="py-16 text-center text-[13px] text-slate-500">Nenhum registro no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="previous" className="mt-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Ordenado por <span className="font-medium text-slate-950">{sortLabel}</span> ({prevSortDir === "desc" ? "maior → menor" : "menor → maior"}) · Líquido = Fat − Custo − Taxas
          </div>
          <div className={brandTableWrapClass}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className={TH_CLS}>Funcionário</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Custo" active={prevSortKey === "cost"} dir={prevSortDir}
                        onClick={() => toggleSort(prevSortKey, prevSortDir, "cost", setPrevSortKey, setPrevSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Fat. bruto" active={prevSortKey === "rev"} dir={prevSortDir}
                        onClick={() => toggleSort(prevSortKey, prevSortDir, "rev", setPrevSortKey, setPrevSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>Taxas (5%)</th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Líquido" active={prevSortKey === "net"} dir={prevSortDir}
                        onClick={() => toggleSort(prevSortKey, prevSortDir, "net", setPrevSortKey, setPrevSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="Margem" active={prevSortKey === "margin"} dir={prevSortDir}
                        onClick={() => toggleSort(prevSortKey, prevSortDir, "margin", setPrevSortKey, setPrevSortDir)} />
                    </th>
                    <th className={TH_CLS + " text-right"}>
                      <SortHeader label="ROI" active={prevSortKey === "roi"} dir={prevSortDir}
                        onClick={() => toggleSort(prevSortKey, prevSortDir, "roi", setPrevSortKey, setPrevSortDir)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previousRows.map(({ id, data, taxes, net, margin, roi }) => {
                    const closer = closers.find((c) => c.id === id);
                    const isTop = id === topPrevId;
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
                        <td className={TD_CLS + " text-right tabular-nums text-slate-700"}>{formatBRL(data.costPrevious)}</td>
                        <td className={TD_CLS + " text-right tabular-nums text-slate-950"}>{formatBRL(data.revPrevious)}</td>
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
                  {previousRows.length === 0 && (
                    <tr><td colSpan={7} className="py-16 text-center text-[13px] text-slate-500">Nenhum registro em {previousLabel.toLowerCase()}.</td></tr>
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
