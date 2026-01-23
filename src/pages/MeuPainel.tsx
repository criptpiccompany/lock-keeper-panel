import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfluencerTable } from "@/components/InfluencerTable";
import { AddInfluencerModal } from "@/components/AddInfluencerModal";
import { useStore } from "@/store/useStore";
import { Search, UserPlus, User, AlertTriangle } from "lucide-react";

export default function MeuPainel() {
  const { getMyInfluencers, currentUser } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const myInfluencers = getMyInfluencers();

  // Filter by search
  const filteredInfluencers = useMemo(() => {
    if (!searchQuery) return myInfluencers;
    return myInfluencers.filter((inf) =>
      inf.handle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [myInfluencers, searchQuery]);

  // Stats
  const expiringSoon = myInfluencers.filter(
    (i) => i.status === "TRAVADO" && i.daysRemaining !== null && i.daysRemaining <= 2
  ).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Meu Painel</h1>
                <p className="text-muted-foreground">
                  Influenciadores sob sua responsabilidade, {currentUser.nome}
                </p>
              </div>
            </div>

            <Button onClick={() => setAddModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Influenciador
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Meus Influenciadores</p>
              <p className="text-2xl font-bold font-mono text-primary">{myInfluencers.length}</p>
            </div>
            <div className="rounded-lg border p-4 border-status-locked/50 bg-status-locked/5">
              <p className="text-sm text-muted-foreground">Travados</p>
              <p className="text-2xl font-bold font-mono text-status-locked">
                {myInfluencers.filter((i) => i.status === "TRAVADO").length}
              </p>
            </div>
            <div className="rounded-lg border p-4 border-status-released/50 bg-status-released/5">
              <p className="text-sm text-muted-foreground">Liberados</p>
              <p className="text-2xl font-bold font-mono text-status-released">
                {myInfluencers.filter((i) => i.status === "LIBERADO").length}
              </p>
            </div>
            <div className="rounded-lg border p-4 border-warning/50 bg-warning/5">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Expirando em breve
              </p>
              <p className="text-2xl font-bold font-mono text-warning">{expiringSoon}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
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
        {myInfluencers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <User className="h-16 w-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Nenhum influenciador no seu painel</h3>
            <p className="text-sm mb-4">
              Adicione influenciadores ou registre fechamentos no Telão para começar.
            </p>
            <Button onClick={() => setAddModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Influenciador
            </Button>
          </div>
        ) : (
          <InfluencerTable
            influencers={filteredInfluencers.sort((a, b) => {
              // Sort by status priority: expiring soon first
              if (a.daysRemaining !== null && b.daysRemaining !== null) {
                return a.daysRemaining - b.daysRemaining;
              }
              return 0;
            })}
            columns={["handle", "lastClosed", "lockedUntil", "countdown", "status", "action"]}
            airportStyle
            emptyMessage="Nenhum influenciador encontrado com esse filtro"
          />
        )}
      </div>

      <AddInfluencerModal open={addModalOpen} onOpenChange={setAddModalOpen} />
    </div>
  );
}
