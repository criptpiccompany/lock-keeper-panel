import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Loader2, Lock, Info, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LockEntry {
  id: string;
  handle_normalized: string;
  locked_by_user_id: string;
  locked_by_nome: string | null;
  locked_until: string;
  last_activity_at: string;
  influencer_id: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export default function PainelGeral() {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocks = async () => {
    const { data, error } = await supabase
      .from("influencer_locks")
      .select("*")
      .gt("locked_until", new Date().toISOString())
      .order("locked_until", { ascending: true });

    if (error) {
      console.error("Error fetching locks:", error);
      setLoading(false);
      return;
    }

    setLocks((data as LockEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLocks();
  }, []);

  const filteredLocks = locks.filter((l) =>
    l.handle_normalized.includes(searchQuery.toLowerCase().replace(/^@/, ""))
  );
  const mineCount = locks.filter((lock) => lock.locked_by_user_id === user?.id).length;
  const expiringCount = locks.filter((lock) => daysUntil(lock.locked_until) <= 2).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] bg-white py-20 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#676767]">
              <LayoutGrid className="h-3.5 w-3.5" />
              Lock Board
            </div>
            <div>
              <h2 className="text-[34px] font-medium tracking-[-0.06em] text-foreground sm:text-[42px]">
                Painel Geral
              </h2>
              <p className="mt-2 text-[14px] text-[#6e6e73]">
                Influenciadores travados, responsáveis e janelas de liberação em uma leitura operacional única.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                Travados: <span className="ml-1 text-[#1f1f1f]">{locks.length}</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                Seus: <span className="ml-1 text-[#1f1f1f]">{mineCount}</span>
              </div>
              {expiringCount > 0 && (
                <div className="inline-flex items-center rounded-full bg-[#fff8eb] px-4 py-2 text-[12px] font-medium text-[#9a6a16] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[#f0dfb4]">
                  Liberando em breve: <span className="ml-1 text-[#7c5712]">{expiringCount}</span>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] transition-colors hover:text-[#1f1f1f]">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Os locks são criados automaticamente ao registrar no Planilhamento Diário. Cada novo registro renova o travamento por +10 dias.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a96]" />
              <Input
                placeholder="Buscar por @handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-full border-[#ececeb] bg-white pl-11 pr-4 text-[14px] shadow-none"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">

        {locks.length === 0 ? (
          <div className="rounded-[28px] bg-white py-20 text-center text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <Lock className="mx-auto mb-4 h-10 w-10 opacity-30" />
            <h3 className="text-[18px] font-medium text-[#1f1f1f]">Nenhum influenciador travado</h3>
            <p className="mt-2 text-sm text-[#6e6e73]">
              Registre atividade no Planilhamento Diário para travar influenciadores automaticamente.
            </p>
          </div>
        ) : filteredLocks.length === 0 ? (
          <div className="rounded-[28px] bg-white py-20 text-center text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <Search className="mx-auto mb-4 h-10 w-10 opacity-30" />
            <h3 className="text-[18px] font-medium text-[#1f1f1f]">Nenhum resultado</h3>
            <p className="mt-2 text-sm text-[#6e6e73]">
              Nenhum influenciador encontrado com "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <div className="mb-3 flex items-center justify-between px-2 pt-2">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Travamentos ativos</div>
                <div className="mt-1 text-[24px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Influenciadores protegidos</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                  {filteredLocks.length} resultados
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-[#ececeb] bg-white px-4 text-[13px] font-medium text-[#1f1f1f] hover:bg-[#f6f4f0]"
                    onClick={() => {
                      const text = filteredLocks
                        .map((l, i) => `${i + 1}. @${l.handle_normalized}`)
                        .join("\n");
                      navigator.clipboard.writeText(text).then(
                        () => toast.success("Lista copiada"),
                        () => toast.error("Não foi possível copiar")
                      );
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar lista
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-5 text-left text-[12px] font-medium text-[#6e6e6e] w-12">#</th>
                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Influenciador</th>
                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Responsável</th>
                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Última Atividade</th>
                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Libera em</th>
                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Dias Restantes</th>
                </tr>
                <tr>
                  <td colSpan={6} className="px-5">
                    <div className="border-b border-dashed border-[#e6ddb0]" />
                  </td>
                </tr>
              </thead>
              <tbody>
                {filteredLocks.map((lock) => {
                  const isMine = lock.locked_by_user_id === user?.id;
                  const days = daysUntil(lock.locked_until);
                  const isExpiring = days <= 2;

                  return (
                    <tr key={lock.id} className="odd:bg-white even:bg-[#fbfbf8]">
                      <td className="px-5 py-4">
                        <span className="text-[13px] font-medium text-[#1f1f1f]">@{lock.handle_normalized}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={isMine ? "text-[13px] font-medium text-[#1f1f1f]" : "text-[13px] text-[#6e6e73]"}>
                          {isMine ? "Você" : lock.locked_by_nome || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-[#6e6e73]">
                        {formatDate(lock.last_activity_at)}
                      </td>
                      <td className="px-4 py-4 text-[13px] text-[#6e6e73]">
                        {formatDate(lock.locked_until)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className={
                            isExpiring
                              ? "rounded-full border-amber-200/60 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
                              : "rounded-full border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                          }
                        >
                          {days}d
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
