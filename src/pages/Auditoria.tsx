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
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/helpers";
import {
  type AuditLog,
  ENTITY_LABELS,
  ACTION_CONFIG,
  FIELD_LABELS,
  PAGE_SIZE,
  humanDescription,
  formatValue,
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
} from "lucide-react";

const ACTION_ICONS: Record<string, any> = { INSERT: Plus, UPDATE: Pencil, DELETE: Trash2 };

export default function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [filterEntity, setFilterEntity] = useState<string>("ALL");
  const [filterActor, setFilterActor] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      setLogs((data as any as AuditLog[]) || []);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.actor_user_id && l.actor_nome) map.set(l.actor_user_id, l.actor_nome);
    });
    return Array.from(map.entries());
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (filterAction !== "ALL") result = result.filter((l) => l.action === filterAction);
    if (filterEntity !== "ALL") result = result.filter((l) => l.entity_type === filterEntity);
    if (filterActor !== "ALL") result = result.filter((l) => l.actor_user_id === filterActor);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.actor_nome || "").toLowerCase().includes(q) ||
          humanDescription(l).toLowerCase().includes(q) ||
          (l.entity_id || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterAction, filterEntity, filterActor, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filterAction, filterEntity, filterActor, search]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Auditoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro imutável de todas as ações críticas — {logs.length} eventos
          </p>
        </div>
      </div>

      <div className="container py-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, ação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas ações</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Edição</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas entidades</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterActor} onValueChange={setFilterActor}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos usuários</SelectItem>
              {actors.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Data/Hora</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Ação</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">O que aconteceu</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Usuário</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-16"></th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      Nenhum evento encontrado.
                    </td>
                  </tr>
                ) : (
                  pageData.map((log, idx) => {
                    const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
                    const ActionIcon = ACTION_ICONS[log.action] || Pencil;
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
                          <Badge variant="outline" className={`text-[10px] gap-1 ${actionCfg.className}`}>
                            <ActionIcon className="h-3 w-3" />
                            {actionCfg.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs max-w-[320px] truncate">
                          {humanDescription(log)}
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          {log.actor_user_id ? (
                            <Link
                              to={`/auditoria/user/${log.actor_user_id}`}
                              className="text-primary hover:underline font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {log.actor_nome || "Sistema"}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{log.actor_nome || "Sistema"}</span>
                          )}
                        </td>
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
      </div>

      {detailLog && (
        <AuditDetailDialog log={detailLog} open={!!detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  );
}

function AuditDetailDialog({ log, open, onClose }: { log: AuditLog; open: boolean; onClose: () => void }) {
  const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
  const ActionIcon = ACTION_ICONS[log.action] || Pencil;

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
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{formatValue(val)}</span>
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
              <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded line-through">{formatValue(val)}</span>
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
          return (
            <div key={key} className="rounded-lg border border-border/40 p-3 bg-muted/20">
              <p className="text-xs font-semibold mb-1.5">{FIELD_LABELS[key] || key}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Antes</span>
                  <span className="bg-red-50 text-red-800 px-2 py-1 rounded inline-block break-all">{formatValue(c.before)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Depois</span>
                  <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded inline-block break-all">{formatValue(c.after)}</span>
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
            <Badge variant="outline" className={`gap-1 ${actionCfg.className}`}>
              <ActionIcon className="h-3 w-3" />
              {actionCfg.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Human description highlight */}
          <p className="text-sm font-medium">{humanDescription(log)}</p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Data/Hora</span>
              <span className="font-medium">{formatDateTime(log.created_at)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Usuário</span>
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
