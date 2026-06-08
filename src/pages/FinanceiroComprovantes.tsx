import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, FileText, Loader2, User, Users } from "lucide-react";
import DailyReceiptsCarousel from "@/components/planilhamento/DailyReceiptsCarousel";

interface Closer { id: string; nome: string; team_id: string | null }
interface Team { id: string; name: string }

function todayStr() { return new Date().toISOString().split("T")[0]; }

function formatPtDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  } catch { return iso; }
}

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
        supabase.from("teams").select("id, name").order("name"),
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
            <FileText className="h-3.5 w-3.5" />
            Comprovantes
          </div>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[48px]">
            Anexe comprovantes
            <span className="block text-slate-400">por closer e por dia.</span>
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-slate-500">
            Mantenha cada fechamento com seu comprovante no lugar certo, sem interromper o closer durante a prospecção.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-medium text-slate-500 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {visibleClosers.length} closer{visibleClosers.length === 1 ? "" : "s"} visíveis
        </div>
      </header>

      {/* Toolbar */}
      <div className="rounded-[24px] bg-white p-2 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-stretch gap-2">
          <label className="group flex flex-1 min-w-[220px] items-center gap-3 rounded-[18px] bg-[#F6F4F0] px-4 py-3 transition hover:bg-[#efece6]">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Data</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-[14px] font-medium tracking-[-0.01em] text-slate-900 outline-none"
                />
                <span className="hidden text-[12px] capitalize text-slate-400 sm:inline">· {formatPtDate(date)}</span>
              </div>
            </div>
          </label>

          <label className="group flex min-w-[200px] items-center gap-3 rounded-[18px] bg-[#F6F4F0] px-4 py-3 transition hover:bg-[#efece6]">
            <Users className="h-4 w-4 text-slate-400" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Time</span>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="bg-transparent text-[14px] font-medium tracking-[-0.01em] text-slate-900 outline-none"
              >
                <option value="all">Todos os times</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </label>
        </div>
      </div>

      {/* Grid */}
      {visibleClosers.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/60 p-16 text-center">
          <p className="text-[14px] text-slate-500">Nenhum closer encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleClosers.map((c) => {
            const teamName = teams.find((t) => t.id === c.team_id)?.name || "—";
            const initial = c.nome?.charAt(0)?.toUpperCase() ?? "?";
            return (
              <article
                key={c.id}
                className="group rounded-[24px] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_rgba(15,23,42,0.22)]"
              >
                <header className="mb-4 flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(180deg,#1f2937_0%,#0f172a_100%)] text-[14px] font-semibold text-white">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-slate-950">{c.nome}</p>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{teamName}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-[#F6F4F0] px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    <User className="h-3 w-3" />
                    Closer
                  </div>
                </header>

                <div className="rounded-[18px] bg-[#F6F4F0] p-3">
                  <DailyReceiptsCarousel
                    date={date}
                    closerId={c.id}
                    teamId={c.team_id}
                    canEdit
                    compact
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
