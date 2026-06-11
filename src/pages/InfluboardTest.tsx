import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function InfluboardTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("influboard-scrape");
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const inertia = result?.inertiaData;
  const props = inertia?.props;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Experimental</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-950">Teste Influboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Faz login no Influboard usando as credenciais do cofre e baixa o Painel de Consulta. Use para validar se o scraping funciona.
        </p>
      </div>

      <Button onClick={run} disabled={loading} className="bg-[#FFD400] text-slate-950 hover:bg-[#ffdf33]">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando…</> : "Testar scraping"}
      </Button>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Erro</div>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error}</pre>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
            <div className="text-xs uppercase tracking-wider text-slate-400">Resumo</div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Login status</dt><dd className="font-mono">{result.loginStatus}</dd>
              <dt className="text-slate-500">Login redirect</dt><dd className="font-mono break-all">{result.loginLocation || "—"}</dd>
              <dt className="text-slate-500">Painel status</dt><dd className="font-mono">{result.finalStatus}</dd>
              <dt className="text-slate-500">Tamanho HTML</dt><dd className="font-mono">{result.htmlLength}</dd>
              <dt className="text-slate-500">Inertia detectado</dt><dd className="font-mono">{inertia ? "sim" : "não"}</dd>
            </dl>
          </div>

          {props && (
            <div className="rounded-2xl bg-white p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
              <div className="text-xs uppercase tracking-wider text-slate-400">Inertia props (chaves)</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(props).map((k) => (
                  <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">{k}</span>
                ))}
              </div>
            </div>
          )}

          <details className="rounded-2xl bg-white p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Ver JSON completo</summary>
            <pre className="mt-3 max-h-[500px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
