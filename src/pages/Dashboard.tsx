import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfluencerTable } from "@/components/InfluencerTable";
import { useStore } from "@/store/useStore";
import { InfluencerWithStatus, InfluencerStatus } from "@/types";
import { Search, Lock, Unlock, MonitorPlay } from "lucide-react";

export default function Dashboard() {
  const { getEnrichedInfluencers, users, currentUser } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InfluencerStatus | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  const allInfluencers = getEnrichedInfluencers();

  // Filter influencers
  const filteredInfluencers = useMemo(() => {
    return allInfluencers.filter((inf) => {
      // Search by handle
      if (searchQuery && !inf.handle.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && inf.status !== statusFilter) {
        return false;
      }
      // Owner filter
      if (ownerFilter === "MINE" && inf.ownerId !== currentUser.id) {
        return false;
      }
      if (ownerFilter !== "ALL" && ownerFilter !== "MINE" && inf.ownerId !== ownerFilter) {
        return false;
      }
      return true;
    });
  }, [allInfluencers, searchQuery, statusFilter, ownerFilter, currentUser.id]);

  // Separate locked and released
  const lockedInfluencers = useMemo(() => {
    return filteredInfluencers
      .filter((inf) => inf.status === "TRAVADO")
      .sort((a, b) => {
        // Sort by lockedUntil (soonest to expire first)
        if (!a.lockedUntil) return 1;
        if (!b.lockedUntil) return -1;
        return a.lockedUntil.getTime() - b.lockedUntil.getTime();
      });
  }, [filteredInfluencers]);

  const releasedInfluencers = useMemo(() => {
    return filteredInfluencers.filter((inf) => inf.status === "LIBERADO");
  }, [filteredInfluencers]);

  const archivedInfluencers = useMemo(() => {
    return filteredInfluencers.filter((inf) => inf.status === "ARQUIVADO");
  }, [filteredInfluencers]);

  // Stats
  const stats = {
    total: allInfluencers.length,
    locked: allInfluencers.filter((i) => i.status === "TRAVADO").length,
    released: allInfluencers.filter((i) => i.status === "LIBERADO").length,
    archived: allInfluencers.filter((i) => i.status === "ARQUIVADO").length,
    expiringSoon: allInfluencers.filter(
      (i) => i.status === "TRAVADO" && i.daysRemaining !== null && i.daysRemaining <= 2
    ).length,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-6">
            <MonitorPlay className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Telão de Influenciadores</h1>
              <p className="text-muted-foreground">
                Painel estilo aeroporto com contagem regressiva em tempo real
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Travados" value={stats.locked} variant="locked" />
            <StatCard label="Liberados" value={stats.released} variant="released" />
            <StatCard label="Arquivados" value={stats.archived} variant="archived" />
            <StatCard label="Expirando" value={stats.expiringSoon} variant="warning" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
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
                <SelectItem value="ARQUIVADO">Arquivados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Dono" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Donos</SelectItem>
                <SelectItem value="MINE">Só Meus</SelectItem>
                {users
                  .filter((u) => u.role === "CLOSER")
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <Tabs defaultValue="locked" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="locked" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Travados ({lockedInfluencers.length})
            </TabsTrigger>
            <TabsTrigger value="released" className="flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              Liberados ({releasedInfluencers.length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center gap-2">
              Arquivados ({archivedInfluencers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locked" className="space-y-4">
            <InfluencerTable
              influencers={lockedInfluencers}
              columns={["handle", "owner", "lastClosed", "lockedUntil", "countdown", "status"]}
              airportStyle
              emptyMessage="Nenhum influenciador travado"
            />
          </TabsContent>

          <TabsContent value="released" className="space-y-4">
            <InfluencerTable
              influencers={releasedInfluencers}
              columns={["handle", "lastClosed", "status", "action"]}
              airportStyle
              emptyMessage="Nenhum influenciador liberado"
            />
          </TabsContent>

          <TabsContent value="archived" className="space-y-4">
            <InfluencerTable
              influencers={archivedInfluencers}
              columns={["handle", "owner", "lastClosed", "status"]}
              emptyMessage="Nenhum influenciador arquivado"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  variant?: "default" | "locked" | "released" | "archived" | "warning";
}

function StatCard({ label, value, variant = "default" }: StatCardProps) {
  const variantClasses = {
    default: "border-border",
    locked: "border-status-locked/50 bg-status-locked/5",
    released: "border-status-released/50 bg-status-released/5",
    archived: "border-status-archived/50 bg-status-archived/5",
    warning: "border-warning/50 bg-warning/5",
  };

  const valueClasses = {
    default: "text-foreground",
    locked: "text-status-locked",
    released: "text-status-released",
    archived: "text-status-archived",
    warning: "text-warning",
  };

  return (
    <div className={`rounded-lg border p-4 ${variantClasses[variant]}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueClasses[variant]}`}>{value}</p>
    </div>
  );
}
