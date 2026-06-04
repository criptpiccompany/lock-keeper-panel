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
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import { cn } from "@/lib/utils";

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
  const { feeRate, feeLabel } = useTeamFeeRate(user?.teamId);
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

  // Aggregate totals
  const totals = useMemo(() => {
    let invested = 0;
    let revenue = 0;
    records.forEach((r) => {
      invested += Number(r.valor_pago) || 0;
      revenue += Number(r.faturamento) || 0;
    });
    const fee = revenue * feeRate;
    const profit = revenue - invested - fee;
    return { invested, revenue, fee, profit };
  }, [records, feeRate]);

  // Use tier-based percentage for commission (single source of truth)
  const { currentPercentage, loading: tierLoading } = useCommissionTier(totals.profit);
  const tierCommission = getEstimatedCommission(totals.profit, currentPercentage);
  const saldo = totals.profit - tierCommission;

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
      const fee = val.revenue * feeRate;
      const profit = val.revenue - val.invested - fee;
      const commission = getEstimatedCommission(profit, currentPercentage);
      const saldo = profit - commission;
      summaries.push({ date, invested: val.invested, revenue: val.revenue, fee, profit, commission, saldo });
    });
    return summaries.sort((a, b) => a.date.localeCompare(b.date));
  }, [records, currentPercentage]);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#676767]">
              <Wallet className="h-3.5 w-3.5" />
              Financial Balance
            </div>
            <div>
              <h2 className="text-[34px] font-medium tracking-[-0.06em] text-foreground sm:text-[42px]">
                {monthOptions.find((o) => o.value === selectedMonth)?.label || "Balanço"}
              </h2>
              <p className="mt-2 text-[14px] text-[#6e6e73]">
                Leitura consolidada do mês com investimento, taxa, resultado e comissão.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-11 w-full rounded-full border-[#ececeb] bg-white px-4 text-sm shadow-none md:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentCloser && (
                <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                  Comissão atual: <span className="ml-1 text-[#1f1f1f]">{currentPercentage}%</span>
                </div>
              )}

              {!closerId && isAdmin && closers.length > 1 && (
                <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                  <SelectTrigger className="h-11 w-full rounded-full border-[#ececeb] bg-white px-4 text-sm shadow-none md:w-[210px]">
                    <SelectValue placeholder="Selecionar closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[28px] bg-white py-20 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-[28px] bg-white py-20 text-center text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado para este período.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Termômetro</div>
                  <div className="mt-1 text-[28px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Performance do mês</div>
                </div>
                <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                  {records.length} registros
                </div>
              </div>
              <UnifiedThermometerWidget resultado={totals.profit} month={selectedMonth} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard label="Faturamento" value={totals.revenue} icon={TrendingUp} />
                <SummaryCard label="Investido" value={totals.invested} icon={DollarSign} />
                <SummaryCard label={feeLabel} value={totals.fee} icon={Percent} variant="muted" />
                <SummaryCard
                  label="Resultado"
                  value={totals.profit}
                  icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
                  variant={totals.profit > 0 ? (totals.profit / totals.invested >= 0.3 ? "positive" : "warning") : "negative"}
                />
                <SummaryCard label="Comissão" value={tierCommission} icon={Receipt} />
                {isAdmin ? (
                <SummaryCard
                  label="Saldo Final"
                  value={saldo}
                  icon={Wallet}
                  variant={saldo >= 0 ? "positive" : "negative"}
                />
                ) : (
                  <SummaryCard label="Saldo Final" value={totals.profit - tierCommission} icon={Wallet} variant={totals.profit - tierCommission >= 0 ? "positive" : "negative"} />
                )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <div className="mb-3 flex items-center justify-between px-2 pt-2">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Quebra diária</div>
                <div className="mt-1 text-[24px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Dias do mês</div>
              </div>
              <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                {dailySummaries.length} dias com movimento
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Data</th>
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Investido</th>
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Faturado</th>
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">{feeLabel}</th>
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Resultado</th>
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Comissão</th>
                    {isAdmin && <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Saldo</th>}
                  </tr>
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="px-5">
                      <div className="border-b border-dashed border-[#e6ddb0]" />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((day, idx) => {
                    const zebraClass = idx % 2 === 1 ? "bg-[#fbfbf8]" : "bg-white";
                    const profitColor = day.profit > 0
                      ? (day.invested > 0 && day.profit / day.invested >= 0.3 ? "text-emerald-700" : "text-amber-700")
                      : day.profit < 0 ? "text-red-600" : "";

                    return (
                      <tr key={day.date} className={zebraClass}>
                        <td className="px-5 py-4 text-[13px] font-medium text-[#1f1f1f]">{formatDateLabel(day.date)}</td>
                        <td className="px-4 py-4 text-right text-[13px] tabular-nums text-[#2c2c2c]">{formatBRL(day.invested)}</td>
                        <td className="px-4 py-4 text-right text-[13px] tabular-nums text-[#2c2c2c]">{formatBRL(day.revenue)}</td>
                        <td className="px-4 py-4 text-right text-[13px] tabular-nums text-[#7b7b78]">{formatBRL(day.fee)}</td>
                        <td className={`px-4 py-4 text-right text-[13px] tabular-nums font-medium ${profitColor}`}>
                          {formatBRL(day.profit)}
                        </td>
                        <td className="px-4 py-4 text-right text-[13px] tabular-nums text-[#2c2c2c]">{formatBRL(day.commission)}</td>
                        {isAdmin && (
                          <td className={`px-4 py-4 text-right text-[13px] tabular-nums font-medium ${day.saldo < 0 ? "text-red-600" : "text-[#2c2c2c]"}`}>
                            {formatBRL(day.saldo)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ececeb] bg-[#f5f5f2] font-semibold text-foreground">
                    <td className="px-5 py-4 text-[13px]">Total</td>
                    <td className="px-4 py-4 text-right text-[13px] tabular-nums">{formatBRL(totals.invested)}</td>
                    <td className="px-4 py-4 text-right text-[13px] tabular-nums">{formatBRL(totals.revenue)}</td>
                    <td className="px-4 py-4 text-right text-[13px] tabular-nums text-[#7b7b78]">{formatBRL(totals.fee)}</td>
                    <td className={`px-4 py-4 text-right text-[13px] tabular-nums ${totals.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {formatBRL(totals.profit)}
                    </td>
                    <td className="px-4 py-4 text-right text-[13px] tabular-nums">{formatBRL(tierCommission)}</td>
                    {isAdmin && (
                      <td className={`px-4 py-4 text-right text-[13px] tabular-nums ${saldo < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {formatBRL(saldo)}
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
    default: "text-[#1f1f1f]",
    positive: "text-emerald-700",
    negative: "text-red-600",
    warning: "text-amber-700",
    muted: "text-[#7b7b78]",
  };

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#f3f3ef] text-[#6e6e73]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[13px] font-medium text-[#7b7b78]">{label}</span>
      </div>
      <p className={cn("mt-4 text-[20px] font-semibold tracking-[-0.04em] tabular-nums", colorMap[variant])}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
