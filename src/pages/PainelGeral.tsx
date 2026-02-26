import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Loader2, Lock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <LayoutGrid className="h-6 w-6" />
                Painel Geral
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Influenciadores atualmente travados (atualizado automaticamente pelo Planilhamento Diário)
              </p>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-2">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Os locks são criados automaticamente ao registrar no Planilhamento Diário. Cada novo registro renova o travamento por +10 dias.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Locks Section */}
      <div className="container py-6 space-y-6">

        {/* Locks Section */}
        {locks.length === 0 ? (
          <div className="empty-state">
            <Lock className="empty-state-icon" />
            <h3 className="empty-state-title">Nenhum influenciador travado</h3>
            <p className="empty-state-description">
              Registre atividade no Planilhamento Diário para travar influenciadores automaticamente.
            </p>
          </div>
        ) : filteredLocks.length === 0 ? (
          <div className="empty-state">
            <Search className="empty-state-icon" />
            <h3 className="empty-state-title">Nenhum resultado</h3>
            <p className="empty-state-description">
              Nenhum influenciador encontrado com "{searchQuery}"
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th>Influenciador</th>
                  <th>Responsável</th>
                  <th>Última Atividade</th>
                  <th>Libera em</th>
                  <th>Dias Restantes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocks.map((lock) => {
                  const isMine = lock.locked_by_user_id === user?.id;
                  const days = daysUntil(lock.locked_until);
                  const isExpiring = days <= 2;

                  return (
                    <tr key={lock.id}>
                      <td>
                        <span className="font-medium">@{lock.handle_normalized}</span>
                      </td>
                      <td>
                        <span className={isMine ? "text-primary font-medium" : "text-muted-foreground"}>
                          {isMine ? "Você" : lock.locked_by_nome || "—"}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {formatDate(lock.last_activity_at)}
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {formatDate(lock.locked_until)}
                      </td>
                      <td>
                        <Badge
                          variant="outline"
                          className={
                            isExpiring
                              ? "bg-amber-50 text-amber-700 border-amber-200/50"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200/50"
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
        )}
      </div>
    </div>
  );
}
