import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trophy, TrendingUp, TrendingDown, Medal } from "lucide-react";
import { PLATFORM_FEE_RATE } from "@/lib/constants";
import { getFeeLabel } from "@/hooks/useTeamFeeRate";

interface CloserProfile {
  id: string;
  nome: string;
  commission_rate: number;
}

interface DailyRecord {
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
  date: string;
}

interface RankingEntry {
  closerId: string;
  nome: string;
  investido: number;
  faturamento: number;
  taxa: number;
  lucro: number;
  comissao: number;
  lucroLiquido: number;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getWeekRange(date: Date): { start: string; end: string; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().split("T")[0];
  const fmtLabel = (dt: Date) =>
    dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return {
    start: fmt(monday),
    end: fmt(sunday),
    label: `${fmtLabel(monday)} — ${fmtLabel(sunday)}`,
  };
}

function getWeekOptions(): { value: string; label: string; start: string; end: string }[] {
  const options: { value: string; label: string; start: string; end: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const range = getWeekRange(d);
    const value = range.start;
    if (options.some((o) => o.value === value)) continue;
    options.push({
      value,
      label: i === 0 ? `Semana atual (${range.label})` : range.label,
      start: range.start,
      end: range.end,
    });
  }
  return options;
}

export default function RankingSemanal() {
  const [loading, setLoading] = useState(true);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]?.value || "");

  const currentWeekOption = weekOptions.find((w) => w.value === selectedWeek);

  // Fetch closers
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, commission_rate")
        .order("nome");
      setClosers((data as any as CloserProfile[]) || []);
    };
    fetch();
  }, []);

  // Fetch records for selected week
  useEffect(() => {
    if (!currentWeekOption) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("daily_influencer_records")
        .select("closer_id, valor_pago, faturamento, date")
        .gte("date", currentWeekOption.start)
        .lte("date", currentWeekOption.end)
        .is("deleted_at", null);
      setRecords((data as any as DailyRecord[]) || []);
      setLoading(false);
    };
    fetch();
  }, [currentWeekOption?.start, currentWeekOption?.end]);

  // Build ranking
  const ranking = useMemo(() => {
    const closerMap = new Map(closers.map((c) => [c.id, c]));
    const aggMap = new Map<string, { investido: number; faturamento: number }>();

    records.forEach((r) => {
      const existing = aggMap.get(r.closer_id) || { investido: 0, faturamento: 0 };
      existing.investido += Number(r.valor_pago) || 0;
      existing.faturamento += Number(r.faturamento) || 0;
      aggMap.set(r.closer_id, existing);
    });

    const entries: RankingEntry[] = [];
    aggMap.forEach((agg, closerId) => {
      const closer = closerMap.get(closerId);
      if (!closer) return;
      const taxa = agg.faturamento * PLATFORM_FEE_RATE;
      const lucro = agg.faturamento - agg.investido - taxa;
      const comissao = lucro > 0 ? lucro * closer.commission_rate : 0;
      const lucroLiquido = lucro - comissao;
      entries.push({
        closerId,
        nome: closer.nome,
        investido: agg.investido,
        faturamento: agg.faturamento,
        taxa,
        lucro,
        comissao,
        lucroLiquido,
      });
    });

    return entries.sort((a, b) => b.lucro - a.lucro);
  }, [records, closers]);

  const medalColor = (idx: number) => {
    if (idx === 0) return "text-amber-500";
    if (idx === 1) return "text-gray-400";
    if (idx === 2) return "text-amber-700";
    return "text-muted-foreground/30";
  };

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[280px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro encontrado nesta semana.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-border/60 text-foreground"
                  style={{ backgroundColor: "#E9E9EA" }}
                >
                  <th className="text-center py-2.5 px-3 font-semibold text-xs tracking-wide uppercase w-12">
                    #
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Closer
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Investido
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Faturado
                  </th>
                   <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    {getFeeLabel(PLATFORM_FEE_RATE)}
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Lucro
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry, idx) => {
                  const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                  const profitColor =
                    entry.lucroLiquido > 0
                      ? "text-emerald-700"
                      : entry.lucroLiquido < 0
                        ? "text-red-600"
                        : "";
                  return (
                    <tr
                      key={entry.closerId}
                      className={`border-b border-border/20 ${zebraClass}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        {idx < 3 ? (
                          <Medal className={`h-4 w-4 mx-auto ${medalColor(idx)}`} />
                        ) : (
                          <span className="text-xs text-muted-foreground">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm font-medium">{entry.nome}</td>
                      <td className="py-2.5 px-4 text-xs text-right tabular-nums">
                        {formatBRL(entry.investido)}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-right tabular-nums">
                        {formatBRL(entry.faturamento)}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-right tabular-nums text-muted-foreground">
                        {formatBRL(entry.taxa)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-xs text-right tabular-nums font-medium ${
                          entry.lucro > 0 ? "text-emerald-700" : entry.lucro < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {formatBRL(entry.lucro)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  className="border-t border-border/60 font-semibold text-foreground"
                  style={{ backgroundColor: "#E9E9EA" }}
                >
                  <td className="py-3 px-3" />
                  <td className="py-3 px-4 text-xs">Total</td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums">
                    {formatBRL(ranking.reduce((s, e) => s + e.investido, 0))}
                  </td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums">
                    {formatBRL(ranking.reduce((s, e) => s + e.faturamento, 0))}
                  </td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums text-muted-foreground">
                    {formatBRL(ranking.reduce((s, e) => s + e.taxa, 0))}
                  </td>
                  <td
                    className={`py-3 px-4 text-xs text-right tabular-nums font-medium ${
                      ranking.reduce((s, e) => s + e.lucro, 0) >= 0
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    {formatBRL(ranking.reduce((s, e) => s + e.lucro, 0))}
                  </td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums">
                    {formatBRL(ranking.reduce((s, e) => s + e.comissao, 0))}
                  </td>
                  <td
                    className={`py-3 px-4 text-xs text-right tabular-nums font-semibold ${
                      ranking.reduce((s, e) => s + e.lucroLiquido, 0) >= 0
                        ? "text-emerald-700"
                        : "text-red-600"
                    }`}
                  >
                    {formatBRL(ranking.reduce((s, e) => s + e.lucroLiquido, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
