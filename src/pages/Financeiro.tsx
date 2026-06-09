import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, X, User, Trophy } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import FinanceiroEmployeeDrawerContent from "@/components/financeiro/FinanceiroEmployeeDrawerContent";
import FinanceiroPeriodFilter from "@/components/financeiro/FinanceiroPeriodFilter";
import FinanceiroSummaryCards from "@/components/financeiro/FinanceiroSummaryCards";
import FinanceiroDetailBlocks from "@/components/financeiro/FinanceiroDetailBlocks";
import FinanceiroChart from "@/components/financeiro/FinanceiroChart";
import FinanceiroEmployeeSection from "@/components/financeiro/FinanceiroEmployeeSection";
import FinanceiroDeltaStrip from "@/components/financeiro/FinanceiroDeltaStrip";
import FinanceiroHistory from "@/components/financeiro/FinanceiroHistory";
import TeamThermometersSection from "@/components/painel/TeamThermometersSection";
import { PageHeader, brandTabsListClass, brandTabsTriggerClass } from "@/components/PageHeader";
import {
  todayStr, yesterdayStr, daysAgoStr, dateToStr, shiftDateStr, diffDaysInclusive, minDateStr,
  type DailyRecord, type CloserProfile, type DayAggregate, type EmployeeDayData, type PeriodPreset,
} from "@/components/financeiro/financeiroHelpers";

interface Team {
  id: string;
  name: string;
}

const EMPTY_AGG: DayAggregate = { cost: 0, revenue: 0, count: 0 };

export default function Financeiro() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<(DailyRecord & { team_id?: string | null })[]>([]);
  const [closers, setClosers] = useState<(CloserProfile & { team_id?: string | null })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<CloserProfile | null>(null);

  // Team tab (ADMIN only)
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Period filter state
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const today = todayStr();
  const yesterday = yesterdayStr();

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

  // Period meta — labels, previous window, partial flag
  const periodMeta = useMemo(() => {
    const lenDays = diffDaysInclusive(filterStart, filterEnd);
    const previousEnd = shiftDateStr(filterStart, -1);
    const previousStart = shiftDateStr(previousEnd, -(lenDays - 1));
    const partial = filterEnd >= today;

    let currentLabel = "Período atual";
    let previousLabel = "Período anterior";
    let showDeltaBase = false;
    if (preset === "today") {
      currentLabel = "Hoje";
      previousLabel = "Ontem";
      showDeltaBase = true;
    } else if (preset === "yesterday") {
      currentLabel = "Ontem";
      previousLabel = "Anteontem";
      showDeltaBase = true;
    } else {
      currentLabel = `Atual (${lenDays}d)`;
      previousLabel = `Anterior (${lenDays}d)`;
    }
    return { lenDays, previousStart, previousEnd, partial, currentLabel, previousLabel, showDeltaBase };
  }, [filterStart, filterEnd, preset, today]);

  useEffect(() => {
    const fetchData = async () => {
      // Adaptive window: cobre o período selecionado + comparação + mínimo 90d para histórico
      const baseline = daysAgoStr(90);
      const since = minDateStr(baseline, periodMeta.previousStart);
      const until = filterEnd > today ? filterEnd : today;

      const [recRes, closerRes, teamsRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, valor_pago, faturamento, team_id")
          .gte("date", since)
          .lte("date", until)
          .is("deleted_at", null)
          .order("date", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nome, team_id")
          .eq("status", "approved")
          .order("nome"),
        supabase.from("teams").select("id, name"),
      ]);
      const fetchedRecords = (recRes.data as any[]) || [];
      const fetchedClosers = (closerRes.data as any[]) || [];
      const fetchedTeams = (teamsRes.data as Team[]) || [];

      setRecords(fetchedRecords);
      setClosers(fetchedClosers);
      setTeams(fetchedTeams);

      if (fetchedTeams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(fetchedTeams[0].id);
      }

      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMeta.previousStart, filterEnd, today]);

  // Filter records by selected team (ADMIN only)
  const teamRecords = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return records;
    return records.filter(r => r.team_id === selectedTeamId);
  }, [records, isAdmin, selectedTeamId]);

  const teamClosers = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return closers;
    return closers.filter(c => c.team_id === selectedTeamId);
  }, [closers, isAdmin, selectedTeamId]);

  // Aggregate by date (used by chart/history/delta)
  const byDate = useMemo(() => {
    const map = new Map<string, DayAggregate>();
    teamRecords.forEach((r) => {
      const e = map.get(r.date) || { cost: 0, revenue: 0, count: 0 };
      e.cost += Number(r.valor_pago) || 0;
      e.revenue += Number(r.faturamento) || 0;
      e.count += 1;
      map.set(r.date, e);
    });
    return map;
  }, [teamRecords]);

  // Aggregate for selected period + previous comparison
  const { currentData, previousData, previousDeltaBase } = useMemo(() => {
    const cur: DayAggregate = { cost: 0, revenue: 0, count: 0 };
    const prev: DayAggregate = { cost: 0, revenue: 0, count: 0 };
    byDate.forEach((agg, date) => {
      if (date >= filterStart && date <= filterEnd) {
        cur.cost += agg.cost; cur.revenue += agg.revenue; cur.count += agg.count;
      }
      if (date >= periodMeta.previousStart && date <= periodMeta.previousEnd) {
        prev.cost += agg.cost; prev.revenue += agg.revenue; prev.count += agg.count;
      }
    });

    // Para presets today/yesterday: deltabase = dia anterior ao "previousLabel"
    let base: DayAggregate | null = null;
    if (periodMeta.showDeltaBase) {
      const baseDate = shiftDateStr(periodMeta.previousStart, -1);
      base = byDate.get(baseDate) || null;
    }
    return { currentData: cur, previousData: prev, previousDeltaBase: base };
  }, [byDate, filterStart, filterEnd, periodMeta]);

  // Aggregate by closer over current + previous periods
  const byCloser = useMemo(() => {
    const map = new Map<string, EmployeeDayData>();
    teamRecords.forEach((r) => {
      const inCurrent = r.date >= filterStart && r.date <= filterEnd;
      const inPrevious = r.date >= periodMeta.previousStart && r.date <= periodMeta.previousEnd;
      if (!inCurrent && !inPrevious) return;
      const e = map.get(r.closer_id) || {
        costCurrent: 0, revCurrent: 0, countCurrent: 0,
        costPrevious: 0, revPrevious: 0, countPrevious: 0,
      };
      if (inCurrent) {
        e.costCurrent += Number(r.valor_pago) || 0;
        e.revCurrent += Number(r.faturamento) || 0;
        e.countCurrent += 1;
      }
      if (inPrevious) {
        e.costPrevious += Number(r.valor_pago) || 0;
        e.revPrevious += Number(r.faturamento) || 0;
        e.countPrevious += 1;
      }
      map.set(r.closer_id, e);
    });
    return map;
  }, [teamRecords, filterStart, filterEnd, periodMeta.previousStart, periodMeta.previousEnd]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const financeiroContent = (
    <>
      <FinanceiroSummaryCards
        currentData={currentData}
        currentLabel={periodMeta.currentLabel}
        partial={periodMeta.partial}
        previousData={previousData}
        previousLabel={periodMeta.previousLabel}
      />

      <div className="space-y-6 mt-6">
        <FinanceiroDeltaStrip byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />
        <FinanceiroDetailBlocks
          currentData={currentData}
          currentLabel={periodMeta.currentLabel}
          partial={periodMeta.partial}
          previousData={previousData}
          previousLabel={periodMeta.previousLabel}
          previousDeltaBase={previousDeltaBase}
          previousDeltaBaseLabel={periodMeta.showDeltaBase ? (preset === "today" ? "anteontem" : "dia anterior") : undefined}
        />
        <FinanceiroChart byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />
        <FinanceiroEmployeeSection
          byCloser={byCloser}
          closers={teamClosers}
          onSelectCloser={setSelectedCloser}
          currentLabel={periodMeta.currentLabel}
          previousLabel={periodMeta.previousLabel}
        />
        <FinanceiroHistory byDate={byDate} today={today} yesterday={yesterday} filterStart={filterStart} filterEnd={filterEnd} />
        <TeamThermometersSection />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F6F4F0]">
      <PageHeader
        eyebrow="Financeiro"
        icon={DollarSign}
        title="Operação financeira"
        subtitle="Acompanhe receita, investimento e resultado por closer e por time, com leitura executiva do período."
        right={
          <FinanceiroPeriodFilter
            preset={preset}
            customStart={customStart}
            customEnd={customEnd}
            onPresetChange={setPreset}
            onCustomRange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
          />
        }
      >
        {isAdmin && teams.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <TabsList className={brandTabsListClass + " w-full sm:w-auto overflow-x-auto"}>
                {teams.map(t => (
                  <TabsTrigger key={t.id} value={t.id} className={brandTabsTriggerClass}>{t.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-full font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              onClick={() => navigate("/registro?tab=ranking")}
            >
              <Trophy className="h-4 w-4" />
              Ranking
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="container px-4 sm:px-6 lg:px-8 py-6">
        {financeiroContent}
      </div>

      {/* Employee Detail Drawer */}
      <Sheet open={!!selectedCloser} onOpenChange={(open) => !open && setSelectedCloser(null)}>
        <SheetContent className="w-[460px] sm:max-w-[460px] p-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-card">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">{selectedCloser?.nome}</h2>
                <p className="text-xs text-muted-foreground">Detalhamento financeiro</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedCloser(null)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </div>

          {selectedCloser && (() => {
            const empData = byCloser.get(selectedCloser.id);
            if (!empData) return null;
            const items = [
              { label: `Custo ${periodMeta.currentLabel}`, value: empData.costCurrent },
              { label: `Fat. ${periodMeta.previousLabel}`, value: empData.revPrevious },
              { label: `Custo ${periodMeta.previousLabel}`, value: empData.costPrevious },
            ];
            return (
              <div className="grid grid-cols-3 gap-px bg-border/40">
                {items.map((item) => (
                  <div key={item.label} className="bg-card px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {selectedCloser && <FinanceiroEmployeeDrawerContent closerId={selectedCloser.id} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
