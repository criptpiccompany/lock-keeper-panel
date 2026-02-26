import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, X, User } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  todayStr, yesterdayStr, daysAgoStr, dateToStr,
  type DailyRecord, type CloserProfile, type DayAggregate, type EmployeeDayData, type PeriodPreset,
} from "@/components/financeiro/financeiroHelpers";

interface Team {
  id: string;
  name: string;
}

export default function Financeiro() {
  const { isAdmin } = useAuth();
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

  useEffect(() => {
    const fetchData = async () => {
      const since = daysAgoStr(90);
      const [recRes, closerRes, teamsRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, valor_pago, faturamento, team_id")
          .gte("date", since)
          .lte("date", today)
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

      // Default to first team
      if (fetchedTeams.length > 0) {
        setSelectedTeamId(fetchedTeams[0].id);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter records by selected team (ADMIN only)
  const teamRecords = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return records;
    return records.filter(r => r.team_id === selectedTeamId);
  }, [records, isAdmin, selectedTeamId]);

  // Filter closers by selected team (ADMIN only)
  const teamClosers = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return closers;
    return closers.filter(c => c.team_id === selectedTeamId);
  }, [closers, isAdmin, selectedTeamId]);

  // Aggregate by date
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

  const todayData = byDate.get(today) || { cost: 0, revenue: 0, count: 0 };
  const yesterdayData = byDate.get(yesterday) || { cost: 0, revenue: 0, count: 0 };
  const dayBeforeYesterday = daysAgoStr(2);
  const dayBeforeData = byDate.get(dayBeforeYesterday) || { cost: 0, revenue: 0, count: 0 };

  // Aggregate by closer
  const byCloser = useMemo(() => {
    const map = new Map<string, EmployeeDayData>();
    teamRecords.forEach((r) => {
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
  }, [teamRecords, today, yesterday]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const financeiroContent = (
    <>
      {/* Summary Cards */}
      <FinanceiroSummaryCards todayData={todayData} yesterdayData={yesterdayData} />

      {/* Content */}
      <div className="space-y-6 mt-6">
        <FinanceiroDeltaStrip byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />
        <FinanceiroDetailBlocks todayData={todayData} yesterdayData={yesterdayData} dayBeforeData={dayBeforeData} />
        <FinanceiroChart byDate={byDate} today={today} filterStart={filterStart} filterEnd={filterEnd} />
        <FinanceiroEmployeeSection byCloser={byCloser} closers={teamClosers} onSelectCloser={setSelectedCloser} />
        <FinanceiroHistory byDate={byDate} today={today} yesterday={yesterday} filterStart={filterStart} filterEnd={filterEnd} />
        <TeamThermometersSection />
      </div>
    </>
  );

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

          {/* ADMIN: Team tabs */}
          {isAdmin && teams.length > 1 && (
            <Tabs value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <TabsList>
                {teams.map(t => (
                  <TabsTrigger key={t.id} value={t.id}>{t.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
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
              { label: "Custo Hoje", value: empData.costToday },
              { label: "Fat. Ontem", value: empData.revYesterday },
              { label: "Custo Ontem", value: empData.costYesterday },
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
