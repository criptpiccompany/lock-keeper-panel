import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownChip } from "@/components/CountdownChip";
import { AddInfluencerModal } from "@/components/AddInfluencerModal";
import { BulkAddModal } from "@/components/BulkAddModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { 
  Search, 
  UserPlus, 
  Users, 
  Loader2,
  Clock,
  Send,
  CheckCircle2,
  XCircle
} from "lucide-react";

export default function MeuPainel() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

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

    setInfluencers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyInfluencers();
  }, [user]);

  const handlePublicar = async (influencer: InfluencerWithStatus) => {
    if (!user) return;

    setRefreshing(influencer.id);
    const now = new Date().toISOString();

    // Update influencer
    const { error: updateError } = await supabase
      .from('influencers')
      .update({
        last_closed_at: now,
        owner_id: user.id,
        owner_nome: user.nome
      })
      .eq('id', influencer.id);

    if (updateError) {
      toast.error('Erro ao publicar');
      setRefreshing(null);
      return;
    }

    // Create event
    await supabase.from('close_events').insert({
      influencer_id: influencer.id,
      influencer_handle: influencer.handle,
      feito_por_id: user.id,
      feito_por_nome: user.nome,
      feito_em: now,
      acao: 'FECHAMENTO'
    });

    toast.success('Publicado!', {
      description: `${influencer.handle} está publicado por 10 dias.`
    });

    await fetchMyInfluencers();
    setRefreshing(null);
  };

  const handleDespublicar = async (influencer: InfluencerWithStatus) => {
    if (!user) return;

    setRefreshing(influencer.id);

    // Clear the lock by setting last_closed_at to null
    // Keep owner_id and owner_nome so the influencer stays in the closer's list
    const { error: updateError } = await supabase
      .from('influencers')
      .update({
        last_closed_at: null
      })
      .eq('id', influencer.id);

    if (updateError) {
      toast.error('Erro ao despublicar');
      setRefreshing(null);
      return;
    }

    // Create event for audit
    await supabase.from('close_events').insert({
      influencer_id: influencer.id,
      influencer_handle: influencer.handle,
      feito_por_id: user.id,
      feito_por_nome: user.nome,
      feito_em: new Date().toISOString(),
      acao: 'OVERRIDE_ADMIN',
      motivo: 'Despublicado pelo closer'
    });

    toast.success('Despublicado!', {
      description: `${influencer.handle} foi liberado e pode ser capturado por outros.`
    });

    await fetchMyInfluencers();
    setRefreshing(null);
  };

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
                  <th>Último Fechamento</th>
                  <th>Libera em</th>
                  <th>Restante</th>
                  <th>Status</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredInfluencers.map((inf) => {
                  const isExpiring = inf.daysRemaining !== null && inf.daysRemaining <= 2;
                  
                  return (
                    <tr key={inf.id}>
                      <td>
                        <span className="font-medium">{inf.handle}</span>
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {formatDate(inf.lastClosedAt)}
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {inf.lockedUntil ? formatDate(inf.lockedUntil.toISOString()) : "—"}
                      </td>
                      <td>
                        {inf.status === "TRAVADO" ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className={`h-3.5 w-3.5 ${isExpiring ? 'text-amber-500' : 'text-muted-foreground'}`} />
                            <CountdownChip 
                              lockedUntil={inf.lockedUntil} 
                              daysRemaining={inf.daysRemaining}
                              variant="compact"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={inf.status} size="sm" />
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inf.status === "TRAVADO" ? (
                            <>
                              {/* Botão Publicado (verde) - clica para renovar */}
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handlePublicar(inf)}
                                disabled={refreshing === inf.id}
                              >
                                {refreshing === inf.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                    <div className="flex flex-col items-start leading-none">
                                      <span>Publicado</span>
                                      <span className="text-[10px] opacity-80">
                                        {formatDate(inf.lastClosedAt)}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </Button>
                              {/* Botão Despublicar (vermelho) */}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDespublicar(inf)}
                                disabled={refreshing === inf.id}
                              >
                                {refreshing === inf.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                    Despublicar
                                  </>
                                )}
                              </Button>
                            </>
                          ) : (
                            /* Botão Publicar (laranja) - quando LIBERADO */
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => handlePublicar(inf)}
                              disabled={refreshing === inf.id}
                            >
                              {refreshing === inf.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Publicar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
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
