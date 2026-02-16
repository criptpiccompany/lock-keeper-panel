import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_TAX_TOTAL_RATE, ADMIN_TAX_DEV_RATE, ADMIN_TAX_GATEWAY_RATE } from "@/lib/constants";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CloserDayPanel from "@/components/dashboard/CloserDayPanel";

// --- Helpers ---

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
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

// --- Summary Card ---

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  badge,
}: {
  label: string;
  value: string;
  icon: any;
  variant?: "default" | "positive" | "negative" | "muted";
  badge?: string;
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
        {badge && (
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200/50">
            {badge}
          </Badge>
        )}
      </div>
      <p className={`text-lg font-semibold tabular-nums ${colorMap[variant]}`}>{value}</p>
    </div>
  );
}

// --- Main ---

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [historyRecords, setHistoryRecords] = useState<DailyRecord[]>([]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCloserId, setPanelCloserId] = useState("");
  const [panelCloserNome, setPanelCloserNome] = useState("");
  const [panelDate, setPanelDate] = useState("");

  const today = getDateStr(0);
  const yesterday = getDateStr(-1);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoading(true);

      // Fetch last 30 days of records for history
      const thirtyDaysAgo = getDateStr(-30);

      const [recordsRes, closersRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, valor_pago, faturamento")
          .gte("date", thirtyDaysAgo)
          .lte("date", today)
          .is("deleted_at", null)
          .order("date", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nome")
          .eq("status", "approved")
          .order("nome"),
      ]);

      const allRecords = (recordsRes.data as any as DailyRecord[]) || [];
      setRecords(allRecords.filter((r) => r.date === today || r.date === yesterday));
      setHistoryRecords(allRecords.filter((r) => r.date < today));
      setClosers((closersRes.data as any as CloserProfile[]) || []);
      setLoading(false);
    };

    fetchAll();
  }, [user, today, yesterday]);

  // Aggregate by date
  const aggregate = (recs: DailyRecord[]) => {
    let invested = 0;
    let revenue = 0;
    recs.forEach((r) => {
      invested += Number(r.valor_pago) || 0;
      revenue += Number(r.faturamento) || 0;
    });
    const tax = revenue * ADMIN_TAX_TOTAL_RATE;
    const result = revenue - invested - tax;
    const margin = invested > 0 ? result / invested : 0;
    return { invested, revenue, tax, result, margin };
  };

  const todayRecords = useMemo(() => records.filter((r) => r.date === today), [records, today]);
  const yesterdayRecords = useMemo(() => records.filter((r) => r.date === yesterday), [records, yesterday]);

  const todayAgg = useMemo(() => aggregate(todayRecords), [todayRecords]);
  const yesterdayAgg = useMemo(() => aggregate(yesterdayRecords), [yesterdayRecords]);

  // Employee table - today's cost, yesterday's revenue
  const closerMap = useMemo(() => new Map(closers.map((c) => [c.id, c.nome])), [closers]);

  const employeeRows = useMemo(() => {
    const map = new Map<string, { todayInvested: number; yesterdayRevenue: number; yesterdayInvested: number }>();

    todayRecords.forEach((r) => {
      const entry = map.get(r.closer_id) || { todayInvested: 0, yesterdayRevenue: 0, yesterdayInvested: 0 };
      entry.todayInvested += Number(r.valor_pago) || 0;
      map.set(r.closer_id, entry);
    });

    yesterdayRecords.forEach((r) => {
      const entry = map.get(r.closer_id) || { todayInvested: 0, yesterdayRevenue: 0, yesterdayInvested: 0 };
      entry.yesterdayRevenue += Number(r.faturamento) || 0;
      entry.yesterdayInvested += Number(r.valor_pago) || 0;
      map.set(r.closer_id, entry);
    });

    return Array.from(map.entries())
      .map(([closerId, data]) => {
        const tax = data.yesterdayRevenue * ADMIN_TAX_TOTAL_RATE;
        const result = data.yesterdayRevenue - data.yesterdayInvested - tax;
        return {
          closerId,
          nome: closerMap.get(closerId) || closerId.slice(0, 8),
          todayInvested: data.todayInvested,
          yesterdayRevenue: data.yesterdayRevenue,
          result,
        };
      })
      .sort((a, b) => b.result - a.result);
  }, [todayRecords, yesterdayRecords, closerMap]);

  // Daily history aggregated
  const historyDays = useMemo(() => {
    const map = new Map<string, { invested: number; revenue: number }>();
    historyRecords.forEach((r) => {
      const entry = map.get(r.date) || { invested: 0, revenue: 0 };
      entry.invested += Number(r.valor_pago) || 0;
      entry.revenue += Number(r.faturamento) || 0;
      map.set(r.date, entry);
    });

    return Array.from(map.entries())
      .map(([date, data]) => {
        const tax = data.revenue * ADMIN_TAX_TOTAL_RATE;
        const result = data.revenue - data.invested - tax;
        return { date, ...data, tax, result };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);
  }, [historyRecords]);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  const openPanel = (closerId: string, nome: string, date: string) => {
    setPanelCloserId(closerId);
    setPanelCloserNome(nome);
    setPanelDate(date);
    setPanelOpen(true);
  };

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
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mb-1">
            <BarChart3 className="h-6 w-6" />
            Dashboard Financeiro
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Taxas operacionais: Dev {(ADMIN_TAX_DEV_RATE * 100).toFixed(0)}% + Gateway {(ADMIN_TAX_GATEWAY_RATE * 100).toFixed(0)}% = {(ADMIN_TAX_TOTAL_RATE * 100).toFixed(0)}%
          </p>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              label="Custo Operacional Hoje"
              value={formatBRL(todayAgg.invested)}
              icon={DollarSign}
              badge="parcial"
            />
            <SummaryCard
              label="Faturamento Ontem"
              value={formatBRL(yesterdayAgg.revenue)}
              icon={TrendingUp}
            />
            <SummaryCard
              label="Resultado Líquido Ontem"
              value={formatBRL(yesterdayAgg.result)}
              icon={yesterdayAgg.result >= 0 ? TrendingUp : TrendingDown}
              variant={yesterdayAgg.result >= 0 ? "positive" : "negative"}
            />
            <SummaryCard
              label="Margem Ontem"
              value={formatPct(yesterdayAgg.margin)}
              icon={Percent}
              variant={yesterdayAgg.margin >= 0.3 ? "positive" : yesterdayAgg.margin >= 0 ? "muted" : "negative"}
            />
          </div>

          {/* Comparative Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold">Hoje</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200/50">
                  parcial
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Investido</p>
                  <p className="font-semibold tabular-nums">{formatBRL(todayAgg.invested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="font-semibold tabular-nums">{formatBRL(todayAgg.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxas ({(ADMIN_TAX_TOTAL_RATE * 100).toFixed(0)}%)</p>
                  <p className="font-semibold tabular-nums text-muted-foreground">{formatBRL(todayAgg.tax)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className={`font-semibold tabular-nums ${todayAgg.result < 0 ? "text-red-600" : todayAgg.result > 0 ? "text-emerald-700" : ""}`}>
                    {formatBRL(todayAgg.result)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold">Ontem</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200/50">
                  fechado
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Investido</p>
                  <p className="font-semibold tabular-nums">{formatBRL(yesterdayAgg.invested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="font-semibold tabular-nums">{formatBRL(yesterdayAgg.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxas ({(ADMIN_TAX_TOTAL_RATE * 100).toFixed(0)}%)</p>
                  <p className="font-semibold tabular-nums text-muted-foreground">{formatBRL(yesterdayAgg.tax)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className={`font-semibold tabular-nums ${yesterdayAgg.result < 0 ? "text-red-600" : yesterdayAgg.result > 0 ? "text-emerald-700" : ""}`}>
                    {formatBRL(yesterdayAgg.result)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Employee Table */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Por Funcionário</h2>
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Nome</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Custo Hoje</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Fat. Ontem</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                        Nenhum registro hoje ou ontem.
                      </td>
                    </tr>
                  ) : (
                    employeeRows.map((row, idx) => (
                      <tr key={row.closerId} className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => openPanel(row.closerId, row.nome, yesterday)}
                            className="text-xs font-medium text-primary hover:underline underline-offset-2 cursor-pointer"
                          >
                            {row.nome}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(row.todayInvested)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(row.yesterdayRevenue)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${row.result < 0 ? "text-red-600" : row.result > 0 ? "text-emerald-700" : ""}`}>
                          {formatBRL(row.result)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Daily History */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Histórico Diário</h2>
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Data</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Faturamento Bruto</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Investido</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxas (5%)</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Resultado Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {historyDays.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                        Sem histórico disponível.
                      </td>
                    </tr>
                  ) : (
                    historyDays.map((day, idx) => (
                      <tr key={day.date} className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
                        <td className="py-2.5 px-4 text-xs font-medium">{formatDateLabel(day.date)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(day.revenue)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(day.invested)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(day.tax)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${day.result < 0 ? "text-red-600" : day.result > 0 ? "text-emerald-700" : ""}`}>
                          {formatBRL(day.result)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Closer Detail Panel */}
      <CloserDayPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        closerId={panelCloserId}
        closerNome={panelCloserNome}
        date={panelDate}
      />
    </div>
  );
}
