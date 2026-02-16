import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Balanco from "@/components/planilhamento/Balanco";
import FinanceiroPeriodFilter from "@/components/financeiro/FinanceiroPeriodFilter";
import FinanceiroSummaryCards from "@/components/financeiro/FinanceiroSummaryCards";
import FinanceiroDetailBlocks from "@/components/financeiro/FinanceiroDetailBlocks";
import FinanceiroChart from "@/components/financeiro/FinanceiroChart";
import FinanceiroEmployeeSection from "@/components/financeiro/FinanceiroEmployeeSection";
import FinanceiroDeltaStrip from "@/components/financeiro/FinanceiroDeltaStrip";
import FinanceiroHistory from "@/components/financeiro/FinanceiroHistory";
import {
  todayStr, yesterdayStr, daysAgoStr, dateToStr,
  type DailyRecord, type CloserProfile, type DayAggregate, type EmployeeDayData, type PeriodPreset,
} from "@/components/financeiro/financeiroHelpers";

export default function Financeiro() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<CloserProfile | null>(null);

  // Period filter state
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const today = todayStr();
  const yesterday = yesterdayStr();

  // Compute filter boundaries
  const filterStart = useMemo(() => {
    if (preset === "today") return today;
    if (preset === "yesterday") return yesterday;
    if (preset === "7d") return daysAgoStr(6);
    if (preset === "30d") return daysAgoStr(29);
    if (preset === "custom" && customStart) return dateToStr(customStart);
    return daysAgoStr(29);
  }, [preset, customStart, today, yesterday]);

  const filterEnd = useMemo(() => {
    if (preset === "today") return today;
    if (preset === "yesterday") return yesterday;
    if (preset === "custom" && customEnd) return dateToStr(customEnd);
    return today;
  }, [preset, customEnd, today, yesterday]);

  // Fetch data with a generous window (90 days) so filters work without re-fetching
  useEffect(() => {
    const fetchData = async () => {
      const since = daysAgoStr(90);
      const [recRes, closerRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, valor_pago, faturamento")
          .gte("date", since)
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
    fetchData();
  }, []);

  // Aggregate by date
  const byDate = useMemo(() => {
    const map = new Map<string, DayAggregate>();
    records.forEach((r) => {
      const e = map.get(r.date) || { cost: 0, revenue: 0, count: 0 };
      e.cost += Number(r.valor_pago) || 0;
      e.revenue += Number(r.faturamento) || 0;
      e.count += 1;
      map.set(r.date, e);
    });
    return map;
  }, [records]);

  const todayData = byDate.get(today) || { cost: 0, revenue: 0, count: 0 };
  const yesterdayData = byDate.get(yesterday) || { cost: 0, revenue: 0, count: 0 };
  const dayBeforeYesterday = daysAgoStr(2);
  const dayBeforeData = byDate.get(dayBeforeYesterday) || { cost: 0, revenue: 0, count: 0 };

  // Aggregate by closer for today + yesterday
  const byCloser = useMemo(() => {
    const map = new Map<string, EmployeeDayData>();
    records.forEach((r) => {
      if (r.date !== today && r.date !== yesterday) return;
      const e = map.get(r.closer_id) || { costToday: 0, revToday: 0, countToday: 0, costYesterday: 0, revYesterday: 0, countYesterday: 0 };
      if (r.date === today) {
        e.costToday += Number(r.valor_pago) || 0;
        e.revToday += Number(r.faturamento) || 0;
        e.countToday += 1;
      }
      if (r.date === yesterday) {
        e.costYesterday += Number(r.valor_pago) || 0;
        e.revYesterday += Number(r.faturamento) || 0;
        e.countYesterday += 1;
      }
      map.set(r.closer_id, e);
    });
    return map;
  }, [records, today, yesterday]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Financeiro
            </h1>
            <FinanceiroPeriodFilter
              preset={preset}
              customStart={customStart}
              customEnd={customEnd}
              onPresetChange={setPreset}
              onCustomRange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
            />
          </div>

          {/* Summary Cards */}
          <FinanceiroSummaryCards todayData={todayData} yesterdayData={yesterdayData} />
        </div>
      </div>

      {/* Content */}
      <div className="container py-6 space-y-6">
        {/* Delta Strip */}
        <FinanceiroDeltaStrip byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />

        {/* Detail Blocks */}
        <FinanceiroDetailBlocks todayData={todayData} yesterdayData={yesterdayData} dayBeforeData={dayBeforeData} />

        {/* Chart */}
        <FinanceiroChart byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />

        {/* Employee Section */}
        <FinanceiroEmployeeSection byCloser={byCloser} closers={closers} onSelectCloser={setSelectedCloser} />

        {/* History */}
        <FinanceiroHistory byDate={byDate} today={today} yesterday={yesterday} filterStart={filterStart} filterEnd={filterEnd} />
      </div>

      {/* Employee Detail Side Panel */}
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
