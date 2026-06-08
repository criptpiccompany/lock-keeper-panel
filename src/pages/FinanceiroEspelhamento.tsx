import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, FileText, ListChecks, Loader2, User } from "lucide-react";
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
      className={`inline-flex items-center gap-[6px] rounded-[22px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] ${className}`}
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
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border p-4 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)]">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
            <select
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setCloserId(""); }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Closer</label>
            <select
              value={closerId}
              onChange={(e) => setCloserId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[240px]"
            >
              <option value="">Selecione um closer…</option>
              {filtered.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {selectedCloser && (
            <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Espelhando ao vivo · {selectedCloser.nome}
            </div>
          )}
        </div>
      </div>

      {!closerId ? (
        <div className="rounded-2xl bg-white border p-12 text-center text-sm text-muted-foreground">
          Selecione um closer para espelhar o Planilhamento dele em tempo real.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[0.08em] text-[#8a8a8a] uppercase whitespace-nowrap">
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
