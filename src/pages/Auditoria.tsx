import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, brandTabsListClass, brandTabsTriggerClass } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/helpers";
import {
  type AuditLog,
  ENTITY_LABELS,
  ACTION_CONFIG,
  FIELD_LABELS,
  PAGE_SIZE,
  humanDescription,
  extractHandle,
  isAttachmentAction,
  isSensitiveAction,
  isFinancialField,
  financialDirection,
  formatValue,
  formatCurrency,
  getDisplayFields,
  getDisplayData,
} from "@/lib/auditHelpers";
import {
  ShieldAlert,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Paperclip,
  TrendingUp,
  TrendingDown,
  Users,
  User,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
}

// --- Shared small components ---

function ActionIcon({ log }: { log: AuditLog }) {
  if (isAttachmentAction(log)) return <Paperclip className="h-3.5 w-3.5" />;
  if (log.action === "INSERT") return <Plus className="h-3.5 w-3.5" />;
  if (log.action === "DELETE") return <Trash2 className="h-3.5 w-3.5" />;
  return <Pencil className="h-3.5 w-3.5" />;
}

function actionLabel(log: AuditLog): string {
  if (isAttachmentAction(log)) return "Anexo";
  return ACTION_CONFIG[log.action]?.label || "Edição";
}

function actionClassName(log: AuditLog): string {
  if (isAttachmentAction(log)) return "bg-blue-50 text-blue-700 border-blue-200";
  return ACTION_CONFIG[log.action]?.className || ACTION_CONFIG.UPDATE.className;
}

function DescriptionCell({ log }: { log: AuditLog }) {
  const desc = humanDescription(log);
  const handle = extractHandle(log);
  if (!handle) return <span>{desc}</span>;
  const parts = desc.split(handle);
  return (
    <span>
      {parts[0]}
      <span className="font-semibold text-foreground">{handle}</span>
      {parts.slice(1).join(handle)}
    </span>
  );
}

// --- Main page ---

export default function Auditoria() {
  const { isAdmin } = useAuth();
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [logsRes, teamsRes] = await Promise.all([
        supabase
          .from("audit_logs" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
        isAdmin ? supabase.from("teams").select("id, name") : Promise.resolve({ data: [] }),
      ]);
      setAllLogs((logsRes.data as any as AuditLog[]) || []);
      const fetchedTeams = (teamsRes.data as Team[]) || [];
      setTeams(fetchedTeams);
      if (fetchedTeams.length > 0) setSelectedTeamId(fetchedTeams[0].id);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter logs by selected team (ADMIN only)
  const teamFilteredLogs = useMemo(() => {
    if (!isAdmin || !selectedTeamId) return allLogs;
    return allLogs.filter((l) => (l as any).team_id === selectedTeamId);
  }, [allLogs, isAdmin, selectedTeamId]);

  // Build user tabs sorted by most recent action
  const userTabs = useMemo(() => {
    const map = new Map<string, { nome: string; lastAction: string }>();
    teamFilteredLogs.forEach((l) => {
      if (l.actor_user_id && l.actor_nome) {
        const existing = map.get(l.actor_user_id);
        if (!existing || l.created_at > existing.lastAction) {
          map.set(l.actor_user_id, { nome: l.actor_nome, lastAction: l.created_at });
        }
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].lastAction.localeCompare(a[1].lastAction))
      .map(([id, { nome, lastAction }]) => [id, nome, lastAction] as [string, string, string]);
  }, [teamFilteredLogs]);

  // Track "last viewed" timestamps per user tab in localStorage
  const STORAGE_KEY = "audit_tab_last_viewed";
  const getLastViewed = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch { return {}; }
  };
  const [lastViewed, setLastViewed] = useState<Record<string, string>>(getLastViewed);

  const markTabViewed = (userId: string) => {
    const now = new Date().toISOString();
    const updated = { ...lastViewed, [userId]: now };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setLastViewed(updated);
  };

  // Returns "sensitive" | "common" | null based on unseen actions
  const unseenLevel = (userId: string): "sensitive" | "common" | null => {
    const viewed = lastViewed[userId];
    const userLogs = teamFilteredLogs.filter((l) => l.actor_user_id === userId);
    const unseen = viewed ? userLogs.filter((l) => l.created_at > viewed) : userLogs;
    if (unseen.length === 0) return null;
    if (unseen.some(isSensitiveAction)) return "sensitive";
    return "common";
  };

  const handleTabClick = (userId: string) => {
    setActiveTab(userId);
    if (userId !== "ALL") markTabViewed(userId);
  };

  // Reset user tab when team changes
  useEffect(() => { setActiveTab("ALL"); }, [selectedTeamId]);

  // Filter logs for current tab
  const tabLogs = useMemo(() => {
    if (activeTab === "ALL") return teamFilteredLogs;
    return teamFilteredLogs.filter((l) => l.actor_user_id === activeTab);
  }, [teamFilteredLogs, activeTab]);

  const activeUserName = activeTab === "ALL"
    ? null
    : userTabs.find(([id]) => id === activeTab)?.[1] || "Usuário";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4F0]">
      <PageHeader
        eyebrow="Auditoria"
        icon={ShieldAlert}
        title="Trilha de auditoria"
        subtitle={`Histórico imutável de ações da equipe — ${teamFilteredLogs.length} eventos registrados no escopo atual.`}
      >
        {isAdmin && teams.length > 1 && (
          <Tabs value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <TabsList className={brandTabsListClass}>
              {teams.map(t => (
                <TabsTrigger key={t.id} value={t.id} className={brandTabsTriggerClass}>{t.name}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </PageHeader>

      {/* Sub-tabs */}
      <div className="border-b bg-card">
        <div className="container">
          <nav className="flex gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleTabClick("ALL")}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                ${activeTab === "ALL"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
                }
              `}
            >
              <Users className="h-4 w-4" />
              Geral
              {activeTab === "ALL" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
            {userTabs.map(([userId, nome]) => {
              const isActive = activeTab === userId;
              const level = unseenLevel(userId);
              const dotColor = level === "sensitive"
                ? { ping: "bg-red-400", dot: "bg-red-500" }
                : level === "common"
                  ? { ping: "bg-orange-400", dot: "bg-orange-500" }
                  : null;
              return (
                <button
                  key={userId}
                  onClick={() => handleTabClick(userId)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                    ${isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                    }
                  `}
                >
                  <User className="h-4 w-4" />
                  {nome}
                  {dotColor && !isActive && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor.ping} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor.dot}`} />
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <AuditTable
        logs={tabLogs}
        showUserColumn={activeTab === "ALL"}
        subtitle={
          activeTab === "ALL"
            ? `${tabLogs.length} eventos — todos os colaboradores`
            : `${tabLogs.length} eventos — ${activeUserName}`
        }
      />
    </div>
  );
}

// --- Filterable table (shared between Geral and per-user) ---

function AuditTable({
  logs,
  showUserColumn,
  subtitle,
}: {
  logs: AuditLog[];
  showUserColumn: boolean;
  subtitle: string;
}) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [filterEntity, setFilterEntity] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const filtered = useMemo(() => {
    let result = logs;
    if (filterAction !== "ALL") result = result.filter((l) => l.action === filterAction);
    if (filterEntity !== "ALL") result = result.filter((l) => l.entity_type === filterEntity);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.actor_nome || "").toLowerCase().includes(q) ||
          humanDescription(l).toLowerCase().includes(q) ||
          (extractHandle(l) || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterAction, filterEntity, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterAction, filterEntity, search, logs]);

  const colSpan = showUserColumn ? 5 : 4;

  return (
    <div className="container py-6 space-y-4">
      <p className="text-xs text-muted-foreground">{subtitle}</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, influenciador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="INSERT">➕ Criação</SelectItem>
            <SelectItem value="UPDATE">✏️ Edição</SelectItem>
            <SelectItem value="DELETE">🗑️ Remoção</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as áreas</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Quando</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs w-[100px]">Tipo</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">O que aconteceu</th>
                {showUserColumn && (
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Quem fez</th>
                )}
                <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-12"></th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : (
                pageData.map((log, idx) => {
                  const zebraClass = idx % 2 === 1 ? "bg-muted/30" : "";
                  return (
                    <tr
                      key={log.id}
                      className={`border-b border-border/20 hover:bg-muted/40 transition-colors cursor-pointer ${zebraClass}`}
                      onClick={() => setDetailLog(log)}
                    >
                      <td className="py-2.5 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${actionClassName(log)}`}>
                          <ActionIcon log={log} />
                          {actionLabel(log)}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-xs max-w-[360px] truncate">
                        <DescriptionCell log={log} />
                      </td>
                      {showUserColumn && (
                        <td className="py-2.5 px-4 text-xs">
                          <span className="text-muted-foreground">{log.actor_nome || "Sistema"}</span>
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setDetailLog(log); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              {filtered.length} eventos — Página {page + 1} de {totalPages}
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

      {detailLog && (
        <AuditDetailDialog log={detailLog} open={!!detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  );
}

// --- Detail Dialog ---

function AuditDetailDialog({ log, open, onClose }: { log: AuditLog; open: boolean; onClose: () => void }) {
  const renderChanges = () => {
    if (!log.field_changes) return <p className="text-muted-foreground text-sm">Sem dados de alteração.</p>;

    if (log.action === "INSERT" && log.field_changes.after) {
      const after = getDisplayData(log.field_changes.after as Record<string, any>);
      return (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Valores criados:</p>
          {Object.entries(after).map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="font-medium min-w-[120px] text-foreground">{FIELD_LABELS[key] || key}</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {isFinancialField(key) ? formatCurrency(val) : formatValue(val)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (log.action === "DELETE" && log.field_changes.before) {
      const before = getDisplayData(log.field_changes.before as Record<string, any>);
      return (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Valores removidos:</p>
          {Object.entries(before).map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="font-medium min-w-[120px] text-foreground">{FIELD_LABELS[key] || key}</span>
              <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded line-through">
                {isFinancialField(key) ? formatCurrency(val) : formatValue(val)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    const displayFields = getDisplayFields(log.field_changes);
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Alterações:</p>
        {Object.entries(displayFields).map(([key, change]) => {
          const c = change as { before: any; after: any };
          const dir = financialDirection(key, c);
          const isFin = isFinancialField(key);
          return (
            <div key={key} className="rounded-lg border border-border/40 p-3 bg-muted/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <p className="text-xs font-semibold">{FIELD_LABELS[key] || key}</p>
                {dir === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                {dir === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Antes</span>
                  <span className={`px-2 py-1 rounded inline-block break-all ${
                    dir === "down" ? "bg-red-100 text-red-800 font-semibold" : "bg-red-50 text-red-800"
                  }`}>
                    {isFin ? formatCurrency(c.before) : formatValue(c.before)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Depois</span>
                  <span className={`px-2 py-1 rounded inline-block break-all ${
                    dir === "up" ? "bg-emerald-100 text-emerald-800 font-semibold" : "bg-emerald-50 text-emerald-800"
                  }`}>
                    {isFin ? formatCurrency(c.after) : formatValue(c.after)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className={`gap-1 ${actionClassName(log)}`}>
              <ActionIcon log={log} />
              {actionLabel(log)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm font-medium">
            <DescriptionCell log={log} />
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Quando</span>
              <span className="font-medium">{formatDateTime(log.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Quem fez</span>
              <span className="font-medium">{log.actor_nome || "Sistema"}</span>
              {log.actor_role && <Badge variant="outline" className="ml-1.5 text-[10px]">{log.actor_role}</Badge>}
            </div>
          </div>

          {log.edit_reason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Motivo da edição</p>
              <p className="text-sm text-amber-900">{log.edit_reason}</p>
            </div>
          )}

          <hr className="border-border/30" />
          {renderChanges()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
