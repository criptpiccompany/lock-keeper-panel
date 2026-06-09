import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, FileText, Loader2, User, Users } from "lucide-react";
import DailyReceiptsCarousel from "@/components/planilhamento/DailyReceiptsCarousel";
import QuickAddReceiptBar from "@/components/planilhamento/QuickAddReceiptBar";

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
  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    const base = filterTeam === "all" ? closers : closers.filter((c) => c.team_id === filterTeam);
    const priority = ["vanessa", "gabriel", "antonio", "antônio"];
    const rank = (name: string) => {
      const n = (name || "").trim().toLowerCase();
      const idx = priority.findIndex((p) => n.startsWith(p));
      return idx === -1 ? priority.length : idx;
    };
    return [...base].sort((a, b) => {
      const ra = rank(a.nome), rb = rank(b.nome);
      if (ra !== rb) return ra - rb;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });
  }, [closers, filterTeam]);

  if (loading || !user) {
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
            <FileText className="h-3.5 w-3.5" />
            Comprovantes
          </div>
          <h1 className="whitespace-nowrap text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] text-[#1f1f1f] sm:text-[52px]">
            Anexe comprovantes <span className="text-[#cfcfce]">por closer e por dia.</span>
          </h1>
          <p className="whitespace-nowrap text-[13.5px] leading-relaxed text-[#676767]">
            Mantenha cada fechamento com seu comprovante no lugar certo, sem interromper o closer durante a prospecção.
          </p>
        </div>

        {/* Controls — top right */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-[#676767]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6ea93d]" />
              {visibleClosers.length} closer{visibleClosers.length === 1 ? "" : "s"} visíveis
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-2">
              <Calendar className="h-3.5 w-3.5 text-[#999999]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[120px] bg-transparent text-[13px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-3.5 py-2">
              <Users className="h-3.5 w-3.5 text-[#999999]" />
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="max-w-[160px] bg-transparent text-[13px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none"
              >
                <option value="all">Todos os times</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </header>


      {/* Grid */}
      {visibleClosers.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[#ececeb] bg-white px-6 py-16 text-center">
          <p className="text-[13.5px] text-[#676767]">Nenhum closer encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleClosers.map((c) => {
            const teamName = teams.find((t) => t.id === c.team_id)?.name || "—";
            const initial = c.nome?.charAt(0)?.toUpperCase() ?? "?";
            return (
              <article
                key={c.id}
                className="rounded-[18px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
              >
                <header className="mb-4 flex items-center gap-3 border-b border-[#ececeb] pb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(180deg,#1f1f1f_0%,#0d0d0d_100%)] text-[13px] font-semibold text-white">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[#1f1f1f]">{c.nome}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#999999]">{teamName}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-[#ececeb] px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#676767]">
                    <User className="h-3 w-3" />
                    Closer
                  </div>
                </header>

                <DailyReceiptsCarousel
                  date={date}
                  closerId={c.id}
                  teamId={c.team_id}
                  canEdit
                  compact
                  requireFocus
                />
              </article>
            );
          })}
        </div>
      )}

      <QuickAddReceiptModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        closers={closers}
        date={date}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
