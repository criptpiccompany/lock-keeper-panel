import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate, LockInfo } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Search, LayoutGrid, Loader2, TrendingUp, Lock, Unlock, Archive } from "lucide-react";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      // Fetch influencers and locks in parallel
      const [{ data }, { data: locksData }] = await Promise.all([
        supabase.from('influencers').select('*'),
        supabase.from('influencer_locks').select('influencer_id, locked_until').gt('locked_until', new Date().toISOString()),
      ]);

      const locksMap = new Map<string, LockInfo>();
      for (const l of (locksData || []) as any[]) {
        if (l.influencer_id) locksMap.set(l.influencer_id, { locked_until: l.locked_until });
      }

      const enriched = (data || []).map(inf => enrichInfluencer({
        id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
        lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
      }, locksMap.get(inf.id) || null));
      setInfluencers(enriched);
      setLoading(false);
    };
    fetchInfluencers();
  }, []);

  const stats = {
    total: influencers.length,
    locked: influencers.filter(i => i.status === 'TRAVADO').length,
    released: influencers.filter(i => i.status === 'LIBERADO').length,
    archived: influencers.filter(i => i.status === 'ARQUIVADO').length,
  };

  const filtered = influencers.filter(inf => 
    inf.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mb-6">
            <TrendingUp className="h-6 w-6" />Dashboard Admin
          </h1>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200/50 p-4">
              <p className="text-sm text-amber-700 flex items-center gap-1"><Lock className="h-3 w-3"/>Travados</p>
              <p className="text-2xl font-semibold text-amber-700">{stats.locked}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200/50 p-4">
              <p className="text-sm text-emerald-700 flex items-center gap-1"><Unlock className="h-3 w-3"/>Liberados</p>
              <p className="text-2xl font-semibold text-emerald-700">{stats.released}</p>
            </div>
            <div className="bg-slate-100 rounded-xl border border-slate-200/50 p-4">
              <p className="text-sm text-slate-600 flex items-center gap-1"><Archive className="h-3 w-3"/>Arquivados</p>
              <p className="text-2xl font-semibold text-slate-600">{stats.archived}</p>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="bg-card rounded-xl border">
          <table className="table-minimal">
            <thead><tr><th>Influenciador</th><th>Responsável</th><th>Último Fechamento</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(inf => (
                <tr key={inf.id}>
                  <td className="font-medium">{inf.handle}</td>
                  <td className="text-muted-foreground">{inf.ownerNome || "—"}</td>
                  <td className="text-muted-foreground text-sm">{formatDate(inf.lastClosedAt)}</td>
                  <td><StatusBadge status={inf.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
