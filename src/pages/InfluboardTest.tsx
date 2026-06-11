import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface Locked {
  id: number;
  handle: string;
  instagram_url: string;
  status: string;
  lock_expires_at: string;
  closers: { id: number; name: string; avatar: string | null }[];
  team: { id: number; name: string; logo: string | null };
}

interface ScrapeResult {
  ok: boolean;
  loginStatus: number;
  finalStatus: number;
  component: string | null;
  authUser: { name: string; email: string } | null;
  count: number;
  lockedInfluencers: Locked[];
  propsKeys: string[];
}

function formatRemaining(iso: string): string {
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

export default function InfluboardTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke<ScrapeResult>("influboard-scrape");
      if (error) throw error;
      setResult(data ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Experimental</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-950">
            Teste Influboard
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Espelhamento da lista de travados do Influboard direto aqui no painel.
          </p>
        </div>
        <Button
          onClick={run}
          disabled={loading}
          className="bg-[#FFD400] text-slate-950 hover:bg-[#ffdf33]"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando…</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> {result ? "Atualizar" : "Buscar travados"}</>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Erro</div>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error}</pre>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total travados" value={String(result.count)} />
            <Stat label="Login" value={result.loginStatus === 302 ? "OK" : String(result.loginStatus)} />
            <Stat label="Painel" value={result.finalStatus === 200 ? "OK" : String(result.finalStatus)} />
            <Stat label="Conta" value={result.authUser?.email ?? "—"} />
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Handle</th>
                  <th className="px-4 py-3 font-medium">Closer</th>
                  <th className="px-4 py-3 font-medium">Equipe</th>
                  <th className="px-4 py-3 font-medium">Destrava em</th>
                  <th className="px-4 py-3 font-medium">Restante</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.lockedInfluencers
                  .slice()
                  .sort((a, b) => a.handle.localeCompare(b.handle))
                  .map((inf) => (
                    <tr key={inf.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-900">@{inf.handle}</td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {inf.closers.map((c) => c.name).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{inf.team?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {new Date(inf.lock_expires_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {formatRemaining(inf.lock_expires_at)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={inf.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                        >
                          IG <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                {result.count === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhum travado retornado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <details className="rounded-2xl bg-white p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Debug (JSON bruto)</summary>
            <pre className="mt-3 max-h-[400px] overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
