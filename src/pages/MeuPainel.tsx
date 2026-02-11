import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { AddInfluencerModal } from "@/components/AddInfluencerModal";
import { BulkAddModal } from "@/components/BulkAddModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  UserPlus, 
  Users, 
  Loader2,
} from "lucide-react";

export default function MeuPainel() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [locksMap, setLocksMap] = useState<Map<string, { locked_until: string }>>(new Map());

  const fetchMyInfluencers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .eq('owner_id', user.id)
      .eq('ativo', true);

    if (error) {
      console.error('Error fetching influencers:', error);
      toast.error('Erro ao carregar influenciadores');
      return;
    }

    const enriched = (data || []).map(inf => enrichInfluencer({
      id: inf.id,
      handle: inf.handle,
      ownerId: inf.owner_id,
      ownerNome: inf.owner_nome,
      lastClosedAt: inf.last_closed_at,
      ativo: inf.ativo,
      notas: inf.notas || undefined
    }));

    // Sort by days remaining (soonest first)
    enriched.sort((a, b) => {
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    // Fetch locks for this user's influencers
    const handles = enriched.map(inf => inf.handle.trim().toLowerCase().replace(/^@/, ""));
    if (handles.length > 0) {
      const { data: locksData } = await supabase
        .from("influencer_locks")
        .select("handle_normalized, locked_until")
        .in("handle_normalized", handles)
        .gt("locked_until", new Date().toISOString());
      const map = new Map<string, { locked_until: string }>();
      for (const l of (locksData || []) as any[]) {
        map.set(l.handle_normalized, { locked_until: l.locked_until });
      }
      setLocksMap(map);
    } else {
      setLocksMap(new Map());
    }

    setInfluencers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyInfluencers();
  }, [user]);

  // Filter by search
  const filteredInfluencers = influencers.filter(inf =>
    inf.handle.toLowerCase().includes(searchQuery.toLowerCase())
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Minha Lista</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gerencie seus influenciadores
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
              <Button onClick={() => setBulkModalOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                Adicionar Vários
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por @handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {influencers.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <h3 className="empty-state-title">Nenhum influenciador ainda</h3>
            <p className="empty-state-description mb-4">
              Adicione influenciadores ou registre fechamentos para começar.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
              <Button onClick={() => setBulkModalOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                Adicionar Vários
              </Button>
            </div>
          </div>
        ) : filteredInfluencers.length === 0 ? (
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
                  <th>Dias Restantes</th>
                  <th>Status</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredInfluencers.map((inf) => {
                  const handleNorm = inf.handle.trim().toLowerCase().replace(/^@/, "");
                  const lock = locksMap.get(handleNorm);
                  const daysLeft = lock
                    ? Math.max(0, Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                    : null;
                  const isExpiring = daysLeft !== null && daysLeft <= 2;

                  return (
                    <tr key={inf.id}>
                      <td>
                        <span className="font-medium">{inf.handle}</span>
                      </td>
                      <td>
                        {daysLeft !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              isExpiring
                                ? "bg-amber-50 text-amber-700 border-amber-200/50"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                            }
                          >
                            {daysLeft}d
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={inf.status} size="sm" />
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {inf.notas || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddInfluencerModal 
        open={addModalOpen} 
        onOpenChange={setAddModalOpen}
        onSuccess={fetchMyInfluencers}
      />
      <BulkAddModal 
        open={bulkModalOpen} 
        onOpenChange={setBulkModalOpen}
        onSuccess={fetchMyInfluencers}
      />
    </div>
  );
}
