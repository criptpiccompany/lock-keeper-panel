import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  Check,
  StickyNote,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface Conflict {
  id: string;
  month_key: string;
  type: string;
  severity: string;
  handle: string | null;
  affiliate_email: string | null;
  users_involved: { id: string; nome: string }[];
  meta: any;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  note: string | null;
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

const TYPE_LABELS: Record<string, string> = {
  HANDLE_DUPLICATE_ACROSS_USERS: "Handle duplicado entre closers",
  EMAIL_DUPLICATE_ACROSS_USERS: "Email duplicado entre closers",
  MULTIPLE_EMAILS_SAME_HANDLE_SAME_USER: "Múltiplos emails mesmo influ",
  SIMILAR_HANDLE_POSSIBLE_DUPLICATE: "Handles semelhantes",
};

const SEVERITY_CONFIG: Record<string, { label: string; icon: typeof AlertCircle; className: string }> = {
  critical: { label: "Crítico", icon: AlertCircle, className: "bg-red-50 text-red-700 border-red-200" },
  warning: { label: "Atenção", icon: AlertTriangle, className: "bg-amber-50 text-amber-700 border-amber-200" },
  info: { label: "Sugestão", icon: Info, className: "bg-blue-50 text-blue-700 border-blue-200" },
};

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ConflictRadar() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterType, setFilterType] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);

  // Detail modal
  const [detailConflict, setDetailConflict] = useState<Conflict | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [resolving, setResolving] = useState(false);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_conflicts")
      .select("*")
      .eq("month_key", selectedMonth)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar conflitos");
      console.error(error);
    }
    setConflicts((data || []) as unknown as Conflict[]);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-conflicts", {
        body: { monthKey: selectedMonth },
      });
      if (error) throw error;
      toast.success(`Escaneamento concluído: ${data?.conflicts || 0} conflito(s) encontrado(s)`);
      await fetchConflicts();
    } catch (err: any) {
      toast.error("Erro ao escanear", { description: err.message });
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async () => {
    if (!detailConflict || !user) return;
    setResolving(true);
    const { error } = await supabase
      .from("admin_conflicts")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      } as any)
      .eq("id", detailConflict.id);
    if (error) {
      toast.error("Erro ao resolver");
    } else {
      toast.success("Conflito marcado como resolvido");
      setDetailConflict(null);
      fetchConflicts();
    }
    setResolving(false);
  };

  const handleSaveNote = async () => {
    if (!detailConflict) return;
    setSavingNote(true);
    const { error } = await supabase
      .from("admin_conflicts")
      .update({ note: noteInput } as any)
      .eq("id", detailConflict.id);
    if (error) {
      toast.error("Erro ao salvar nota");
    } else {
      toast.success("Nota salva");
      setDetailConflict({ ...detailConflict, note: noteInput });
      fetchConflicts();
    }
    setSavingNote(false);
  };

  const filtered = useMemo(() => {
    return conflicts.filter((c) => {
      if (!showResolved && c.resolved_at) return false;
      if (filterType !== "all" && c.type !== filterType) return false;
      return true;
    });
  }, [conflicts, filterType, showResolved]);

  const counts = useMemo(() => {
    const unresolved = conflicts.filter((c) => !c.resolved_at);
    return {
      critical: unresolved.filter((c) => c.severity === "critical").length,
      warning: unresolved.filter((c) => c.severity === "warning").length,
      info: unresolved.filter((c) => c.severity === "info").length,
    };
  }, [conflicts]);

  return (
    <div className="space-y-6">
      {/* Header + Scan */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[240px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded"
          />
          Mostrar resolvidos
        </label>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Escanear mês
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{counts.critical}</p>
          <p className="text-xs text-red-600 font-medium uppercase tracking-wider">Críticos</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{counts.warning}</p>
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Atenção</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{counts.info}</p>
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Sugestões</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {conflicts.length === 0
              ? 'Nenhum conflito encontrado. Clique "Escanear mês" para analisar.'
              : "Nenhum conflito corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const sev = SEVERITY_CONFIG[c.severity] || SEVERITY_CONFIG.info;
            const Icon = sev.icon;
            return (
              <div
                key={c.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                  c.resolved_at ? "opacity-50" : ""
                } ${sev.className}`}
                onClick={() => {
                  setDetailConflict(c);
                  setNoteInput(c.note || "");
                }}
              >
                <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    {c.resolved_at && (
                      <Badge variant="outline" className="text-[10px] bg-background">
                        <Check className="h-3 w-3 mr-0.5" /> Resolvido
                      </Badge>
                    )}
                    {c.note && <StickyNote className="h-3.5 w-3.5 opacity-60" />}
                  </div>
                  <p className="text-xs mt-0.5 opacity-80">
                    {c.handle && <span className="font-medium">{c.handle}</span>}
                    {c.affiliate_email && (
                      <span className="font-medium"> • {c.affiliate_email}</span>
                    )}
                    {c.users_involved && c.users_involved.length > 0 && (
                      <span>
                        {" "}— {(c.users_involved as any[]).map((u: any) => u.nome).join(", ")}
                      </span>
                    )}
                  </p>
                </div>
                <Eye className="h-4 w-4 opacity-40 mt-1 shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / Compare Modal */}
      <Dialog open={!!detailConflict} onOpenChange={(open) => !open && setDetailConflict(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {detailConflict && (() => {
            const sev = SEVERITY_CONFIG[detailConflict.severity] || SEVERITY_CONFIG.info;
            const Icon = sev.icon;
            const meta = detailConflict.meta || {};
            const entries = meta.entries || [];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {TYPE_LABELS[detailConflict.type] || detailConflict.type}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Info */}
                  <div className="space-y-1 text-sm">
                    {detailConflict.handle && (
                      <p><span className="text-muted-foreground">Handle:</span> <strong>{detailConflict.handle}</strong></p>
                    )}
                    {detailConflict.affiliate_email && (
                      <p><span className="text-muted-foreground">Email:</span> <strong>{detailConflict.affiliate_email}</strong></p>
                    )}
                    {meta.similarity && (
                      <p><span className="text-muted-foreground">Similaridade:</span> <strong>{Math.round(meta.similarity * 100)}%</strong></p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Usuários:</span>{" "}
                      {(detailConflict.users_involved as any[]).map((u: any) => u.nome).join(", ")}
                    </p>
                  </div>

                  {/* Comparison table */}
                  {entries.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/60">
                            <th className="text-left p-2 font-semibold">Closer</th>
                            <th className="text-left p-2 font-semibold">Handle</th>
                            <th className="text-left p-2 font-semibold">Email(s)</th>
                            <th className="text-right p-2 font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((e: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2 font-medium">{e.closer_nome}</td>
                              <td className="p-2">{e.handle}</td>
                              <td className="p-2">
                                <div className="space-y-0.5">
                                  {e.casa_1_email && <div>{e.casa_1_email} <span className="text-muted-foreground">({formatBRL(e.casa_1_valor)})</span></div>}
                                  {e.casa_2_email && <div>{e.casa_2_email} <span className="text-muted-foreground">({formatBRL(e.casa_2_valor)})</span></div>}
                                  {e.casa_3_email && <div>{e.casa_3_email} <span className="text-muted-foreground">({formatBRL(e.casa_3_valor)})</span></div>}
                                  {!e.casa_1_email && !e.casa_2_email && !e.casa_3_email && e.email && (
                                    <div>{e.email}</div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-right font-medium">{formatBRL(e.valor_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Multi-email info */}
                  {detailConflict.type === "MULTIPLE_EMAILS_SAME_HANDLE_SAME_USER" && meta.emails && (
                    <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                      <p className="font-medium text-xs uppercase text-muted-foreground">Emails encontrados</p>
                      {(meta.emails as string[]).map((e: string) => (
                        <p key={e}>• {e}</p>
                      ))}
                    </div>
                  )}

                  {/* Note */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nota</Label>
                    <Textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Adicionar observação sobre este conflito..."
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNote}
                      disabled={savingNote}
                    >
                      {savingNote ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <StickyNote className="mr-1 h-3 w-3" />}
                      Salvar nota
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailConflict(null)}>
                    Fechar
                  </Button>
                  {!detailConflict.resolved_at && (
                    <Button onClick={handleResolve} disabled={resolving}>
                      {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Marcar como resolvido
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
