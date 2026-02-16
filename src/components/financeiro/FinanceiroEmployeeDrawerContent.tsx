import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Percent, Receipt, Wallet } from "lucide-react";
import { PLATFORM_FEE_RATE, PLATFORM_FEE_LABEL } from "@/lib/constants";

interface DailyRecord {
  id: string;
  date: string;
  valor_pago: number;
  faturamento: number | null;
}

interface CloserProfile {
  id: string;
  nome: string;
  commission_rate: number;
}

interface DaySummary {
  date: string;
  invested: number;
  revenue: number;
  fee: number;
  profit: number;
  commission: number;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthOptions() {
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

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default function FinanceiroEmployeeDrawerContent({ closerId }: { closerId: string }) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [closer, setCloser] = useState<CloserProfile | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nome, commission_rate")
      .eq("id", closerId)
      .single()
      .then(({ data }) => {
        if (data) setCloser(data as any as CloserProfile);
      });
  }, [closerId]);

  useEffect(() => {
    if (!closerId || !selectedMonth) return;
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, "0")}`;

    supabase
      .from("daily_influencer_records")
      .select("id, date, valor_pago, faturamento")
      .eq("closer_id", closerId)
      .gte("date", startDate)
      .lte("date", endDate)
      .is("deleted_at", null)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setRecords((data as any as DailyRecord[]) || []);
        setLoading(false);
      });
  }, [closerId, selectedMonth]);

  const commissionRate = closer?.commission_rate ?? 0.1;

  const totals = useMemo(() => {
    let invested = 0, revenue = 0;
    records.forEach((r) => {
      invested += Number(r.valor_pago) || 0;
      revenue += Number(r.faturamento) || 0;
    });
    const fee = revenue * PLATFORM_FEE_RATE;
    const profit = revenue - invested - fee;
    const commission = profit > 0 ? profit * commissionRate : 0;
    const saldo = profit - commission;
    return { invested, revenue, fee, profit, commission, saldo };
  }, [records, commissionRate]);

  const dailySummaries = useMemo(() => {
    const map = new Map<string, { invested: number; revenue: number }>();
    records.forEach((r) => {
      const e = map.get(r.date) || { invested: 0, revenue: 0 };
      e.invested += Number(r.valor_pago) || 0;
      e.revenue += Number(r.faturamento) || 0;
      map.set(r.date, e);
    });
    const summaries: DaySummary[] = [];
    map.forEach((val, date) => {
      const fee = val.revenue * PLATFORM_FEE_RATE;
      const profit = val.revenue - val.invested - fee;
      const commission = profit > 0 ? profit * commissionRate : 0;
      summaries.push({ date, invested: val.invested, revenue: val.revenue, fee, profit, commission });
    });
    return summaries.sort((a, b) => b.date.localeCompare(a.date)); // most recent first
  }, [records, commissionRate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Month selector */}
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum registro neste período.</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-2">
            <MiniCard icon={TrendingUp} label="Faturamento" value={totals.revenue} />
            <MiniCard icon={DollarSign} label="Investido" value={totals.invested} />
            <MiniCard
              icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
              label="Resultado"
              value={totals.profit}
              variant={totals.profit >= 0 ? "positive" : "negative"}
            />
            <MiniCard icon={Receipt} label="Comissão" value={totals.commission} />
            <MiniCard icon={Percent} label={PLATFORM_FEE_LABEL} value={totals.fee} variant="muted" />
            {isAdmin && (
              <MiniCard
                icon={Wallet}
                label="Saldo Final"
                value={totals.saldo}
                variant={totals.saldo >= 0 ? "positive" : "negative"}
              />
            )}
          </div>

          {/* Day cards */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dias ({dailySummaries.length})
            </p>
            {dailySummaries.map((day, idx) => {
              const isPositive = day.profit >= 0;
              const isLatest = idx === 0;

              return (
                <div
                  key={day.date}
                  className={`rounded-lg border border-border/40 overflow-hidden transition-colors ${
                    isLatest ? "bg-muted/40" : "bg-card"
                  }`}
                >
                  <div className="flex">
                    {/* Left color bar */}
                    <div className={`w-1 shrink-0 ${isPositive ? "bg-emerald-500" : "bg-red-500"}`} />

                    <div className="flex-1 px-3 py-2.5 space-y-1">
                      {/* Primary line */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{formatDateLabel(day.date)}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold tabular-nums ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
                            {formatBRL(day.profit)}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 ${
                              isPositive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {isPositive ? "+" : "−"}
                          </Badge>
                        </div>
                      </div>

                      {/* Secondary line */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                        <span>Fat: {formatBRL(day.revenue)}</span>
                        <span>Taxas: {formatBRL(day.fee)}</span>
                        <span>Com: {formatBRL(day.commission)}</span>
                        <span>Inv: {formatBRL(day.invested)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total footer */}
          <div className="rounded-lg border border-border/60 px-3 py-2.5" style={{ backgroundColor: "#E9E9EA" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide">Total do mês</span>
              <span className={`text-sm font-bold tabular-nums ${totals.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatBRL(totals.profit)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: any;
  label: string;
  value: number;
  variant?: "default" | "positive" | "negative" | "muted";
}) {
  const colorMap = {
    default: "",
    positive: "text-emerald-700",
    negative: "text-red-600",
    muted: "text-muted-foreground",
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2 space-y-0.5">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold tabular-nums ${colorMap[variant]}`}>{formatBRL(value)}</p>
    </div>
  );
}
