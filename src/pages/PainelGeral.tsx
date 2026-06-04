import { useEffect, useState } from "react";
import { Info, LayoutGrid, Loader2, Lock, Search } from "lucide-react";

import { EmptyPanel } from "@/components/design/EmptyPanel";
import { MetricCard } from "@/components/design/MetricCard";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocks = async () => {
      const { data, error } = await supabase
        .from("influencer_locks")
        .select("*")
        .gt("locked_until", new Date().toISOString())
        .order("locked_until", { ascending: true });

      if (error) {
        setLoading(false);
        return;
      }

      setLocks((data as LockEntry[]) ?? []);
      setLoading(false);
    };

    void fetchLocks();
  }, []);

  const filteredLocks = locks.filter((lock) =>
    lock.handle_normalized.includes(searchQuery.toLowerCase().replace(/^@/, "")),
  );
  const mineCount = locks.filter((lock) => lock.locked_by_user_id === user?.id).length;
  const expiringSoon = locks.filter((lock) => daysUntil(lock.locked_until) <= 2).length;

  if (loading) {
    return (
      <div className="page-shell">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Consulta compartilhada"
        title="Painel de Consulta"
        description="Visão viva dos influenciadores atualmente protegidos e dos locks prestes a expirar."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="icon-badge" type="button" aria-label="Mais informações">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Os locks são renovados automaticamente a partir da atividade registrada no Planilhamento.
            </TooltipContent>
          </Tooltip>
        }
      />

      <div className="metric-grid">
        <MetricCard label="Locks ativos" value={String(locks.length)} hint="Influenciadores em proteção neste momento." />
        <MetricCard label="Responsabilidade sua" value={String(mineCount)} hint="Itens atribuídos ao seu usuário." />
        <MetricCard label="Expirando" value={String(expiringSoon)} hint="Locks com até 2 dias restantes." />
        <MetricCard label="Resultado da busca" value={String(filteredLocks.length)} hint="Itens exibidos com o filtro atual." />
      </div>

      <PanelCard
        title="Mapa de travas"
        description="Busque por handle para localizar rapidamente quem está com cada lock."
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por handle..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="rounded-full pl-10"
          />
        </div>

        {locks.length === 0 ? (
          <EmptyPanel
            icon={<Lock className="h-5 w-5" />}
            title="Nenhum influenciador travado"
            description="Registre atividade no Planilhamento para criar travas automaticamente."
          />
        ) : filteredLocks.length === 0 ? (
          <EmptyPanel
            icon={<Search className="h-5 w-5" />}
            title="Nenhum resultado"
            description={`Nenhum influenciador encontrado com "${searchQuery}".`}
          />
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th>Influenciador</th>
                    <th>Responsável</th>
                    <th>Última atividade</th>
                    <th>Libera em</th>
                    <th>Dias restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocks.map((lock) => {
                    const isMine = lock.locked_by_user_id === user?.id;
                    const days = daysUntil(lock.locked_until);
                    const toneClass = days <= 2 ? "tone-warning" : "tone-success";

                    return (
                      <tr key={lock.id}>
                        <td className="font-medium">@{lock.handle_normalized}</td>
                        <td>
                          <span className={cn("text-sm", isMine ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {isMine ? "Você" : lock.locked_by_nome || "—"}
                          </span>
                        </td>
                        <td className="text-sm text-muted-foreground">{formatDate(lock.last_activity_at)}</td>
                        <td className="text-sm text-muted-foreground">{formatDate(lock.locked_until)}</td>
                        <td>
                          <Badge variant="outline" className={cn("border", toneClass)}>
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
      </PanelCard>
    </div>
  );
}
