import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/store/useStore";
import { CloseEvent, CloseEventAction } from "@/types";
import { formatDateTime } from "@/lib/helpers";
import { Search, FileText, History, CheckCircle, Shield, Archive } from "lucide-react";

const actionConfig: Record<CloseEventAction, { label: string; icon: any; className: string }> = {
  FECHAMENTO: {
    label: "Fechamento",
    icon: CheckCircle,
    className: "bg-primary/20 text-primary border-primary/50",
  },
  OVERRIDE_ADMIN: {
    label: "Override Admin",
    icon: Shield,
    className: "bg-warning/20 text-warning border-warning/50",
  },
  ARQUIVAR: {
    label: "Arquivar/Desarquivar",
    icon: Archive,
    className: "bg-muted text-muted-foreground border-muted",
  },
};

export default function Auditoria() {
  const { closeEvents, users, getEnrichedInfluencers } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<CloseEventAction | "ALL">("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [influencerFilter, setInfluencerFilter] = useState<string>("ALL");

  const influencers = getEnrichedInfluencers();

  // Filter events
  const filteredEvents = useMemo(() => {
    return closeEvents.filter((event) => {
      // Search by handle
      if (searchQuery && !event.influencerHandle.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Action filter
      if (actionFilter !== "ALL" && event.acao !== actionFilter) {
        return false;
      }
      // User filter
      if (userFilter !== "ALL" && event.feitoPorId !== userFilter) {
        return false;
      }
      // Influencer filter
      if (influencerFilter !== "ALL" && event.influencerId !== influencerFilter) {
        return false;
      }
      return true;
    });
  }, [closeEvents, searchQuery, actionFilter, userFilter, influencerFilter]);

  // Stats
  const stats = {
    total: closeEvents.length,
    fechamentos: closeEvents.filter((e) => e.acao === "FECHAMENTO").length,
    overrides: closeEvents.filter((e) => e.acao === "OVERRIDE_ADMIN").length,
    arquivados: closeEvents.filter((e) => e.acao === "ARQUIVAR").length,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Log de Auditoria</h1>
              <p className="text-muted-foreground">
                Histórico imutável de todas as ações realizadas no sistema
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total de Eventos</p>
              <p className="text-2xl font-bold font-mono text-primary">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-4 border-primary/30 bg-primary/5">
              <p className="text-sm text-muted-foreground">Fechamentos</p>
              <p className="text-2xl font-bold font-mono text-primary">{stats.fechamentos}</p>
            </div>
            <div className="rounded-lg border p-4 border-warning/30 bg-warning/5">
              <p className="text-sm text-muted-foreground">Overrides Admin</p>
              <p className="text-2xl font-bold font-mono text-warning">{stats.overrides}</p>
            </div>
            <div className="rounded-lg border p-4 border-muted bg-muted/20">
              <p className="text-sm text-muted-foreground">Arquivamentos</p>
              <p className="text-2xl font-bold font-mono text-muted-foreground">{stats.arquivados}</p>
            </div>
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

            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Ações</SelectItem>
                <SelectItem value="FECHAMENTO">Fechamento</SelectItem>
                <SelectItem value="OVERRIDE_ADMIN">Override Admin</SelectItem>
                <SelectItem value="ARQUIVAR">Arquivar/Desarquivar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Usuários</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={influencerFilter} onValueChange={setInfluencerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Influenciador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Influenciadores</SelectItem>
                {influencers.map((inf) => (
                  <SelectItem key={inf.id} value={inf.id}>
                    {inf.handle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Timeline */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Timeline Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {filteredEvents.slice(0, 10).map((event) => (
                    <TimelineItem key={event.id} event={event} />
                  ))}
                  {filteredEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum evento encontrado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tabela de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum evento encontrado com esses filtros</p>
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Influenciador</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.map((event) => {
                          const config = actionConfig[event.acao];
                          return (
                            <TableRow key={event.id}>
                              <TableCell>
                                <Badge variant="outline" className={config.className}>
                                  {config.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {event.influencerHandle}
                              </TableCell>
                              <TableCell>{event.feitoPorNome}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {formatDateTime(event.feitoEm)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {event.motivo || "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ event }: { event: CloseEvent }) {
  const config = actionConfig[event.acao];
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.className}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium">{event.feitoPorNome}</p>
        <p className="text-sm text-muted-foreground">
          {config.label} em <span className="font-mono">{event.influencerHandle}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDateTime(event.feitoEm)}
        </p>
        {event.motivo && (
          <p className="text-xs italic text-muted-foreground mt-1">"{event.motivo}"</p>
        )}
      </div>
    </div>
  );
}
