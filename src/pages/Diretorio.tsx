import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Search, Book, Loader2, Users, Lock, Unlock, Archive } from "lucide-react";

export default function Diretorio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      const { data } = await supabase.from('influencers').select('*');
      const enriched = (data || []).map(inf => enrichInfluencer({
        id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
        lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
      }));
      setInfluencers(enriched);
      setLoading(false);
    };
    fetchInfluencers();
  }, []);

  const filtered = influencers.filter(inf => {
    if (!showArchived && inf.status === 'ARQUIVADO') return false;
    return inf.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (inf.ownerNome || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const stats = {
    total: influencers.filter(i => i.status !== 'ARQUIVADO').length,
    locked: influencers.filter(i => i.status === 'TRAVADO').length,
    released: influencers.filter(i => i.status === 'LIBERADO').length,
    archived: influencers.filter(i => i.status === 'ARQUIVADO').length,
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mb-2">
            <Book className="h-6 w-6" />Diretório de Influenciadores
          </h1>
          <p className="text-muted-foreground text-sm mb-6">Lista completa de todos os influenciadores de todos os closers</p>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card rounded-lg border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Ativos</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Travados</p>
                <p className="text-lg font-semibold text-amber-700">{stats.locked}</p>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Unlock className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Liberados</p>
                <p className="text-lg font-semibold text-emerald-700">{stats.released}</p>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Archive className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Arquivados</p>
                <p className="text-lg font-semibold text-slate-600">{stats.archived}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por handle ou closer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm">Mostrar arquivados</Label>
            </div>
          </div>
        </div>
      </div>
      <div className="container py-6">
        <div className="bg-card rounded-xl border">
          <table className="table-minimal">
            <thead>
              <tr>
                <th>Handle</th>
                <th>Closer Responsável</th>
                <th>Último Fechamento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum influenciador encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(inf => (
                  <tr key={inf.id}>
                    <td className="font-medium">{inf.handle}</td>
                    <td>
                      {inf.ownerNome ? (
                        <Badge variant="outline" className="font-normal">{inf.ownerNome}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Sem dono</span>
                      )}
                    </td>
                    <td className="text-muted-foreground text-sm">{formatDate(inf.lastClosedAt)}</td>
                    <td><StatusBadge status={inf.status} size="sm" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Exibindo {filtered.length} de {influencers.length} influenciadores
        </p>
      </div>
    </div>
  );
}
