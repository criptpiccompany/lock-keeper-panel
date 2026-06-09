import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, brandTabsListClass, brandTabsTriggerClass } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/helpers";
import { toast } from "sonner";
import {
  Bell,
  Loader2,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  FileImage,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface AdminNotification {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
  entity_type: string;
  entity_id: string | null;
  influencer_handle: string | null;
  action: string;
  field_changes: Record<string, any> | null;
  edit_reason: string;
  audit_log_id: string | null;
  review_status: "PENDENTE" | "REVISADO" | "SUSPEITO";
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const ENTITY_LABELS: Record<string, string> = {
  daily_influencer_records: "Registro Diário",
  influencers: "Influenciador",
  daily_sheets: "Dia (Seção)",
  close_events: "Evento de Fechamento",
};

const FIELD_LABELS: Record<string, string> = {
  valor_pago: "Valor Pago",
  faturamento: "Faturamento",
  acumulado: "Acumulado",
  status: "Status",
  comprovante_url: "Comprovante",
  observacao: "Observação",
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  PENDENTE: { label: "Pendente", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  REVISADO: { label: "Revisado", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SUSPEITO: { label: "Suspeito", icon: AlertTriangle, className: "bg-red-50 text-red-700 border-red-200" },
};

const ACTION_TYPE_OPTIONS = [
  { value: "ALL", label: "Todos tipos" },
  { value: "edit", label: "Edição de campo" },
  { value: "comprovante", label: "Comprovante alterado" },
];

const PAGE_SIZE = 30;

function formatValue(val: any): string {
  if (val === null || val === undefined) return "(vazio)";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  return String(val);
}

export default function Notificacoes() {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterActor, setFilterActor] = useState<string>("ALL");
  const [filterActionType, setFilterActionType] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [detailNotif, setDetailNotif] = useState<AdminNotification | null>(null);
  const [updating, setUpdating] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const fetchNotifications = async () => {
    setLoading(true);
    const [notifRes, teamsRes] = await Promise.all([
      supabase
        .from("admin_notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      isAdmin ? supabase.from("teams").select("id, name") : Promise.resolve({ data: [] }),
    ]);
    setNotifications((notifRes.data as any as AdminNotification[]) || []);
    const fetchedTeams = (teamsRes.data as Team[]) || [];
    setTeams(fetchedTeams);
    if (fetchedTeams.length > 0) setSelectedTeamId(fetchedTeams[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  // Filter by team (ADMIN only)
  const teamFilteredNotifications = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return notifications;
    return notifications.filter((n) => (n as any).team_id === selectedTeamId);
  }, [notifications, isAdmin, selectedTeamId]);

  // Reset filters when team changes
  useEffect(() => { setFilterActor("ALL"); setPage(0); }, [selectedTeamId]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    teamFilteredNotifications.forEach((n) => {
      if (n.actor_user_id && n.actor_nome) map.set(n.actor_user_id, n.actor_nome);
    });
    return Array.from(map.entries());
  }, [teamFilteredNotifications]);

  const filtered = useMemo(() => {
    let result = teamFilteredNotifications;
    if (filterStatus !== "ALL") result = result.filter((n) => n.review_status === filterStatus);
    if (filterActor !== "ALL") result = result.filter((n) => n.actor_user_id === filterActor);
    if (filterActionType === "comprovante") {
      result = result.filter((n) => n.field_changes && "comprovante_url" in (n.field_changes || {}));
    } else if (filterActionType === "edit") {
      result = result.filter((n) => !n.field_changes || !("comprovante_url" in (n.field_changes || {})));
    }
    if (dateFrom) {
      result = result.filter((n) => n.created_at >= dateFrom);
    }
    if (dateTo) {
      const end = dateTo + "T23:59:59";
      result = result.filter((n) => n.created_at <= end);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          (n.actor_nome || "").toLowerCase().includes(q) ||
          (n.actor_email || "").toLowerCase().includes(q) ||
          (n.influencer_handle || "").toLowerCase().includes(q) ||
          (n.edit_reason || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [teamFilteredNotifications, filterStatus, filterActor, filterActionType, dateFrom, dateTo, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filterStatus, filterActor, filterActionType, dateFrom, dateTo, search]);

  const pendingCount = teamFilteredNotifications.filter((n) => n.review_status === "PENDENTE").length;

  const updateStatus = async (id: string, status: "PENDENTE" | "REVISADO" | "SUSPEITO") => {
    setUpdating(true);
    const { error } = await supabase
      .from("admin_notifications" as any)
      .update({
        review_status: status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Status alterado para ${STATUS_CONFIG[status].label}`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, review_status: status, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString() } : n
        )
      );
      if (detailNotif?.id === id) {
        setDetailNotif((prev) => prev ? { ...prev, review_status: status } : null);
      }
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="container py-8 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notificações
              {pendingCount > 0 && (
                <Badge className="bg-amber-500 text-white text-xs ml-2">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Edições com motivo obrigatório para revisão — {teamFilteredNotifications.length} notificações
            </p>
          </div>

          {/* ADMIN: Team tabs */}
          {isAdmin && teams.length > 1 && (
            <Tabs value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <TabsList>
                {teams.map(t => (
                  <TabsTrigger key={t.id} value={t.id}>{t.name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      <div className="container py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, handle, motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos status</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="REVISADO">Revisado</SelectItem>
              <SelectItem value="SUSPEITO">Suspeito</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActor} onValueChange={setFilterActor}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos closers</SelectItem>
              {actors.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterActionType} onValueChange={setFilterActionType}>
            <SelectTrigger className="w-[170px] h-9 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm w-[140px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm w-[140px]" />
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {pageData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma notificação encontrada.</p>
            </div>
          ) : (
            pageData.map((n) => {
              const statusCfg = STATUS_CONFIG[n.review_status];
              const StatusIcon = statusCfg.icon;
              const changedFields = n.field_changes ? Object.keys(n.field_changes) : [];
              const hasComprovante = changedFields.includes("comprovante_url");

              return (
                <div
                  key={n.id}
                  className="bg-card rounded-xl border border-border/40 p-4 hover:border-border/80 transition-colors cursor-pointer"
                  onClick={() => setDetailNotif(n)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{n.actor_nome || "Desconhecido"}</span>
                        {n.actor_email && (
                          <span className="text-xs text-muted-foreground">{n.actor_email}</span>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {ENTITY_LABELS[n.entity_type] || n.entity_type}
                        </Badge>
                        {n.influencer_handle && (
                          <Badge variant="outline" className="text-[10px] bg-primary/5">
                            @{n.influencer_handle}
                          </Badge>
                        )}
                        {hasComprovante && (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <FileImage className="h-3 w-3" />
                            Comprovante
                          </Badge>
                        )}
                        {changedFields.filter((f) => f !== "comprovante_url").map((f) => (
                          <span key={f} className="text-[10px] text-muted-foreground">{FIELD_LABELS[f] || f}</span>
                        ))}
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">
                        <span className="font-medium text-xs text-muted-foreground mr-1">Motivo:</span>
                        {n.edit_reason}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className={`gap-1 text-[10px] ${statusCfg.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailNotif(n); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} notificações — Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailNotif && (
        <NotificationDetailDialog
          notif={detailNotif}
          open={!!detailNotif}
          onClose={() => setDetailNotif(null)}
          onUpdateStatus={updateStatus}
          updating={updating}
        />
      )}
    </div>
  );
}

// --- Detail Dialog ---

function NotificationDetailDialog({
  notif,
  open,
  onClose,
  onUpdateStatus,
  updating,
}: {
  notif: AdminNotification;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: "PENDENTE" | "REVISADO" | "SUSPEITO") => void;
  updating: boolean;
}) {
  const statusCfg = STATUS_CONFIG[notif.review_status];
  const StatusIcon = statusCfg.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Detalhe da Notificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Closer</span>
              <span className="font-medium">{notif.actor_nome || "Desconhecido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Email</span>
              <span className="font-medium">{notif.actor_email || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Data/Hora</span>
              <span className="font-medium">{formatDateTime(notif.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Influenciador</span>
              <span className="font-medium">{notif.influencer_handle ? `@${notif.influencer_handle}` : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Entidade</span>
              <span className="font-medium">{ENTITY_LABELS[notif.entity_type] || notif.entity_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Status</span>
              <Badge variant="outline" className={`gap-1 text-[10px] ${statusCfg.className}`}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
            </div>
          </div>

          {/* Motivo */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Motivo da edição</p>
            <p className="text-sm text-amber-900">{notif.edit_reason}</p>
          </div>

          {/* Field changes */}
          {notif.field_changes && Object.keys(notif.field_changes).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Campos alterados:</p>
              {Object.entries(notif.field_changes).map(([key, change]) => {
                const c = change as { before: any; after: any };
                return (
                  <div key={key} className="rounded-lg border border-border/40 p-3 bg-muted/20">
                    <p className="text-xs font-semibold mb-1.5">{FIELD_LABELS[key] || key}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Antes</span>
                        <span className="bg-red-50 text-red-800 px-2 py-1 rounded inline-block break-all">
                          {formatValue(c.before)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Depois</span>
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded inline-block break-all">
                          {formatValue(c.after)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2 text-xs">
            {notif.entity_id && (
              <span className="text-muted-foreground">
                ID do registro: <span className="font-mono">{notif.entity_id.slice(0, 8)}...</span>
              </span>
            )}
            {notif.audit_log_id && (
              <span className="text-muted-foreground">
                • Audit: <span className="font-mono">{notif.audit_log_id.slice(0, 8)}...</span>
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {(["PENDENTE", "REVISADO", "SUSPEITO"] as const).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const isActive = notif.review_status === s;
              return (
                <Button
                  key={s}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={isActive ? "" : "text-xs"}
                  disabled={isActive || updating}
                  onClick={() => onUpdateStatus(notif.id, s)}
                >
                  <Icon className="h-3.5 w-3.5 mr-1" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
