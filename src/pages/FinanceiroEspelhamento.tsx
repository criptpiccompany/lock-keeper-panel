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
      className={`inline-flex items-center gap-[6px] rounded-[22px] bg-white p-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${className}`}
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
        <Loader2 className="h-6 w-6 animate-spin text-[#999999]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">
            <LayoutGrid className="h-3.5 w-3.5" />
            Espelhamento
          </div>
          <h1 className="whitespace-nowrap text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#1f1f1f] sm:text-[52px]">
            Espelhe o Planilhamento <span className="text-[#cfcfce]">de qualquer closer, ao vivo.</span>
          </h1>
          <p className="whitespace-nowrap text-[13.5px] leading-relaxed text-[#676767]">
            Veja Planilhamento Diário, Balanço e Lista do Mês exatamente como o closer enxerga — em tempo real.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {selectedCloser && (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-[#676767]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7dbd34] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6ea93d]" />
              </span>
              Ao vivo · {selectedCloser.nome}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-2">
              <Users className="h-3.5 w-3.5 text-[#999999]" />
              <select
                value={teamId}
                onChange={(e) => { setTeamId(e.target.value); setCloserId(""); }}
                className="max-w-[160px] bg-transparent text-[13px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none"
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-2">
              <User className="h-3.5 w-3.5 text-[#999999]" />
              <select
                value={closerId}
                onChange={(e) => setCloserId(e.target.value)}
                className="max-w-[200px] bg-transparent text-[13px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none"
              >
                <option value="">Selecione um closer…</option>
                {filtered.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </div>
        </div>
      </header>


      {!closerId ? (
        <div className="rounded-[18px] border border-dashed border-[#ececeb] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-[#ececeb] text-[#999999]">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#1f1f1f]">Selecione um closer</p>
          <p className="mt-1 text-[12.5px] text-[#999999]">O Planilhamento dele aparecerá aqui em tempo real.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999] whitespace-nowrap">
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
                      isActive ? "bg-[#242424] text-white" : "text-[#676767] hover:text-[#1f1f1f]"
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
