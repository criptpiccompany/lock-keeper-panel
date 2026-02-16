import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, TAX_TOTAL, type CloserProfile, type EmployeeDayData } from "./financeiroHelpers";

interface Props {
  byCloser: Map<string, EmployeeDayData>;
  closers: CloserProfile[];
  onSelectCloser: (closer: CloserProfile) => void;
}

export default function FinanceiroEmployeeSection({ byCloser, closers, onSelectCloser }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Por Funcionário</h2>
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="today">Hoje (Custo)</TabsTrigger>
          <TabsTrigger value="yesterday">Ontem (Resultado)</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Funcionário</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Custo Hoje</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byCloser.entries())
                    .filter(([, d]) => d.costToday > 0 || d.countToday > 0)
                    .map(([closerId, data], idx) => {
                      const closer = closers.find((c) => c.id === closerId);
                      const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                      return (
                        <tr key={closerId} className={`border-b border-border/20 ${zebraClass}`}>
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
                  {Array.from(byCloser.entries()).filter(([, d]) => d.costToday > 0 || d.countToday > 0).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">Nenhum registro hoje.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="yesterday">
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Funcionário</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Fat. Bruto</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxas (5%)</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Líquido</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byCloser.entries())
                    .filter(([, d]) => d.revYesterday > 0 || d.costYesterday > 0)
                    .map(([closerId, data], idx) => {
                      const closer = closers.find((c) => c.id === closerId);
                      const taxes = data.revYesterday * TAX_TOTAL;
                      const net = data.revYesterday - taxes;
                      const margin = data.revYesterday > 0 ? (net / data.revYesterday) * 100 : 0;
                      const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                      return (
                        <tr key={closerId} className={`border-b border-border/20 ${zebraClass}`}>
                          <td className="py-2.5 px-4">
                            <button onClick={() => closer && onSelectCloser(closer)} className="text-sm font-medium text-primary hover:underline text-left">
                              {closer?.nome || "—"}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(data.revYesterday)}</td>
                          <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(taxes)}</td>
                          <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {formatBRL(net)}
                          </td>
                          <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  {Array.from(byCloser.entries()).filter(([, d]) => d.revYesterday > 0 || d.costYesterday > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Nenhum registro ontem.</td>
                    </tr>
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
