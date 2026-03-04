import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate, LockInfo } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Search, Book, Loader2, Lock, Unlock, Archive } from "lucide-react";

export default function Diretorio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      const [{ data }, { data: locksData }] = await Promise.all([
        supabase.from('influencers').select('*'),
        supabase.from('influencer_locks').select('influencer_id, locked_until').gt('locked_until', new Date().toISOString()),
      ]);

      const locksMap = new Map<string, LockInfo>();
      for (const l of (locksData || []) as any[]) {
        if (l.influencer_id) locksMap.set(l.influencer_id, { locked_until: l.locked_until });
      }

      const enriched = (data || []).map((inf: any) => ({
        ...enrichInfluencer({
          id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
          lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
        }, locksMap.get(inf.id) || null),
        deleted_at: inf.deleted_at,
      }));
      setInfluencers(enriched);
      setLoading(false);
    };
    fetchInfluencers();
  }, []);

  const filtered = influencers.filter(inf => {
    if (!showArchived && inf.status === 'ARQUIVADO') return false;
    if (!showDeleted && (inf as any).deleted_at) return false;
    return inf.handle.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const stats = {
    total: influencers.length,
    locked: influencers.filter(i => i.status === 'TRAVADO').length,
    released: influencers.filter(i => i.status === 'LIBERADO').length,
    archived: influencers.filter(i => i.status === 'ARQUIVADO').length,
  };

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 mb-6">
            <Book className="h-5 w-5 sm:h-6 sm:w-6" />Diretório
          </h1>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-card rounded-xl border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              <p className="text-xl sm:text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="bg-card rounded-xl border border-amber-200/50 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-amber-700 flex items-center gap-1"><Lock className="h-3 w-3"/>Travados</p>
              <p className="text-xl sm:text-2xl font-semibold text-amber-700">{stats.locked}</p>
            </div>
            <div className="bg-card rounded-xl border border-emerald-200/50 p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-emerald-700 flex items-center gap-1"><Unlock className="h-3 w-3"/>Liberados</p>
              <p className="text-xl sm:text-2xl font-semibold text-emerald-700">{stats.released}</p>
            </div>
            <div className="bg-card rounded-xl border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1"><Archive className="h-3 w-3"/>Arquivados</p>
              <p className="text-xl sm:text-2xl font-semibold">{stats.archived}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                <Label htmlFor="show-archived" className="text-sm">Mostrar arquivados</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
                <Label htmlFor="show-deleted" className="text-sm text-destructive">Mostrar excluídos</Label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="container px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead><tr><th>Handle</th><th>Responsável</th><th>Último Fechamento</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(inf => {
                  const isDeleted = !!(inf as any).deleted_at;
                  return (
                    <tr key={inf.id} className={isDeleted ? "opacity-50" : ""}>
                      <td className="font-medium">
                        {inf.handle}
                        {isDeleted && <Badge variant="outline" className="ml-2 text-[10px] text-destructive border-destructive/30">Excluído</Badge>}
                      </td>
                      <td className="text-muted-foreground">{inf.ownerNome || "—"}</td>
                      <td className="text-muted-foreground text-sm">{formatDate(inf.lastClosedAt)}</td>
                      <td><StatusBadge status={inf.status} size="sm" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
