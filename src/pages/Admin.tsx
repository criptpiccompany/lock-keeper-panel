import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/helpers";
import {
  Shield,
  Settings,
  Archive,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  UserCog,
} from "lucide-react";

export default function Admin() {
  const { currentUser, getEnrichedInfluencers, users, archiveInfluencer, adminOverride } = useStore();
  
  // Redirect non-admins
  if (currentUser.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const influencers = getEnrichedInfluencers();
  const closers = users.filter((u) => u.role === "CLOSER");

  // Archive state
  const [selectedInfluencerArchive, setSelectedInfluencerArchive] = useState<string>("");
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveAction, setArchiveAction] = useState<"archive" | "unarchive">("archive");

  // Override state
  const [selectedInfluencerOverride, setSelectedInfluencerOverride] = useState<string>("");
  const [newOwnerId, setNewOwnerId] = useState<string>("");
  const [newDate, setNewDate] = useState<string>("");
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  const selectedForArchive = influencers.find((i) => i.id === selectedInfluencerArchive);
  const selectedForOverride = influencers.find((i) => i.id === selectedInfluencerOverride);

  const handleArchiveClick = (archive: boolean) => {
    if (!selectedForArchive) return;
    setArchiveAction(archive ? "archive" : "unarchive");
    setArchiveModalOpen(true);
  };

  const handleArchiveConfirm = (motivo: string) => {
    if (!selectedForArchive) return;
    archiveInfluencer(selectedForArchive.id, motivo, archiveAction === "archive");
    toast.success(
      archiveAction === "archive"
        ? `${selectedForArchive.handle} foi arquivado`
        : `${selectedForArchive.handle} foi desarquivado`
    );
    setSelectedInfluencerArchive("");
  };

  const handleOverrideClick = () => {
    if (!selectedForOverride) return;
    if (!newOwnerId && !newDate) {
      toast.error("Selecione pelo menos uma alteração (dono ou data)");
      return;
    }
    setOverrideModalOpen(true);
  };

  const handleOverrideConfirm = (motivo: string) => {
    if (!selectedForOverride) return;
    
    const ownerIdToSet = newOwnerId === "NONE" ? null : (newOwnerId || undefined);
    const dateToSet = newDate ? new Date(newDate).toISOString() : undefined;
    
    adminOverride(
      selectedForOverride.id,
      ownerIdToSet !== undefined ? ownerIdToSet : selectedForOverride.ownerId,
      dateToSet !== undefined ? dateToSet : selectedForOverride.lastClosedAt,
      motivo
    );
    
    toast.success(`Override aplicado em ${selectedForOverride.handle}`);
    setSelectedInfluencerOverride("");
    setNewOwnerId("");
    setNewDate("");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-warning" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
              <p className="text-muted-foreground">
                Gestão avançada de influenciadores (apenas admin)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <Alert className="mb-6 border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Atenção</AlertTitle>
          <AlertDescription>
            Todas as ações realizadas neste painel são registradas no log de auditoria e não podem ser apagadas.
            Use com responsabilidade.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Archive/Unarchive Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Arquivar / Desarquivar
              </CardTitle>
              <CardDescription>
                Arquive influenciadores inativos ou desarquive para reativar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Influenciador</Label>
                <Select
                  value={selectedInfluencerArchive}
                  onValueChange={setSelectedInfluencerArchive}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um influenciador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {influencers.map((inf) => (
                      <SelectItem key={inf.id} value={inf.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{inf.handle}</span>
                          <StatusBadge status={inf.status} showIcon={false} />
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedForArchive && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium">{selectedForArchive.handle}</span>
                    <StatusBadge status={selectedForArchive.status} />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Dono: {selectedForArchive.ownerNome || "Nenhum"}</p>
                    <p>Último fechamento: {formatDateTime(selectedForArchive.lastClosedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedForArchive.status !== "ARQUIVADO" ? (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleArchiveClick(true)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleArchiveClick(false)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Desarquivar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Override Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-warning" />
                Override Administrativo
              </CardTitle>
              <CardDescription>
                Altere o dono ou a data do último fechamento de um influenciador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Influenciador</Label>
                <Select
                  value={selectedInfluencerOverride}
                  onValueChange={(v) => {
                    setSelectedInfluencerOverride(v);
                    setNewOwnerId("");
                    setNewDate("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um influenciador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {influencers
                      .filter((i) => i.status !== "ARQUIVADO")
                      .map((inf) => (
                        <SelectItem key={inf.id} value={inf.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{inf.handle}</span>
                            <StatusBadge status={inf.status} showIcon={false} />
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedForOverride && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium">{selectedForOverride.handle}</span>
                    <StatusBadge status={selectedForOverride.status} />
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Dono atual: {selectedForOverride.ownerNome || "Nenhum"}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Último fechamento: {formatDate(selectedForOverride.lastClosedAt)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        Novo Dono (opcional)
                      </Label>
                      <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Manter dono atual" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Sem dono (liberar)</SelectItem>
                          {closers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Nova Data de Fechamento (opcional)
                      </Label>
                      <Input
                        type="datetime-local"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full bg-warning text-warning-foreground hover:bg-warning/90"
                    onClick={handleOverrideClick}
                    disabled={!newOwnerId && !newDate}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Aplicar Override
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Archive Modal */}
      <ReasonModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title={archiveAction === "archive" ? "Arquivar Influenciador" : "Desarquivar Influenciador"}
        description={
          archiveAction === "archive"
            ? `Você está arquivando ${selectedForArchive?.handle}. O influenciador não aparecerá mais nas listagens padrão.`
            : `Você está desarquivando ${selectedForArchive?.handle}. O influenciador voltará às listagens padrão.`
        }
        actionLabel={archiveAction === "archive" ? "Arquivar" : "Desarquivar"}
        onConfirm={handleArchiveConfirm}
        variant="warning"
      />

      {/* Override Modal */}
      <ReasonModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        title="Confirmar Override Administrativo"
        description={`Você está alterando ${selectedForOverride?.handle}. Esta ação será registrada permanentemente no log de auditoria.`}
        actionLabel="Confirmar Override"
        onConfirm={handleOverrideConfirm}
        variant="warning"
      />
    </div>
  );
}
