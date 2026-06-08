import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, User } from "lucide-react";
import DailyReceiptsCarousel from "@/components/planilhamento/DailyReceiptsCarousel";
import { Input } from "@/components/ui/input";

interface Closer { id: string; nome: string; team_id: string | null }
interface Team { id: string; name: string }

function todayStr() { return new Date().toISOString().split("T")[0]; }

export default function FinanceiroComprovantes() {
  const { user } = useAuth();
  const [closers, setClosers] = useState<Closer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [date, setDate] = useState<string>(todayStr());
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const [cRes, tRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, team_id").eq("status", "approved").order("nome"),
        supabase.from("teams").select("id, name"),
      ]);
      setClosers((cRes.data as any) || []);
      setTeams((tRes.data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const visibleClosers = useMemo(() => {
    if (filterTeam === "all") return closers;
    return closers.filter((c) => c.team_id === filterTeam);
  }, [closers, filterTeam]);

  if (loading || !user) {
    return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Data</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleClosers.map((c) => (
          <div key={c.id} className="rounded-2xl bg-white border p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{c.nome}</p>
                <p className="text-[11px] text-muted-foreground">{teams.find((t) => t.id === c.team_id)?.name || "—"}</p>
              </div>
            </div>
            <DailyReceiptsCarousel
              date={date}
              closerId={c.id}
              teamId={c.team_id}
              canEdit
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
