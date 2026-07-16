import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { DAILY_FEE_LABEL, DAILY_FEE_RATE } from "@/lib/constants";
import { CommissionCardCarousel } from "@/components/home/CommissionCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DailyRecord {
  id: string;
  day: number;
  diaria_cents: number;
  faturamento_cents: number;
}

interface CloserProfile {
  id: string;
  nome: string;
  team_id: string | null;
}

interface DayBalance {
  day: number;
  date: string;
  paymentCents: number;
  revenueCents: number;
}

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function formatSheetValue(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSummaryValue(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
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
  const [selectedCloserId, setSelectedCloserId] = useState(closerId || "");

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const currentCloser = closers.find((closer) => closer.id === selectedCloserId);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate();

  useEffect(() => {
    const fetchClosers = async () => {
      if (!user) return;
      if (closerId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, team_id")
          .eq("id", closerId)
          .single();
        if (data) {
          setClosers([data as CloserProfile]);
          setSelectedCloserId(closerId);
        }
        return;
      }
      if (isAdmin) {
        const { data } = await supabase.from("profiles").select("id, nome, team_id").order("nome");
        const available = (data as CloserProfile[] | null) ?? [];
        setClosers(available);
        if (!selectedCloserId && available.length > 0) setSelectedCloserId(available[0].id);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, team_id")
        .eq("id", user.id)
        .single();
      if (data) {
        setClosers([data as CloserProfile]);
        setSelectedCloserId(user.id);
      }
    };
    void fetchClosers();
  }, [closerId, isAdmin, selectedCloserId, user]);

  useEffect(() => {
    if (!selectedCloserId) return;
    let active = true;

    const fetchRecords = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("planilha_beta")
        .select("id, day, diaria_cents, faturamento_cents")
        .eq("closer_id", selectedCloserId)
        .eq("year", selectedYear)
        .eq("month", selectedMonthNumber)
        .order("day", { ascending: true });
      if (!active) return;
      setRecords((data as DailyRecord[] | null) ?? []);
      setLoading(false);
    };

    void fetchRecords();
    const channel = supabase
      .channel(`balanco-sheet-${selectedCloserId}-${selectedMonth}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planilha_beta", filter: `closer_id=eq.${selectedCloserId}` },
        () => void fetchRecords(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedCloserId, selectedMonth, selectedMonthNumber, selectedYear]);

  const dailyBalances = useMemo<DayBalance[]>(() => {
    const values = new Map<number, { paymentCents: number; revenueCents: number }>();
    records.forEach((record) => {
      const day = record.day;
      const current = values.get(day) ?? { paymentCents: 0, revenueCents: 0 };
      current.paymentCents += Number(record.diaria_cents) || 0;
      current.revenueCents += Number(record.faturamento_cents) || 0;
      values.set(day, current);
    });
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const value = values.get(day) ?? { paymentCents: 0, revenueCents: 0 };
      return {
        day,
        date: `${String(day).padStart(2, "0")}/${String(selectedMonthNumber).padStart(2, "0")}/${selectedYear}`,
        ...value,
      };
    });
  }, [daysInMonth, records, selectedMonthNumber, selectedYear]);

  const totals = useMemo(() => {
    const paymentCents = dailyBalances.reduce((sum, day) => sum + day.paymentCents, 0);
    const revenueCents = dailyBalances.reduce((sum, day) => sum + day.revenueCents, 0);
    const feeCents = Math.round(revenueCents * DAILY_FEE_RATE);
    const resultCents = revenueCents - paymentCents - feeCents;
    return { paymentCents, revenueCents, feeCents, resultCents };
  }, [dailyBalances]);

  const { currentPercentage, loading: tierLoading } = useCommissionTier(totals.resultCents / 100);
  const commissionCents = Math.round(
    getEstimatedCommission(totals.resultCents / 100, currentPercentage) * 100,
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="flex h-[72px] items-center justify-end gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4 text-sm shadow-sm sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!closerId && isAdmin && closers.length > 1 && (
          <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4 text-sm shadow-sm sm:w-[220px]">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>{closer.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <section
        className="relative mx-[26px] w-[calc(100%-52px)] overflow-hidden rounded-2xl border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] font-[Poppins] shadow-sm"
        style={{
          "--sheet-title": "#000000",
          "--sheet-cell": "#ffffff",
          "--sheet-grid": "#c4c7c5",
          "--sheet-header": "#1f9d55",
          "--sheet-result-header": "#fbbc04",
          "--sheet-result-positive": "#b7e1cd",
          "--sheet-result-warning": "#fce8b2",
          "--sheet-result-negative": "#f4c7c3",
          "--sheet-roi-negative": "#c2413b",
        } as React.CSSProperties}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/75 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="grid min-w-[1280px] grid-cols-[540px_1fr] gap-7 p-0">
            <table className="w-full table-fixed border-collapse font-[Poppins]">
              <thead>
                <tr>
                  <th colSpan={3} className="h-[72px] border border-[var(--sheet-grid)] bg-[var(--sheet-title)] text-[36px] font-extrabold tracking-[-0.02em] text-white">
                    {MONTHS_PT[selectedMonthNumber - 1]}
                  </th>
                </tr>
                <tr className="h-[64px] bg-[var(--sheet-header)] text-[19px] font-extrabold uppercase text-white">
                  <th className="border border-[var(--sheet-grid)]">Data</th>
                  <th className="border border-[var(--sheet-grid)]">Pagamento</th>
                  <th className="border border-[var(--sheet-grid)]">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {dailyBalances.map((day) => (
                  <tr key={day.day} className="h-[21px] text-[15px] font-normal">
                    <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-2 text-center font-semibold tabular-nums text-black">{day.date}</td>
                    <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-negative)] px-2 text-center tabular-nums text-black">{formatSheetValue(day.paymentCents)}</td>
                    <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-positive)] px-2 text-center tabular-nums text-black">{formatSheetValue(day.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div>
              <div className="flex h-[72px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-title)] text-[36px] font-extrabold tracking-[-0.02em] text-white">
                TOTAL
              </div>
              <div className="grid grid-cols-5">
                {["Faturamento", "Gastos", DAILY_FEE_LABEL, "Balanço Geral", `Comissão (${tierLoading ? "—" : `${currentPercentage}%`})`].map((label) => (
                  <div key={label} className="flex h-[64px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-header)] px-3 text-center text-[19px] font-extrabold uppercase leading-tight text-white">
                    {label}
                  </div>
                ))}
                <div className="flex h-[70px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3 text-[27px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--sheet-header)]">
                  {formatSummaryValue(totals.revenueCents)}
                </div>
                <div className="flex h-[70px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3 text-[27px] font-extrabold tabular-nums tracking-[-0.02em] text-[var(--sheet-roi-negative)]">
                  {formatSummaryValue(totals.paymentCents)}
                </div>
                <div className="flex h-[70px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3 text-[25px] font-semibold tabular-nums tracking-[-0.02em] text-black">
                  {formatSummaryValue(totals.feeCents)}
                </div>
                <div className="flex h-[70px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3 text-[25px] font-semibold tabular-nums tracking-[-0.02em] text-black">
                  {formatSummaryValue(totals.resultCents)}
                </div>
                <div className="flex h-[70px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3 text-[25px] font-semibold tabular-nums tracking-[-0.02em] text-black">
                  {tierLoading ? "—" : formatSummaryValue(commissionCents)}
                </div>
              </div>

              <section className="mt-6 rounded-[28px] border border-border bg-background p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nível de comissão</span>
                  <h2 className="text-[15px] font-bold uppercase text-foreground">
                    Performance de {currentCloser?.nome || user.nome}
                  </h2>
                </div>
                <CommissionCardCarousel
                  employeeName={currentCloser?.nome || user.nome}
                  resultado={totals.resultCents / 100}
                  revenue={totals.revenueCents / 100}
                />
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
