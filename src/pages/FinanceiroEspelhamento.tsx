import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import PlanilhamentoDiario from "@/components/planilhamento/PlanilhamentoDiario";

interface Closer { id: string; nome: string; team_id: string | null }
interface Team { id: string; name: string }

export default function FinanceiroEspelhamento() {
  const [closers, setClosers] = useState<Closer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [cRes, tRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, team_id").eq("status", "approved").order("nome"),
        supabase.from("teams").select("id, name"),
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

  const filtered = closers.filter((c) => !teamId || c.team_id === teamId);

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
          <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setCloserId(""); }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Closer</label>
          <select value={closerId} onChange={(e) => setCloserId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[220px]">
            <option value="">Selecione…</option>
            {filtered.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {closerId ? (
        <PlanilhamentoDiario closerId={closerId} />
      ) : (
        <div className="rounded-2xl bg-white border p-12 text-center text-sm text-muted-foreground">
          Selecione um closer para espelhar o Planilhamento dele em tempo real.
        </div>
      )}
    </div>
  );
}
