import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, DollarSign, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, brandTabsListClass, brandTabsTriggerClass } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL, todayStr, yesterdayStr } from "@/components/financeiro/financeiroHelpers";

interface Team {
  id: string;
  name: string;
}

interface Closer {
  id: string;
  nome: string;
  team_id: string | null;
}

interface FinancialRecord {
  id: string;
  date: string;
  closer_id: string;
  team_id: string | null;
  valor_pago: number;
  faturamento: number | null;
  influencers: { handle: string } | null;
}

interface CloserRole {
  user_id: string;
}

interface CloserSummary {
  closer: Closer;
  yesterdayCost: number;
  yesterdayRevenue: number;
  yesterdayCount: number;
  monthCost: number;
  monthRevenue: number;
  yesterdayRecords: FinancialRecord[];
}

const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

export default function Financeiro() {
  const { isAdmin } = useAuth();
  const today = useMemo(() => todayStr(), []);
  const yesterday = useMemo(() => yesterdayStr(), []);
  const currentMonthStart = useMemo(() => monthStart(today), [today]);
  const queryStart = currentMonthStart < yesterday ? currentMonthStart : yesterday;
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [expandedCloserId, setExpandedCloserId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["financeiro-simplificado", queryStart, today],
    queryFn: async () => {
      const [recordsResult, closersResult, teamsResult, rolesResult] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("id, date, closer_id, team_id, valor_pago, faturamento, influencers(handle)")
          .gte("date", queryStart)
          .lte("date", today)
          .is("deleted_at", null)
          .order("date", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nome, team_id")
          .eq("status", "approved")
          .order("nome"),
        supabase.from("teams").select("id, name").order("name"),
        supabase.from("user_roles").select("user_id").eq("role", "CLOSER"),
      ]);

      if (recordsResult.error) throw recordsResult.error;
      if (closersResult.error) throw closersResult.error;
      if (teamsResult.error) throw teamsResult.error;
      if (rolesResult.error) throw rolesResult.error;

      return {
        records: (recordsResult.data ?? []) as FinancialRecord[],
        closers: (closersResult.data ?? []) as Closer[],
        teams: (teamsResult.data ?? []) as Team[],
        closerRoles: (rolesResult.data ?? []) as CloserRole[],
      };
    },
  });

  const activeTeamId = selectedTeamId;

  const summaries = useMemo<CloserSummary[]>(() => {
    if (!data) return [];
    const closerRoleIds = new Set(data.closerRoles.map((role) => role.user_id));
    const visibleClosers = data.closers.filter((closer) => (
      closerRoleIds.has(closer.id)
      && (!isAdmin || !activeTeamId || closer.team_id === activeTeamId)
    ));
    const closerById = new Map(visibleClosers.map((closer) => [closer.id, closer]));
    const summaryByCloser = new Map<string, CloserSummary>();

    visibleClosers.forEach((closer) => {
      summaryByCloser.set(closer.id, {
        closer,
        yesterdayCost: 0,
        yesterdayRevenue: 0,
        yesterdayCount: 0,
        monthCost: 0,
        monthRevenue: 0,
        yesterdayRecords: [],
      });
    });

    data.records.forEach((record) => {
      const closer = closerById.get(record.closer_id);
      if (!closer) return;
      const summary = summaryByCloser.get(record.closer_id);
      if (!summary) return;
      const cost = Number(record.valor_pago) || 0;
      const revenue = Number(record.faturamento) || 0;

      if (record.date >= currentMonthStart && record.date <= today) {
        summary.monthCost += cost;
        summary.monthRevenue += revenue;
      }
      if (record.date === yesterday) {
        summary.yesterdayCost += cost;
        summary.yesterdayRevenue += revenue;
        summary.yesterdayCount += 1;
        summary.yesterdayRecords.push(record);
      }
      summaryByCloser.set(record.closer_id, summary);
    });

    return Array.from(summaryByCloser.values())
      .sort((a, b) => (
        Number(b.yesterdayCount > 0 || b.monthCost > 0 || b.monthRevenue > 0)
        - Number(a.yesterdayCount > 0 || a.monthCost > 0 || a.monthRevenue > 0)
        || b.yesterdayCost - a.yesterdayCost
        || a.closer.nome.localeCompare(b.closer.nome, "pt-BR")
      ));
  }, [activeTeamId, currentMonthStart, data, isAdmin, today, yesterday]);

  const totals = useMemo(() => summaries.reduce(
    (result, summary) => ({
      yesterdayCost: result.yesterdayCost + summary.yesterdayCost,
      monthCost: result.monthCost + summary.monthCost,
      monthRevenue: result.monthRevenue + summary.monthRevenue,
    }),
    { yesterdayCost: 0, monthCost: 0, monthRevenue: 0 },
  ), [summaries]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        eyebrow="Financeiro"
        icon={DollarSign}
        title="Fechamento dos closers"
        subtitle="Gastos de ontem e consolidado de gastos e faturamento do mês atual."
      >
        {isAdmin && data && data.teams.length > 1 && (
          <Tabs
            value={activeTeamId || "all"}
            onValueChange={(teamId) => {
              setSelectedTeamId(teamId === "all" ? "" : teamId);
              setExpandedCloserId(null);
            }}
          >
            <TabsList className={`${brandTabsListClass} max-w-full overflow-x-auto`}>
              <TabsTrigger value="all" className={brandTabsTriggerClass}>
                Todas as equipes
              </TabsTrigger>
              {data.teams.map((team) => (
                <TabsTrigger key={team.id} value={team.id} className={brandTabsTriggerClass}>
                  {team.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </PageHeader>

      <main className="px-6 pb-12 pt-6 lg:px-8">
        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-card px-6 py-12 text-center text-sm text-destructive">
            Não foi possível carregar os dados financeiros.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
            <div className="grid gap-px border-b border-border bg-border md:grid-cols-3">
              <Metric label="Gasto de ontem" value={totals.yesterdayCost} />
              <Metric label="Gasto no mês" value={totals.monthCost} />
              <Metric label="Faturamento no mês" value={totals.monthRevenue} />
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Por closer</p>
                <p className="mt-1 text-sm text-foreground">
                  Ontem: {new Date(`${yesterday}T12:00:00`).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {summaries.length} closers
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Closer</th>
                    <th className="px-5 py-3 text-right">Gasto de ontem</th>
                    <th className="px-5 py-3 text-right">Fat. de ontem</th>
                    <th className="px-5 py-3 text-right">Lançamentos</th>
                    <th className="px-5 py-3 text-right">Gasto no mês</th>
                    <th className="px-5 py-3 text-right">Fat. no mês</th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((summary) => {
                    const expanded = expandedCloserId === summary.closer.id;
                    return (
                      <Fragment key={summary.closer.id}>
                        <tr
                          className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                          onClick={() => setExpandedCloserId(expanded ? null : summary.closer.id)}
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-foreground">{summary.closer.nome}</td>
                          <MoneyCell value={summary.yesterdayCost} emphasis />
                          <MoneyCell value={summary.yesterdayRevenue} />
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-muted-foreground">{summary.yesterdayCount}</td>
                          <MoneyCell value={summary.monthCost} />
                          <MoneyCell value={summary.monthRevenue} positive />
                          <td className="px-3 py-4 text-muted-foreground">
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${summary.closer.id}-detail`} className="border-b border-border bg-muted/25">
                            <td colSpan={7} className="px-5 py-4">
                              <CloserDayDetail records={summary.yesterdayRecords} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {summaries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                        Nenhum lançamento financeiro encontrado neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{formatBRL(value)}</p>
    </div>
  );
}

function MoneyCell({ value, emphasis = false, positive = false }: { value: number; emphasis?: boolean; positive?: boolean }) {
  return (
    <td className={`px-5 py-4 text-right text-sm tabular-nums ${emphasis ? "font-semibold text-foreground" : positive ? "font-semibold text-primary" : "text-foreground"}`}>
      {formatBRL(value)}
    </td>
  );
}

function CloserDayDetail({ records }: { records: FinancialRecord[] }) {
  if (records.length === 0) {
    return <p className="py-3 text-center text-sm text-muted-foreground">Este closer não teve gastos ontem.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_150px_150px] border-b border-border bg-muted/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span>Influenciador</span>
        <span className="text-right">Gasto</span>
        <span className="text-right">Faturamento</span>
      </div>
      {records
        .slice()
        .sort((a, b) => (Number(b.valor_pago) || 0) - (Number(a.valor_pago) || 0))
        .map((record) => (
          <div key={record.id} className="grid grid-cols-[1fr_150px_150px] border-b border-border px-4 py-2.5 text-sm last:border-0">
            <span className="font-medium text-foreground">{record.influencers?.handle ?? "Influenciador não identificado"}</span>
            <span className="text-right tabular-nums text-foreground">{formatBRL(Number(record.valor_pago) || 0)}</span>
            <span className="text-right tabular-nums text-muted-foreground">{formatBRL(Number(record.faturamento) || 0)}</span>
          </div>
        ))}
    </div>
  );
}
