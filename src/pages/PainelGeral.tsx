import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/helpers";
import { Search, LayoutGrid, Loader2, Lock, Info } from "lucide-react";

interface PublicInfluencer {
  id: string;
  handle: string;
  last_closed_at: string | null;
  ativo: boolean;
  created_at: string;
  is_locked: boolean;
  locked_until: string | null;
}

export default function PainelGeral() {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [influencers, setInfluencers] = useState<PublicInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInfluencers = async () => {
    if (isAdmin) {
      // Admins can see the full table
      const { data, error } = await supabase
        .from('influencers')
        .select('id, handle, last_closed_at, ativo, created_at, owner_id')
        .eq('ativo', true);

      if (error) {
        console.error('Error fetching influencers:', error);
        setLoading(false);
        return;
      }

      // Map to PublicInfluencer format with computed lock status
      const mapped: PublicInfluencer[] = (data || []).map(inf => {
        const isLocked = inf.owner_id && inf.last_closed_at && 
          new Date(inf.last_closed_at).getTime() + (10 * 24 * 60 * 60 * 1000) > Date.now();
        const lockedUntil = isLocked && inf.last_closed_at
          ? new Date(new Date(inf.last_closed_at).getTime() + (10 * 24 * 60 * 60 * 1000)).toISOString()
          : null;
        
        return {
          id: inf.id,
          handle: inf.handle,
          last_closed_at: inf.last_closed_at,
          ativo: inf.ativo,
          created_at: inf.created_at,
          is_locked: !!isLocked,
          locked_until: lockedUntil
        };
      });

      // Filter to only locked
      const lockedOnly = mapped.filter(inf => inf.is_locked);
      setInfluencers(lockedOnly);
    } else {
      // Closers use the secure RPC function that doesn't expose owner info
      const { data, error } = await supabase.rpc('get_public_influencers');

      if (error) {
        console.error('Error fetching public influencers:', error);
        setLoading(false);
        return;
      }

      // Filter to only locked
      const lockedOnly = (data || []).filter((inf: PublicInfluencer) => inf.is_locked);
      setInfluencers(lockedOnly);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchInfluencers();
  }, [isAdmin]);

  // Filter by search
  const filteredInfluencers = influencers.filter(inf =>
    inf.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by locked_until (closest to unlock first)
  const sortedInfluencers = [...filteredInfluencers].sort((a, b) => {
    if (!a.locked_until) return 1;
    if (!b.locked_until) return -1;
    return new Date(a.locked_until).getTime() - new Date(b.locked_until).getTime();
  });

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
        ) : sortedInfluencers.length === 0 ? (
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedInfluencers.map((inf) => (
                  <tr key={inf.id}>
                    <td>
                      <span className="font-medium">{inf.handle}</span>
                    </td>
                    <td className="text-muted-foreground text-sm">
                      {formatDate(inf.last_closed_at)}
                    </td>
                    <td className="text-muted-foreground text-sm">
                      {inf.locked_until ? formatDate(inf.locked_until) : "—"}
                    </td>
                    <td>
                      <StatusBadge status="TRAVADO" size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Exibindo apenas influenciadores travados. Informações de responsável são privadas.
          </p>
        )}
      </div>
    </div>
  );
}
