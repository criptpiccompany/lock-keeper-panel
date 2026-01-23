import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Search, LayoutGrid, Loader2, Lock, Info } from "lucide-react";

export default function PainelGeral() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInfluencers = async () => {
    // Closers can only see active, locked influencers
    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .eq('ativo', true);

    if (error) {
      console.error('Error fetching influencers:', error);
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

    // Filter to only show TRAVADO (locked) influencers for closers
    const lockedOnly = enriched.filter(inf => inf.status === 'TRAVADO');

    // Sort by days remaining
    lockedOnly.sort((a, b) => {
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    setInfluencers(lockedOnly);
    setLoading(false);
  };

  useEffect(() => {
    fetchInfluencers();
  }, []);

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
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <LayoutGrid className="h-6 w-6" />
                Painel Geral
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Influenciadores atualmente travados na agência
              </p>
            </div>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-2">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Este painel mostra apenas influenciadores travados. Para ver influenciadores liberados, acesse Meu Painel e registre fechamentos.</p>
              </TooltipContent>
            </Tooltip>
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
            <Lock className="empty-state-icon" />
            <h3 className="empty-state-title">Nenhum influenciador travado</h3>
            <p className="empty-state-description">
              Todos os influenciadores estão liberados no momento.
            </p>
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
                  <th>Responsável</th>
                  <th>Último Fechamento</th>
                  <th>Libera em</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInfluencers.map((inf) => {
                  const isMine = inf.ownerId === user?.id;
                  
                  return (
                    <tr key={inf.id}>
                      <td>
                        <span className="font-medium">{inf.handle}</span>
                      </td>
                      <td>
                        <span className={isMine ? "text-primary font-medium" : "text-muted-foreground"}>
                          {isMine ? "Você" : inf.ownerNome || "—"}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {formatDate(inf.lastClosedAt)}
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {inf.lockedUntil ? formatDate(inf.lockedUntil.toISOString()) : "—"}
                      </td>
                      <td>
                        <StatusBadge status={inf.status} size="sm" />
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
