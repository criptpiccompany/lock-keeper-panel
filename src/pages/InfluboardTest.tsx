import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useInfluboardLocks } from "@/hooks/useInfluboardLocks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function formatRemaining(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h}h ${m % 60}min`;
}

function daysSince(iso: string | null): { label: string; days: number } {
  if (!iso) return { label: "—", days: 0 };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return { label: "hoje", days: 0 };
  if (days === 1) return { label: "ontem", days: 1 };
  return { label: `há ${days}d`, days };
}

// Tier visual por nº de travas (incluindo a 1ª)
// 1× cinza · 2× amarelo · 3× verde · 4× dourado · 5×+ topo (gradient)
function getLockTier(count: number) {
  if (count >= 5) return {
    className: "bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 text-white shadow-sm ring-1 ring-white/40",
    label: "TOP",
  };
  if (count >= 4) return {
    className: "bg-gradient-to-r from-amber-300 to-yellow-500 text-amber-950 shadow-sm ring-1 ring-amber-200",
    label: "Dourado",
  };
  if (count >= 3) return {
    className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    label: "Verde",
  };
  if (count >= 2) return {
    className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    label: "Amarelo",
  };
  return {
    className: "bg-slate-100 text-slate-600",
    label: "Novato",
  };
}

export default function InfluboardTest() {
  const { data, isLoading } = useInfluboardLocks();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");

  const list = data?.list ?? [];
  const meta = data?.meta ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return list;
    return list.filter((i) =>
      i.handle_normalized.toLowerCase().includes(q) ||
      (i.closer_name ?? "").toLowerCase().includes(q) ||
      (i.team_name ?? "").toLowerCase().includes(q)
    );
  }, [list, query]);

  const sync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("influboard-scrape");
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["influboard-locks"] });
      toast.success("Sincronizado");
    } catch (e: any) {
      toast.error("Erro ao sincronizar", { description: e?.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Experimental</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-950">
            Influs Travados
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Lista de travados sincronizada do Influboard. Atualização automática a cada 3 min.
          </p>
        </div>
        <Button
          onClick={sync}
          disabled={syncing}
          className="bg-[#FFD400] text-slate-950 hover:bg-[#ffdf33]"
        >
          {syncing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando…</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Atualizar agora</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total travados" value={String(list.length)} />
        <Stat label="Última sync" value={formatRelative(meta?.last_run_at ?? null)} />
        <Stat label="Status" value={meta?.last_status ?? "—"} tone={meta?.last_status === "ok" ? "ok" : meta?.last_status === "error" ? "bad" : undefined} />
        <Stat label="Frequência" value="3 min" />
      </div>

      {meta?.last_error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Último erro</div>
          <pre className="mt-2 whitespace-pre-wrap break-words">{meta.last_error}</pre>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por @handle, closer ou equipe…"
          className="h-11 rounded-2xl border-0 bg-white pl-10 pr-10 text-sm shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] focus-visible:ring-2 focus-visible:ring-slate-900"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Handle</th>
              <th className="px-4 py-3 font-medium">Closer</th>
              <th className="px-4 py-3 font-medium">Equipe</th>
              <th className="px-4 py-3 font-medium">Travas</th>
              <th className="px-4 py-3 font-medium">Visto há</th>
              <th className="px-4 py-3 font-medium">Destrava em</th>
              <th className="px-4 py-3 font-medium">Restante</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && list.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhum travado no cache. Clique em "Atualizar agora".</td></tr>
            )}
            {!isLoading && list.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhum resultado para "{query}".</td></tr>
            )}
            {filtered.map((inf) => {
              const count = inf.lock_count ?? 1;
              const renewals = Math.max(0, count - 1);
              const tier = getLockTier(count);
              const seen = daysSince(inf.first_locked_at ?? null);
              // Alerta: travou 1x e já faz >= 3 dias = não renovou (prejuízo provável)
              const isStale = count === 1 && seen.days >= 3;
              return (
              <tr key={inf.handle_normalized} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-900">@{inf.handle_normalized}</td>
                <td className="px-4 py-2.5 text-slate-700">{inf.closer_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">{inf.team_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tier.className}`}
                    title={`${tier.label} · ${renewals === 0 ? "Travado pela 1ª vez" : `${renewals} renovação${renewals > 1 ? "ões" : ""}`}`}
                  >
                    {count}×
                    {renewals > 0 && (
                      <span className="text-[10px] font-normal opacity-80">({renewals} renov.)</span>
                    )}
                  </span>
                </td>
                <td
                  className={`px-4 py-2.5 text-xs ${isStale ? "font-semibold text-red-600" : "text-slate-500"}`}
                  title={inf.first_locked_at ? new Date(inf.first_locked_at).toLocaleString("pt-BR") : ""}
                >
                  {seen.label}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                  {inf.lock_expires_at ? new Date(inf.lock_expires_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {formatRemaining(inf.lock_expires_at)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {inf.instagram_url && (
                    <a
                      href={inf.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                    >
                      IG <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
