import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Percent, Receipt, Clock, CheckCircle2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Balanco from "@/components/planilhamento/Balanco";

/* ─── constants ─── */
const TAX_DEV = 0.02;
const TAX_GATEWAY = 0.03;
const TAX_TOTAL = TAX_DEV + TAX_GATEWAY; // 5%

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

/* helpers to get date strings */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DailyRecord {
  id: string;
  date: string;
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
}

interface CloserProfile {
  id: string;
  nome: string;
}

export default function Financeiro() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<CloserProfile | null>(null);

  const today = todayStr();
  const yesterday = yesterdayStr();

  useEffect(() => {
    const fetch = async () => {
      // last 30 days of records
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;

      const [recRes, closerRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, valor_pago, faturamento")
          .gte("date", sinceStr)
          .lte("date", today)
          .is("deleted_at", null)
          .order("date", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nome")
          .eq("status", "approved")
          .order("nome"),
      ]);

      setRecords((recRes.data as any as DailyRecord[]) || []);
      setClosers((closerRes.data as any as CloserProfile[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  /* ─── aggregations ─── */

  // group by date
  const byDate = useMemo(() => {
    const map = new Map<string, { cost: number; revenue: number }>();
    records.forEach((r) => {
      const e = map.get(r.date) || { cost: 0, revenue: 0 };
      e.cost += Number(r.valor_pago) || 0;
      e.revenue += Number(r.faturamento) || 0;
      map.set(r.date, e);
    });
    return map;
  }, [records]);

  const todayData = byDate.get(today) || { cost: 0, revenue: 0 };
  const yesterdayData = byDate.get(yesterday) || { cost: 0, revenue: 0 };

  const yTaxes = yesterdayData.revenue * TAX_TOTAL;
  const yNet = yesterdayData.revenue - yTaxes;
  const yMargin = yesterdayData.revenue > 0 ? (yNet / yesterdayData.revenue) * 100 : 0;

  // employee breakdown for today + yesterday
  const byCloser = useMemo(() => {
    const map = new Map<string, { costToday: number; revYesterday: number }>();
    records.forEach((r) => {
      if (r.date !== today && r.date !== yesterday) return;
      const e = map.get(r.closer_id) || { costToday: 0, revYesterday: 0 };
      if (r.date === today) e.costToday += Number(r.valor_pago) || 0;
      if (r.date === yesterday) e.revYesterday += Number(r.faturamento) || 0;
      map.set(r.closer_id, e);
    });
    return map;
  }, [records, today, yesterday]);

  // history (excluding today)
  const history = useMemo(() => {
    const dates = Array.from(byDate.entries())
      .filter(([d]) => d !== today)
      .sort((a, b) => b[0].localeCompare(a[0]));
    return dates.map(([date, { revenue }]) => {
      const taxes = revenue * TAX_TOTAL;
      const net = revenue - taxes;
      return { date, revenue, taxes, net };
    });
  }, [byDate, today]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mb-6">
            <DollarSign className="h-6 w-6" />
            Financeiro
          </h1>

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            <SummaryCard
              label="Custo Operacional Hoje"
              value={formatBRL(todayData.cost)}
              icon={Receipt}
              sub="Parcial"
            />
            <SummaryCard
              label="Faturamento Ontem"
              value={formatBRL(yesterdayData.revenue)}
              icon={TrendingUp}
              sub="Fechado"
              variant="positive"
            />
            <SummaryCard
              label="Taxas Totais Ontem (5%)"
              value={formatBRL(yTaxes)}
              icon={Percent}
              sub="2% dev + 3% gateway"
              variant="muted"
            />
            <SummaryCard
              label="Resultado Líquido Ontem"
              value={formatBRL(yNet)}
              icon={yNet >= 0 ? TrendingUp : TrendingDown}
              sub="Fechado"
              variant={yNet >= 0 ? "positive" : "negative"}
            />
            <SummaryCard
              label="Margem Ontem"
              value={`${yMargin.toFixed(1)}%`}
              icon={Percent}
              sub="Fechado"
              variant={yMargin >= 0 ? "positive" : "negative"}
            />
          </div>

          {/* ── Comparative Block ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <CompareBlock
              title="Hoje (Parcial)"
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              rows={[
                { label: "Custo operacional", value: formatBRL(todayData.cost) },
                { label: "Faturamento aguardando", value: formatBRL(todayData.revenue), muted: true },
              ]}
              accent="amber"
            />
            <CompareBlock
              title="Ontem (Fechado)"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              rows={[
                { label: "Faturamento bruto", value: formatBRL(yesterdayData.revenue) },
                { label: "Taxas (5%)", value: `- ${formatBRL(yTaxes)}`, muted: true },
                { label: "Resultado líquido", value: formatBRL(yNet), highlight: yNet >= 0 ? "positive" : "negative" },
              ]}
              accent="emerald"
            />
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-8">
        {/* ── Employee Table ── */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Por Funcionário</h2>
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Funcionário</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Custo Hoje</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Fat. Ontem</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byCloser.entries()).map(([closerId, data], idx) => {
                    const closer = closers.find((c) => c.id === closerId);
                    const result = data.revYesterday - data.revYesterday * TAX_TOTAL - data.costToday;
                    const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                    return (
                      <tr key={closerId} className={`border-b border-border/20 ${zebraClass}`}>
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => closer && setSelectedCloser(closer)}
                            className="text-sm font-medium text-primary hover:underline text-left"
                          >
                            {closer?.nome || "—"}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(data.costToday)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(data.revYesterday)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${result >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {formatBRL(result)}
                        </td>
                      </tr>
                    );
                  })}
                  {byCloser.size === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── History Table ── */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Histórico Diário</h2>
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Data</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Faturamento Bruto</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxas (5%)</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Resultado Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, idx) => {
                    const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                    const isYesterday = row.date === yesterday;
                    return (
                      <tr key={row.date} className={`border-b border-border/20 ${zebraClass}`}>
                        <td className="py-2.5 px-4 text-xs font-medium">
                          {fmtDate(row.date)}
                          {isYesterday && (
                            <span className="ml-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              FECHADO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(row.revenue)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(row.taxes)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${row.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {formatBRL(row.net)}
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                        Nenhum histórico disponível.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Employee Detail Side Panel ── */}
      <Sheet open={!!selectedCloser} onOpenChange={(open) => !open && setSelectedCloser(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {selectedCloser?.nome}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedCloser && <Balanco closerId={selectedCloser.id} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Sub-components ─── */

function SummaryCard({
  label,
  value,
  icon: Icon,
  sub,
  variant = "default",
}: {
  label: string;
  value: string;
  icon: any;
  sub?: string;
  variant?: "default" | "positive" | "negative" | "muted";
}) {
  const colorMap = {
    default: "",
    positive: "text-emerald-700",
    negative: "text-red-600",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${colorMap[variant]}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CompareBlock({
  title,
  icon,
  rows,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: string; muted?: boolean; highlight?: "positive" | "negative" }[];
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className={r.muted ? "text-muted-foreground" : ""}>{r.label}</span>
            <span
              className={`tabular-nums font-medium ${
                r.highlight === "positive"
                  ? "text-emerald-700"
                  : r.highlight === "negative"
                  ? "text-red-600"
                  : r.muted
                  ? "text-muted-foreground"
                  : ""
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
