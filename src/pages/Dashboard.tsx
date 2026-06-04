import { useEffect, useState } from "react";
import { Archive, Loader2, Lock, Search, TrendingUp, Unlock } from "lucide-react";

import { MetricCard } from "@/components/design/MetricCard";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate, type LockInfo } from "@/lib/helpers";
import { type InfluencerWithStatus } from "@/types";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      const [{ data }, { data: locksData }] = await Promise.all([
        supabase.from("influencers").select("*"),
        supabase
          .from("influencer_locks")
          .select("influencer_id, locked_until")
          .gt("locked_until", new Date().toISOString()),
      ]);

      const locksMap = new Map<string, LockInfo>();
      for (const lock of (locksData ?? []) as Array<{ influencer_id: string | null; locked_until: string }>) {
        if (lock.influencer_id) locksMap.set(lock.influencer_id, { locked_until: lock.locked_until });
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
          locksMap.get(influencer.id) ?? null,
        ),
      );

      setInfluencers(enriched);
      setLoading(false);
    };

    void fetchInfluencers();
  }, []);

  const stats = {
    total: influencers.length,
    locked: influencers.filter((influencer) => influencer.status === "TRAVADO").length,
    released: influencers.filter((influencer) => influencer.status === "LIBERADO").length,
    archived: influencers.filter((influencer) => influencer.status === "ARQUIVADO").length,
  };

  const filtered = influencers.filter((influencer) =>
    influencer.handle.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        eyebrow="Administração"
        title="Dashboard"
        description="Leitura consolidada do parque de influenciadores e do status operacional do momento."
      />

      <div className="metric-grid">
        <MetricCard label="Total" value={String(stats.total)} icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Travados" value={String(stats.locked)} icon={<Lock className="h-4 w-4" />} />
        <MetricCard label="Liberados" value={String(stats.released)} icon={<Unlock className="h-4 w-4" />} />
        <MetricCard label="Arquivados" value={String(stats.archived)} icon={<Archive className="h-4 w-4" />} />
      </div>

      <PanelCard
        title="Base de influenciadores"
        description="Busque por handle para localizar rapidamente qualquer registro da operação."
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="rounded-full pl-10"
          />
        </div>

        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th>Influenciador</th>
                  <th>Responsável</th>
                  <th>Último fechamento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((influencer) => (
                  <tr key={influencer.id}>
                    <td className="font-medium">{influencer.handle}</td>
                    <td className="text-muted-foreground">{influencer.ownerNome || "—"}</td>
                    <td className="text-sm text-muted-foreground">{formatDate(influencer.lastClosedAt)}</td>
                    <td>
                      <StatusBadge status={influencer.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
