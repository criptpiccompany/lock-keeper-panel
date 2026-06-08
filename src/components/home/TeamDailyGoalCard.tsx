import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DAILY_GOAL = 30000;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

interface Props {
  teamId?: string | null;
  isAdmin?: boolean;
}

export function TeamDailyGoalCard({ teamId, isAdmin }: Props) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const y = yesterday();
    return { from: y, to: y };
  });
  const [open, setOpen] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(false);

  const from = range?.from;
  const to = range?.to ?? range?.from;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      let query = supabase
        .from("daily_influencer_records")
        .select("faturamento, team_id")
        .gte("date", dateToStr(from))
        .lte("date", dateToStr(to))
        .is("deleted_at", null);
      if (!isAdmin && teamId) query = query.eq("team_id", teamId);
      const { data } = await query;
      if (cancelled) return;
      const sum = (data || []).reduce((s: number, r: any) => s + (Number(r.faturamento) || 0), 0);
      setRevenue(sum);
      setLoading(false);
    };
    run();
  }, [from?.getTime(), to?.getTime(), teamId, isAdmin]);

  const days = useMemo(() => {
    if (!from || !to) return 1;
    const ms = to.getTime() - from.getTime();
    return Math.max(1, Math.round(ms / 86400000) + 1);
  }, [from, to]);

  const target = DAILY_GOAL * days;
  const progress = target > 0 ? Math.max(0, Math.min(100, (revenue / target) * 100)) : 0;

  const rangeLabel = useMemo(() => {
    if (!from) return "Selecionar período";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = yesterday();
    y.setHours(0, 0, 0, 0);
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    const t = to ? new Date(to) : f; t.setHours(0, 0, 0, 0);
    if (f.getTime() === t.getTime()) {
      if (f.getTime() === y.getTime()) return "Ontem";
      if (f.getTime() === today.getTime()) return "Hoje";
      return format(f, "dd 'de' MMM", { locale: ptBR });
    }
    return `${format(f, "dd/MM", { locale: ptBR })} – ${format(t, "dd/MM", { locale: ptBR })}`;
  }, [from, to]);

  return (
    <div className="rounded-[18px] bg-white px-7 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">Progresso</div>
          <div className="mt-2 text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-[#1f1f1f]">
            Meta diária do time
          </div>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-2 text-[12px] font-medium text-[#676767] hover:bg-[#f7f7f6] transition"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {rangeLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => {
                setRange(r);
                if (r?.from && r?.to) setOpen(false);
              }}
              numberOfMonths={2}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="my-4 h-[11px] overflow-hidden rounded-full bg-[repeating-linear-gradient(90deg,#f0f0ef_0px,#f0f0ef_3px,#f7f7f6_3px,#f7f7f6_6px)]">
        <div
          className={cn(
            "h-full rounded-full bg-[linear-gradient(90deg,#20724f_0%,#0f5b42_100%)] transition-all",
            loading && "opacity-60"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px] text-[#999999]">
        <span>
          <span className="font-semibold text-[#1f1f1f]">{formatCurrency(revenue)}</span> de
        </span>
        <span className="font-medium text-[#676767]">{formatCurrency(target)}</span>
      </div>
    </div>
  );
}
