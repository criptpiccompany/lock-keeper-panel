import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Search, Book, Loader2 } from "lucide-react";

export default function Diretorio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfluencers = async () => {
      const { data } = await supabase.from('influencers').select('*');
      const enriched = (data || []).map((inf: any) => ({
        ...enrichInfluencer({
          id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
          lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
        }),
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

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mb-6">
            <Book className="h-6 w-6" />Diretório
          </h1>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm">Mostrar arquivados</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
              <Label htmlFor="show-deleted" className="text-sm text-red-600">Mostrar excluídos</Label>
            </div>
          </div>
        </div>
      </div>
      <div className="container py-6">
        <div className="bg-card rounded-xl border">
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
  );
}
