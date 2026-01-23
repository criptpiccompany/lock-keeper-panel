import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfluencerTable } from "@/components/InfluencerTable";
import { useStore } from "@/store/useStore";
import { InfluencerStatus } from "@/types";
import { Search, Book, Users } from "lucide-react";

export default function Diretorio() {
  const { getEnrichedInfluencers, users } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InfluencerStatus | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const allInfluencers = getEnrichedInfluencers();

  // Filter influencers
  const filteredInfluencers = useMemo(() => {
    return allInfluencers.filter((inf) => {
      // Hide archived unless toggle is on
      if (!showArchived && inf.status === "ARQUIVADO") {
        return false;
      }
      // Search by handle
      if (searchQuery && !inf.handle.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && inf.status !== statusFilter) {
        return false;
      }
      // Owner filter
      if (ownerFilter !== "ALL" && inf.ownerId !== ownerFilter) {
        return false;
      }
      return true;
    });
  }, [allInfluencers, searchQuery, statusFilter, ownerFilter, showArchived]);

  // Sort by handle
  const sortedInfluencers = useMemo(() => {
    return [...filteredInfluencers].sort((a, b) => a.handle.localeCompare(b.handle));
  }, [filteredInfluencers]);

  // Stats
  const stats = {
    total: allInfluencers.filter((i) => i.status !== "ARQUIVADO").length,
    locked: allInfluencers.filter((i) => i.status === "TRAVADO").length,
    released: allInfluencers.filter((i) => i.status === "LIBERADO").length,
    archived: allInfluencers.filter((i) => i.status === "ARQUIVADO").length,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-6">
            <Book className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Diretório de Influenciadores</h1>
              <p className="text-muted-foreground">
                Lista completa de todos os influenciadores cadastrados
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total Ativos</p>
              <p className="text-2xl font-bold font-mono text-primary">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-4 border-status-locked/50 bg-status-locked/5">
              <p className="text-sm text-muted-foreground">Travados</p>
              <p className="text-2xl font-bold font-mono text-status-locked">{stats.locked}</p>
            </div>
            <div className="rounded-lg border p-4 border-status-released/50 bg-status-released/5">
              <p className="text-sm text-muted-foreground">Liberados</p>
              <p className="text-2xl font-bold font-mono text-status-released">{stats.released}</p>
            </div>
            <div className="rounded-lg border p-4 border-status-archived/50 bg-status-archived/5">
              <p className="text-sm text-muted-foreground">Arquivados</p>
              <p className="text-2xl font-bold font-mono text-status-archived">{stats.archived}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por @handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Status</SelectItem>
                <SelectItem value="TRAVADO">Travados</SelectItem>
                <SelectItem value="LIBERADO">Liberados</SelectItem>
                {showArchived && <SelectItem value="ARQUIVADO">Arquivados</SelectItem>}
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <Users className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Dono" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Donos</SelectItem>
                {users
                  .filter((u) => u.role === "CLOSER")
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
                Mostrar arquivados
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <InfluencerTable
          influencers={sortedInfluencers}
          columns={["handle", "owner", "lastClosed", "lockedUntil", "status", "action"]}
          emptyMessage="Nenhum influenciador encontrado com esses filtros"
        />
      </div>
    </div>
  );
}
