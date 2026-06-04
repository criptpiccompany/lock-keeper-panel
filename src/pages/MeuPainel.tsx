import { useEffect, useState } from "react";
import { Link as LinkIcon, Loader2, Search, UserPlus, Users } from "lucide-react";

import { AddInfluencerByUrlModal } from "@/components/AddInfluencerByUrlModal";
import { AddInfluencerModal } from "@/components/AddInfluencerModal";
import { BulkAddModal } from "@/components/BulkAddModal";
import { EmptyPanel } from "@/components/design/EmptyPanel";
import { MetricCard } from "@/components/design/MetricCard";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, type LockInfo } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { type InfluencerWithStatus } from "@/types";
import { toast } from "sonner";

export default function MeuPainel() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [locksMap, setLocksMap] = useState<Map<string, { locked_until: string }>>(new Map());

  const fetchMyInfluencers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("influencers")
      .select("*")
      .eq("owner_id", user.id)
      .eq("ativo", true);

    if (error) {
      toast.error("Erro ao carregar influenciadores");
      return;
    }

    const ids = (data ?? []).map((influencer) => influencer.id);
    const nextLocksMap = new Map<string, LockInfo>();

    if (ids.length > 0) {
      const { data: locksData } = await supabase
        .from("influencer_locks")
        .select("influencer_id, handle_normalized, locked_until")
        .gt("locked_until", new Date().toISOString());

      const handleMap = new Map<string, { locked_until: string }>();

      for (const lock of (locksData ?? []) as Array<{
        influencer_id: string | null;
        handle_normalized: string;
        locked_until: string;
      }>) {
        if (lock.influencer_id) {
          nextLocksMap.set(lock.influencer_id, { locked_until: lock.locked_until });
        }
        handleMap.set(lock.handle_normalized, { locked_until: lock.locked_until });
      }

      setLocksMap(handleMap);
    } else {
      setLocksMap(new Map());
    }

    const enriched = (data ?? []).map((influencer) =>
      enrichInfluencer(
        {
          id: influencer.id,
          handle: influencer.handle,
          ownerId: influencer.owner_id,
          ownerNome: influencer.owner_nome,
          lastClosedAt: influencer.last_closed_at,
          ativo: influencer.ativo,
          notas: influencer.notas || undefined,
        },
        nextLocksMap.get(influencer.id) ?? null,
      ),
    );

    enriched.sort((first, second) => {
      if (first.daysRemaining === null) return 1;
      if (second.daysRemaining === null) return -1;
      return first.daysRemaining - second.daysRemaining;
    });

    setInfluencers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    void fetchMyInfluencers();
  }, [user]);

  const filteredInfluencers = influencers.filter((influencer) =>
    influencer.handle.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const expiringSoon = influencers.filter((influencer) => influencer.daysRemaining !== null && influencer.daysRemaining <= 2).length;
  const lockedCount = influencers.filter((influencer) => influencer.status === "TRAVADO").length;

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
        eyebrow="Operação closer"
        title="Minha Lista"
        description="Gerencie seus influenciadores, acompanhe expirações e mantenha a fila de trabalho sempre limpa."
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => setUrlModalOpen(true)}>
              <LinkIcon className="mr-2 h-4 w-4" />
              URL
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setAddModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
            <Button className="rounded-full" onClick={() => setBulkModalOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Vários
            </Button>
          </>
        }
      />

      <div className="metric-grid">
        <MetricCard label="Influenciadores" value={String(influencers.length)} hint="Base ativa atribuída a você." />
        <MetricCard label="Travados" value={String(lockedCount)} hint="Contatos protegidos no momento." />
        <MetricCard label="Expirando" value={String(expiringSoon)} hint="Locks com até 2 dias restantes." />
        <MetricCard label="Busca ativa" value={String(filteredInfluencers.length)} hint="Itens exibidos após o filtro atual." />
      </div>

      <PanelCard
        title="Carteira ativa"
        description="Use a busca para localizar handles e agir rápido nos vencimentos."
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por @handle..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="rounded-full pl-10"
          />
        </div>

        {influencers.length === 0 ? (
          <EmptyPanel
            icon={<Users className="h-5 w-5" />}
            title="Nenhum influenciador ainda"
            description="Adicione influenciadores ou registre fechamentos para começar sua carteira."
            action={
              <>
                <Button variant="outline" className="rounded-full" onClick={() => setAddModalOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
                <Button className="rounded-full" onClick={() => setBulkModalOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Adicionar vários
                </Button>
              </>
            }
          />
        ) : filteredInfluencers.length === 0 ? (
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
                    <th>Dias restantes</th>
                    <th>Status</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInfluencers.map((influencer) => {
                    const handleNormalized = influencer.handle.trim().toLowerCase().replace(/^@/, "");
                    const lock = locksMap.get(handleNormalized);
                    const daysLeft = lock
                      ? Math.max(
                          0,
                          Math.ceil(
                            (new Date(lock.locked_until).getTime() - Date.now()) /
                              (24 * 60 * 60 * 1000),
                          ),
                        )
                      : null;
                    const toneClass = daysLeft !== null && daysLeft <= 2 ? "tone-warning" : "tone-success";

                    return (
                      <tr key={influencer.id}>
                        <td className="font-medium">{influencer.handle}</td>
                        <td>
                          {daysLeft !== null ? (
                            <Badge variant="outline" className={cn("border", toneClass)}>
                              {daysLeft}d
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={influencer.status} size="sm" />
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {influencer.notas || "—"}
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

      <AddInfluencerModal open={addModalOpen} onOpenChange={setAddModalOpen} onSuccess={fetchMyInfluencers} />
      <BulkAddModal open={bulkModalOpen} onOpenChange={setBulkModalOpen} onSuccess={fetchMyInfluencers} />
      <AddInfluencerByUrlModal open={urlModalOpen} onOpenChange={setUrlModalOpen} onSuccess={fetchMyInfluencers} />
    </div>
  );
}
