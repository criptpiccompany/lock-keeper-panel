import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Settings, Archive, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveAction, setArchiveAction] = useState<"archive" | "unarchive">("archive");

  const fetchInfluencers = async () => {
    const { data } = await supabase.from('influencers').select('*');
    const enriched = (data || []).map(inf => enrichInfluencer({
      id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
      lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
    }));
    setInfluencers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchInfluencers(); }, []);

  const selected = influencers.find(i => i.id === selectedId);

  const handleArchiveClick = (archive: boolean) => {
    setArchiveAction(archive ? "archive" : "unarchive");
    setArchiveModalOpen(true);
  };

  const handleArchiveConfirm = async (motivo: string) => {
    if (!selected || !user) return;
    
    await supabase.from('influencers').update({ ativo: archiveAction !== "archive" }).eq('id', selected.id);
    await supabase.from('close_events').insert({
      influencer_id: selected.id, influencer_handle: selected.handle,
      feito_por_id: user.id, feito_por_nome: user.nome,
      feito_em: new Date().toISOString(), acao: 'ARQUIVAR',
      motivo: `${archiveAction === "archive" ? "Arquivado" : "Desarquivado"}: ${motivo}`
    });

    toast.success(archiveAction === "archive" ? "Influenciador arquivado" : "Influenciador desarquivado");
    setSelectedId("");
    fetchInfluencers();
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" />Painel Admin
          </h1>
        </div>
      </div>
      <div className="container py-6">
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Atenção</AlertTitle>
          <AlertDescription className="text-amber-700">Todas as ações são registradas no log de auditoria.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Arquivar/Desarquivar</CardTitle>
            <CardDescription>Arquive influenciadores inativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Selecionar Influenciador</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                <SelectContent>
                  {influencers.map(inf => (
                    <SelectItem key={inf.id} value={inf.id}>
                      <div className="flex items-center gap-2">
                        <span>{inf.handle}</span>
                        <StatusBadge status={inf.status} showIcon={false} size="sm" />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selected.handle}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Dono: {selected.ownerNome || "Nenhum"}</p>
                  <p>Último fechamento: {formatDate(selected.lastClosedAt)}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => handleArchiveClick(selected.status !== "ARQUIVADO")}>
                  {selected.status !== "ARQUIVADO" ? <><Archive className="mr-2 h-4 w-4"/>Arquivar</> : <><RefreshCw className="mr-2 h-4 w-4"/>Desarquivar</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReasonModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title={archiveAction === "archive" ? "Arquivar" : "Desarquivar"}
        description={`Informe o motivo para ${archiveAction === "archive" ? "arquivar" : "desarquivar"} ${selected?.handle}`}
        actionLabel="Confirmar"
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
