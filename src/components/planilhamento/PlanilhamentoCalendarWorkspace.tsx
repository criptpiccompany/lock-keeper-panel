import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DAILY_FEE_RATE } from "@/lib/constants";
import PlanilhamentoDiario from "./PlanilhamentoDiario";

type ViewMode = "day" | "week" | "month" | "quarter" | "year";

type DailySummary = {
  date: string;
  count: number;
  invested: number;
  revenue: number;
  result: number;
};

const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Ano" },
];

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, date.getMonth(), 1);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

type ResultStatus = "VERDE" | "AMARELO" | "VERMELHO";

function getResultStatus(revenue: number, invested: number): ResultStatus {
  if (!revenue) return "VERMELHO";
  const fee = revenue * DAILY_FEE_RATE;
  const lucro = revenue - invested - fee;
  const margem = invested > 0 ? lucro / invested : null;

  if (lucro <= 0) return "VERMELHO";
  if (margem !== null && margem >= 0.3) return "VERDE";
  return "AMARELO";
}

function resultCardClass(status: ResultStatus) {
  if (status === "VERMELHO") {
    return "bg-[linear-gradient(180deg,#ef5b54_0%,#991b1b_100%)] text-white";
  }
  if (status === "AMARELO") {
    return "bg-[linear-gradient(180deg,#f4cf4f_0%,#c08a18_100%)] text-white";
  }
  return "bg-[linear-gradient(180deg,#77cd31_0%,#0d5d4a_100%)] text-white";
}

function getSummaryStatus(summary?: DailySummary | null): ResultStatus | null {
  if (!summary || !summary.count) return null;
  return getResultStatus(summary.revenue, summary.invested);
}

function dateCircleClass(status: ResultStatus | null, muted?: boolean) {
  if (muted) {
    return "bg-[#f1f1ee] text-[#a1a19c]";
  }
  if (status === "VERMELHO") {
    return "bg-[linear-gradient(180deg,#ef5b54_0%,#991b1b_100%)] text-white";
  }
  if (status === "AMARELO") {
    return "bg-[linear-gradient(180deg,#f4cf4f_0%,#c08a18_100%)] text-[#1f1f1f]";
  }
  if (status === "VERDE") {
    return "bg-[linear-gradient(180deg,#77cd31_0%,#0d5d4a_100%)] text-white";
  }
  return "bg-[#242424] text-white";
}

function getWeekStart(date: Date) {
  const current = startOfDay(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(current, diff);
}

function getMonthMatrix(anchorDate: Date) {
  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = addDays(first, -startOffset);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getRangeForView(anchorDate: Date, mode: ViewMode) {
  if (mode === "day") {
    const day = startOfDay(anchorDate);
    return { start: day, end: day, label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) };
  }

  if (mode === "week") {
    const start = getWeekStart(anchorDate);
    const end = addDays(start, 6);
    return {
      start,
      end,
      label: `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
    };
  }

  if (mode === "month") {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    return {
      start,
      end,
      label: `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`,
    };
  }

  if (mode === "quarter") {
    const quarterStartMonth = Math.floor(anchorDate.getMonth() / 3) * 3;
    const start = new Date(anchorDate.getFullYear(), quarterStartMonth, 1);
    const end = new Date(anchorDate.getFullYear(), quarterStartMonth + 3, 0);
    return {
      start,
      end,
      label: `${MONTH_NAMES[quarterStartMonth]} - ${MONTH_NAMES[quarterStartMonth + 2]} ${anchorDate.getFullYear()}`,
    };
  }

  const start = new Date(anchorDate.getFullYear(), 0, 1);
  const end = new Date(anchorDate.getFullYear(), 11, 31);
  return {
    start,
    end,
    label: String(anchorDate.getFullYear()),
  };
}

function shiftAnchorDate(anchorDate: Date, mode: ViewMode, direction: -1 | 1) {
  if (mode === "day") return addDays(anchorDate, direction);
  if (mode === "week") return addDays(anchorDate, direction * 7);
  if (mode === "month") return addMonths(anchorDate, direction);
  if (mode === "quarter") return addMonths(anchorDate, direction * 3);
  return addYears(anchorDate, direction);
}

function SummaryCell({
  date,
  summary,
  muted,
  onOpen,
}: {
  date: Date;
  summary?: DailySummary;
  muted?: boolean;
  onOpen: (date: Date) => void;
}) {
  const isToday = formatDateKey(date) === formatDateKey(new Date());
  const status = getSummaryStatus(summary);

  return (
    <button
      type="button"
      onClick={() => onOpen(date)}
      className={cn(
        "flex min-h-[120px] flex-col rounded-[22px] border border-[#ececeb] bg-white p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-28px_rgba(15,23,42,0.14)]",
        muted && "bg-[#fafaf8] text-muted-foreground"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={cn(
          "grid h-10 w-10 place-items-center rounded-full text-[15px] font-semibold shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]",
          dateCircleClass(status, muted),
          isToday && !muted && "ring-2 ring-black/[0.06]"
        )}>
          {date.getDate()}
        </span>
        {summary?.count ? (
          <span className="rounded-full bg-[#f3f3ef] px-2 py-1 text-[11px] font-medium text-[#676767]">
            {summary.count} influs
          </span>
        ) : null}
      </div>

      <div className="mt-auto space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-2 text-[#848484]">
          <span>Gasto</span>
          <span className="font-medium text-[#1f1f1f]">{summary ? compactCurrency(summary.invested) : "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[#848484]">
          <span>Faturado</span>
          <span className="font-medium text-[#1f1f1f]">{summary ? compactCurrency(summary.revenue) : "—"}</span>
        </div>
      </div>
    </button>
  );
}

export default function PlanilhamentoCalendarWorkspace({ closerId }: { closerId?: string }) {
  const { user, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Map<string, DailySummary>>(new Map());

  const range = useMemo(() => getRangeForView(anchorDate, viewMode), [anchorDate, viewMode]);
  const selectedDateKey = formatDateKey(anchorDate);
  const selectedMonthKey = formatMonthKey(anchorDate);
  const selectedSummary = summaries.get(selectedDateKey);

  useEffect(() => {
    const fetchSummaries = async () => {
      if (!user) return;

      setLoading(true);
      const targetId = closerId || (!isAdmin ? user.id : undefined);

      let query = supabase
        .from("daily_influencer_records")
        .select("id, date, valor_pago, faturamento")
        .gte("date", formatDateKey(range.start))
        .lte("date", formatDateKey(range.end))
        .is("deleted_at", null);

      if (targetId) {
        query = query.eq("closer_id", targetId);
      }

      const { data } = await query;
      const nextMap = new Map<string, DailySummary>();

      for (const row of data || []) {
        const date = row.date as string;
        const current = nextMap.get(date) || { date, count: 0, invested: 0, revenue: 0, result: 0 };
        const invested = Number((row as any).valor_pago) || 0;
        const revenue = Number((row as any).faturamento) || 0;

        current.count += 1;
        current.invested += invested;
        current.revenue += revenue;
        current.result += revenue - invested;
        nextMap.set(date, current);
      }

      setSummaries(nextMap);
      setLoading(false);
    };

    fetchSummaries();
  }, [user, closerId, isAdmin, range.start, range.end]);

  const totalSummary = useMemo(() => {
    return Array.from(summaries.values()).reduce(
      (acc, item) => {
        acc.count += item.count;
        acc.invested += item.invested;
        acc.revenue += item.revenue;
        acc.result += item.result;
        return acc;
      },
      { count: 0, invested: 0, revenue: 0, result: 0 }
    );
  }, [summaries]);

  const resultStatus = useMemo(() => {
    const revenue = viewMode === "day" ? selectedSummary?.revenue || 0 : totalSummary.revenue;
    const invested = viewMode === "day" ? selectedSummary?.invested || 0 : totalSummary.invested;
    return getResultStatus(revenue, invested);
  }, [viewMode, selectedSummary, totalSummary]);

  const weekDays = useMemo(() => {
    const start = getWeekStart(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchorDate]);

  const monthMatrix = useMemo(() => getMonthMatrix(anchorDate), [anchorDate]);

  const quarterMonths = useMemo(() => {
    const quarterStartMonth = Math.floor(anchorDate.getMonth() / 3) * 3;
    return [0, 1, 2].map((offset) => new Date(anchorDate.getFullYear(), quarterStartMonth + offset, 1));
  }, [anchorDate]);

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => new Date(anchorDate.getFullYear(), index, 1));
  }, [anchorDate]);

  const openDate = (date: Date) => {
    setAnchorDate(startOfDay(date));
    setViewMode("day");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#676767]">
              <Sparkles className="h-3.5 w-3.5" />
              Calendar Workspace
            </div>
            <div>
              <h2 className="text-[34px] font-medium tracking-[-0.06em] text-foreground sm:text-[42px]">
                {viewMode === "day"
                  ? new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
                  : range.label}
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="inline-flex items-center gap-2 rounded-[20px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
              <div className="flex items-center gap-[6px] pr-2">
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-[#ececeb] shadow-none" onClick={() => setAnchorDate(shiftAnchorDate(anchorDate, viewMode, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-[#ececeb] shadow-none" onClick={() => setAnchorDate(shiftAnchorDate(anchorDate, viewMode, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-10 rounded-full border-[#ececeb] px-4 shadow-none" onClick={() => setAnchorDate(startOfDay(new Date()))}>
                  Hoje
                </Button>
              </div>
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-[13px] font-medium tracking-[-0.01em] transition-colors",
                    viewMode === mode.id ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-medium text-[#848484]">Influs fechados</div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.05em] text-[#1f1f1f]">
              {viewMode === "day" ? selectedSummary?.count || 0 : totalSummary.count}
            </div>
          </div>
          <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-medium text-[#848484]">Gasto</div>
            <div className="mt-2 inline-flex items-center gap-2 text-[28px] font-semibold tracking-[-0.05em] text-[#1f1f1f]">
              <ArrowDown className="h-4 w-4 text-[#848484]" />
              {viewMode === "day" ? formatCurrency(selectedSummary?.invested || 0) : formatCurrency(totalSummary.invested)}
            </div>
          </div>
          <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="text-[12px] font-medium text-[#848484]">Faturado</div>
            <div className="mt-2 inline-flex items-center gap-2 text-[28px] font-semibold tracking-[-0.05em] text-[#1f1f1f]">
              <ArrowUp className="h-4 w-4 text-[#848484]" />
              {viewMode === "day" ? formatCurrency(selectedSummary?.revenue || 0) : formatCurrency(totalSummary.revenue)}
            </div>
          </div>
          <div className={cn("rounded-[22px] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]", resultCardClass(resultStatus))}>
            <div className="text-[12px] font-medium text-white/80">Resultado</div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.05em]">
              {viewMode === "day" ? formatCurrency(selectedSummary?.result || 0) : formatCurrency(totalSummary.result)}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[30px] bg-white p-10 text-center text-sm text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
          Carregando visão do calendário...
        </div>
      ) : null}

      {!loading && viewMode === "day" ? (
        <section className="space-y-5">
          <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
            <div className="mb-1">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">
                  Agenda operacional
                </div>
                <div className="mt-2 text-[30px] font-medium tracking-[-0.05em] text-[#1f1f1f]">
                  Tudo o que aconteceu neste dia
                </div>
              </div>
            </div>

            <PlanilhamentoDiario closerId={closerId} externalMonth={selectedMonthKey} focusedDate={selectedDateKey} compact />
          </div>
        </section>
      ) : null}

      {!loading && viewMode === "week" ? (
        <section className="grid gap-4 xl:grid-cols-7">
          {weekDays.map((date, index) => {
            const key = formatDateKey(date);
            const summary = summaries.get(key);
            const status = getSummaryStatus(summary);

            return (
              <button
                key={key}
                type="button"
                onClick={() => openDate(date)}
                className="rounded-[24px] border border-[#ececeb] bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-28px_rgba(15,23,42,0.14)]"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#999999]">{WEEKDAY_LABELS[index]}</div>
                <div className={cn("mt-3 grid h-12 w-12 place-items-center rounded-full text-[26px] font-semibold tracking-[-0.05em] shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]", dateCircleClass(status))}>
                  {date.getDate()}
                </div>
                <div className="mt-4 space-y-2 text-[12px]">
                  <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[#676767]">{summary?.count || 0} influs</div>
                  <div className="text-[#848484]">Gasto <span className="font-medium text-[#1f1f1f]">{summary ? compactCurrency(summary.invested) : "—"}</span></div>
                  <div className="text-[#848484]">Faturado <span className="font-medium text-[#1f1f1f]">{summary ? compactCurrency(summary.revenue) : "—"}</span></div>
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      {!loading && viewMode === "month" ? (
        <section className="rounded-[30px] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
          <div className="mb-4 grid grid-cols-7 gap-3">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {monthMatrix.map((date) => {
              const key = formatDateKey(date);
              const summary = summaries.get(key);
              const muted = date.getMonth() !== anchorDate.getMonth();
              return <SummaryCell key={key} date={date} summary={summary} muted={muted} onOpen={openDate} />;
            })}
          </div>
        </section>
      ) : null}

      {!loading && viewMode === "quarter" ? (
        <section className="grid gap-5 xl:grid-cols-3">
          {quarterMonths.map((monthDate) => (
            <div key={formatMonthKey(monthDate)} className="rounded-[26px] bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[18px] font-medium tracking-[-0.03em] text-[#1f1f1f]">
                  {MONTH_NAMES[monthDate.getMonth()]}
                </div>
                <button type="button" onClick={() => { setAnchorDate(monthDate); setViewMode("month"); }} className="text-[12px] font-medium text-[#676767]">
                  Abrir
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {getMonthMatrix(monthDate).slice(0, 35).map((date) => {
                  const key = formatDateKey(date);
                  const summary = summaries.get(key);
                  const muted = date.getMonth() !== monthDate.getMonth();
                  const status = getSummaryStatus(summary);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openDate(date)}
                      className={cn(
                        "flex min-h-[58px] flex-col rounded-[16px] border border-[#ececeb] px-2 py-2 text-left",
                        muted ? "bg-[#fbfbfa] text-[#b1b1b1]" : "bg-white text-[#1f1f1f]"
                      )}
                    >
                      <span className={cn("grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold shadow-[0_10px_20px_-16px_rgba(15,23,42,0.35)]", dateCircleClass(status, muted))}>
                        {date.getDate()}
                      </span>
                      <span className="mt-auto text-[10px] text-[#7dbd34]">{summary?.count || 0} influs</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {!loading && viewMode === "year" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {yearMonths.map((monthDate) => {
            const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            let count = 0;
            let invested = 0;
            let revenue = 0;

            summaries.forEach((summary, key) => {
              if (key >= formatDateKey(monthStart) && key <= formatDateKey(monthEnd)) {
                count += summary.count;
                invested += summary.invested;
                revenue += summary.revenue;
              }
            });

            return (
              <button
                key={formatMonthKey(monthDate)}
                type="button"
                onClick={() => { setAnchorDate(monthDate); setViewMode("month"); }}
                className="rounded-[24px] border border-[#ececeb] bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-28px_rgba(15,23,42,0.14)]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[17px] font-medium tracking-[-0.03em] text-[#1f1f1f]">{MONTH_NAMES[monthDate.getMonth()]}</div>
                  <LayoutGrid className="h-4 w-4 text-[#999999]" />
                </div>
                <div className="mt-4 space-y-2 text-[12px]">
                  <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[#676767]">{count} influs</div>
                  <div className="text-[#848484]">Gasto <span className="font-medium text-[#1f1f1f]">{compactCurrency(invested)}</span></div>
                  <div className="text-[#848484]">Faturado <span className="font-medium text-[#1f1f1f]">{compactCurrency(revenue)}</span></div>
                </div>
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
