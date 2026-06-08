import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, FileText, LayoutGrid, ListChecks, Loader2, User, Users } from "lucide-react";
import PlanilhamentoCalendarWorkspace from "@/components/planilhamento/PlanilhamentoCalendarWorkspace";
import Balanco from "@/components/planilhamento/Balanco";
import ListaDoMes from "@/components/planilhamento/ListaDoMes";

interface Closer { id: string; nome: string; team_id: string | null }
interface Team { id: string; name: string }

const subTabs = [
  { id: "diario", label: "Planilhamento Diário", icon: FileText },
  { id: "balanco", label: "Balanço", icon: BarChart3 },
  { id: "lista-mes", label: "Lista do Mês", icon: ListChecks },
] as const;
type SubTabId = (typeof subTabs)[number]["id"];

function PillTabGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-[6px] rounded-[22px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04] ${className}`}
    >
      {children}
    </div>
  );
}

export default function FinanceiroEspelhamento() {
  const [closers, setClosers] = useState<Closer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [subTab, setSubTab] = useState<SubTabId>("diario");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [cRes, tRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, team_id").eq("status", "approved").order("nome"),
        supabase.from("teams").select("id, name").order("name"),
      ]);
      const cs = (cRes.data as any[]) || [];
      const ts = (tRes.data as any[]) || [];
      setClosers(cs);
      setTeams(ts);
      if (ts.length) setTeamId(ts[0].id);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(
    () => closers.filter((c) => !teamId || c.team_id === teamId),
    [closers, teamId]
  );

  const selectedCloser = closers.find((c) => c.id === closerId);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            <LayoutGrid className="h-3.5 w-3.5" />
            Espelhamento
          </div>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[48px]">
            Espelhe o Planilhamento
            <span className="block text-slate-400">de qualquer closer, ao vivo.</span>
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-slate-500">
            Veja Planilhamento Diário, Balanço e Lista do Mês exatamente como o closer enxerga — em tempo real.
          </p>
        </div>

        {selectedCloser && (
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-medium text-slate-700 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Ao vivo · {selectedCloser.nome}
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="rounded-[24px] bg-white p-2 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-stretch gap-2">
          <label className="group flex min-w-[200px] items-center gap-3 rounded-[18px] bg-[#F6F4F0] px-4 py-3 transition hover:bg-[#efece6]">
            <Users className="h-4 w-4 text-slate-400" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Time</span>
              <select
                value={teamId}
                onChange={(e) => { setTeamId(e.target.value); setCloserId(""); }}
                className="bg-transparent text-[14px] font-medium tracking-[-0.01em] text-slate-900 outline-none"
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </label>

          <label className="group flex flex-1 min-w-[260px] items-center gap-3 rounded-[18px] bg-[#F6F4F0] px-4 py-3 transition hover:bg-[#efece6]">
            <User className="h-4 w-4 text-slate-400" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Closer</span>
              <select
                value={closerId}
                onChange={(e) => setCloserId(e.target.value)}
                className="bg-transparent text-[14px] font-medium tracking-[-0.01em] text-slate-900 outline-none"
              >
                <option value="">Selecione um closer…</option>
                {filtered.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </label>
        </div>
      </div>

      {!closerId ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/60 p-16 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#F6F4F0] text-slate-400">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <p className="text-[15px] font-medium tracking-[-0.01em] text-slate-700">Selecione um closer</p>
          <p className="mt-1 text-[13px] text-slate-500">O Planilhamento dele aparecerá aqui em tempo real.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 whitespace-nowrap">
              <User className="h-3.5 w-3.5" />
              {selectedCloser?.nome}
            </span>
            <PillTabGroup className="max-w-full overflow-x-auto scrollbar-none">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
                      isActive ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </PillTabGroup>
          </div>

          <div>
            {subTab === "diario" && <PlanilhamentoCalendarWorkspace key={`diario-${closerId}`} closerId={closerId} />}
            {subTab === "balanco" && <Balanco key={`balanco-${closerId}`} closerId={closerId} />}
            {subTab === "lista-mes" && <ListaDoMes key={`lista-${closerId}`} closerId={closerId} />}
          </div>
        </div>
      )}
    </div>
  );
}
