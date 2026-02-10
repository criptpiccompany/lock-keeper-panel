import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Percent, Receipt, Wallet } from "lucide-react";

interface DailyRecord {
  id: string;
  date: string;
  influencer_id: string;
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
  comprovante_url: string;
}

interface CloserProfile {
  id: string;
  nome: string;
  commission_rate: number;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

interface DaySummary {
  date: string;
  invested: number;
  revenue: number;
  fee: number;
  profit: number;
  commission: number;
  saldo: number;
}

export default function Balanco({ closerId }: { closerId?: string }) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>(closerId || "");

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch closers (admin sees all, closer sees only self)
  useEffect(() => {
    const fetchClosers = async () => {
      if (!user) return;
      if (closerId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .eq("id", closerId)
          .single();
        if (data) {
          setClosers([data as any as CloserProfile]);
          setSelectedCloserId(closerId);
        }
        return;
      }
      if (isAdmin) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .order("nome");
        setClosers((data as any as CloserProfile[]) || []);
        if (!selectedCloserId && data && data.length > 0) {
          setSelectedCloserId(data[0].id);
        }
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .eq("id", user.id)
          .single();
        if (data) {
          setClosers([data as any as CloserProfile]);
          setSelectedCloserId(user.id);
        }
      }
    };
    fetchClosers();
  }, [user, isAdmin, closerId]);

  // Fetch records for selected closer + month
  useEffect(() => {
    const fetchRecords = async () => {
      if (!selectedCloserId || !selectedMonth) return;
      setLoading(true);

      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, "0")}`;

      const { data } = await supabase
        .from("daily_influencer_records")
        .select("id, date, influencer_id, closer_id, valor_pago, faturamento, comprovante_url")
        .eq("closer_id", selectedCloserId)
        .gte("date", startDate)
        .lte("date", endDateStr)
        .is("deleted_at", null)
        .order("date", { ascending: true });

      setRecords((data as any as DailyRecord[]) || []);
      setLoading(false);
    };
    fetchRecords();
  }, [selectedCloserId, selectedMonth]);

  const currentCloser = closers.find((c) => c.id === selectedCloserId);
  const commissionRate = currentCloser?.commission_rate ?? 0.1;

  // Aggregate totals
  const totals = useMemo(() => {
    let invested = 0;
    let revenue = 0;
    records.forEach((r) => {
      invested += Number(r.valor_pago) || 0;
      revenue += Number(r.faturamento) || 0;
    });
    const fee = revenue * 0.1;
    const profit = revenue - invested - fee;
    const commission = profit > 0 ? profit * commissionRate : 0;
    const saldo = profit - commission;
    return { invested, revenue, fee, profit, commission, saldo };
  }, [records, commissionRate]);

  // Daily breakdown grouped by date
  const dailySummaries = useMemo(() => {
    const map = new Map<string, { invested: number; revenue: number }>();
    records.forEach((r) => {
      const existing = map.get(r.date) || { invested: 0, revenue: 0 };
      existing.invested += Number(r.valor_pago) || 0;
      existing.revenue += Number(r.faturamento) || 0;
      map.set(r.date, existing);
    });

    const summaries: DaySummary[] = [];
    map.forEach((val, date) => {
      const fee = val.revenue * 0.1;
      const profit = val.revenue - val.invested - fee;
      const commission = profit > 0 ? profit * commissionRate : 0;
      const saldo = profit - commission;
      summaries.push({ date, invested: val.invested, revenue: val.revenue, fee, profit, commission, saldo });
    });
    return summaries.sort((a, b) => a.date.localeCompare(b.date));
  }, [records, commissionRate]);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!closerId && isAdmin && closers.length > 1 && (
          <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {currentCloser && (
          <span className="text-xs text-muted-foreground ml-auto">
            Comissão: {(commissionRate * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado para este período.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className={`grid grid-cols-2 md:grid-cols-3 ${isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3`}>
            <SummaryCard label="Faturamento" value={totals.revenue} icon={TrendingUp} />
            <SummaryCard label="Investido" value={totals.invested} icon={DollarSign} />
            <SummaryCard label="Taxa 10%" value={totals.fee} icon={Percent} variant="muted" />
            <SummaryCard
              label="Resultado"
              value={totals.profit}
              icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
              variant={totals.profit > 0 ? (totals.profit / totals.invested >= 0.3 ? "positive" : "warning") : "negative"}
            />
            <SummaryCard label="Comissão" value={totals.commission} icon={Receipt} />
            {isAdmin && (
              <SummaryCard
                label="Saldo Final"
                value={totals.saldo}
                icon={Wallet}
                variant={totals.saldo >= 0 ? "positive" : "negative"}
              />
            )}
          </div>

          {/* Daily Breakdown Table */}
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: '#E9E9EA' }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Data</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Investido</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Faturado</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Taxa 10%</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Resultado</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Comissão</th>
                    {isAdmin && <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">Saldo</th>}
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((day, idx) => {
                    const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                    const profitColor = day.profit > 0
                      ? (day.invested > 0 && day.profit / day.invested >= 0.3 ? "text-emerald-700" : "text-amber-700")
                      : day.profit < 0 ? "text-red-600" : "";

                    return (
                      <tr key={day.date} className={`border-b border-border/20 ${zebraClass}`}>
                        <td className="py-2.5 px-4 text-xs font-medium">{formatDateLabel(day.date)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(day.invested)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(day.revenue)}</td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(day.fee)}</td>
                        <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${profitColor}`}>
                          {formatBRL(day.profit)}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-right tabular-nums">{formatBRL(day.commission)}</td>
                        {isAdmin && (
                          <td className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${day.saldo < 0 ? "text-red-600" : ""}`}>
                            {formatBRL(day.saldo)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 font-semibold text-foreground" style={{ backgroundColor: '#E9E9EA' }}>
                    <td className="py-3 px-4 text-xs">Total</td>
                    <td className="py-3 px-4 text-xs text-right tabular-nums">{formatBRL(totals.invested)}</td>
                    <td className="py-3 px-4 text-xs text-right tabular-nums">{formatBRL(totals.revenue)}</td>
                    <td className="py-3 px-4 text-xs text-right tabular-nums text-muted-foreground">{formatBRL(totals.fee)}</td>
                    <td className={`py-3 px-4 text-xs text-right tabular-nums ${totals.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {formatBRL(totals.profit)}
                    </td>
                    <td className="py-3 px-4 text-xs text-right tabular-nums">{formatBRL(totals.commission)}</td>
                    {isAdmin && (
                      <td className={`py-3 px-4 text-xs text-right tabular-nums ${totals.saldo < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatBRL(totals.saldo)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Summary Card ---

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: any;
  variant?: "default" | "positive" | "negative" | "warning" | "muted";
}) {
  const colorMap = {
    default: "",
    positive: "text-emerald-700",
    negative: "text-red-600",
    warning: "text-amber-700",
    muted: "text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${colorMap[variant]}`}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
