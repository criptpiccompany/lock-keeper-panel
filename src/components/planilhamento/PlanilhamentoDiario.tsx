import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  FileText,
  Upload,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  ChevronsUpDown,
  Pencil,
  X,
  AlertCircle,
} from "lucide-react";
import ComprovanteThumbnail from "./ComprovanteThumbnail";
import ComprovanteLightbox from "./ComprovanteLightbox";
import EditReasonModal, { formatFieldLabel, type FieldDiff } from "./EditReasonModal";
import SharedPartnersPopover, { type SharedPartner } from "./SharedPartnersPopover";

// --- Types ---

interface DailyRecord {
  id: string;
  date: string;
  influencer_id: string;
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
  comprovante_url: string;
  observacao: string | null;
  status: string | null;
  acumulado: number | null;
  is_shared: boolean;
  shared_note: string | null;
  created_at: string;
  updated_at: string;
}

interface CloserOption {
  id: string;
  nome: string;
}

interface InfluencerOption {
  id: string;
  handle: string;
  last_closed_at: string | null;
}

// --- Calculation helpers ---

type StatusResultado = "VERDE" | "AMARELO" | "VERMELHO" | null;

function calcTaxaPlataforma(faturamento: number | null): number {
  if (!faturamento) return 0;
  return faturamento * 0.10;
}

function calcLucroLiquido(faturamento: number | null, valorPago: number): number {
  if (!faturamento) return 0;
  return faturamento - valorPago - calcTaxaPlataforma(faturamento);
}

function calcMargem(faturamento: number | null, valorPago: number): number | null {
  if (!faturamento || valorPago === 0) return null;
  return calcLucroLiquido(faturamento, valorPago) / valorPago;
}

function getStatusResultado(faturamento: number | null, valorPago: number): StatusResultado {
  if (!faturamento) return null;
  const lucro = calcLucroLiquido(faturamento, valorPago);
  const margem = calcMargem(faturamento, valorPago);
  if (lucro <= 0) return "VERMELHO";
  if (margem !== null && margem >= 0.30) return "VERDE";
  return "AMARELO";
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(val: number | null): string {
  if (val === null) return "—";
  return (val * 100).toFixed(1) + "%";
}

// --- Status chip components ---

function ResultadoChip({ status }: { status: StatusResultado }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const config = {
    VERDE: { label: "Lucro", className: "bg-emerald-50 text-emerald-700 border-emerald-200/50" },
    AMARELO: { label: "Margem baixa", className: "bg-amber-50 text-amber-700 border-amber-200/50" },
    VERMELHO: { label: "Prejuízo", className: "bg-red-50 text-red-700 border-red-200/50" },
  };
  const c = config[status];
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

// Color for resultado cell text
function resultadoColor(status: StatusResultado): string {
  if (!status) return "";
  if (status === "VERDE") return "text-emerald-700";
  if (status === "AMARELO") return "text-amber-600";
  return "text-red-600";
}

const WORKFLOW_STATUSES = ["Gravando", "Postou", "Apagou"] as const;

function WorkflowStatusDropdown({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger className="h-7 text-xs w-[110px] border-border/50">
        <SelectValue placeholder="Status..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        <SelectItem value="__none__" className="text-xs text-muted-foreground">— Sem status</SelectItem>
        {WORKFLOW_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// --- Inline editable acumulado ---

function InlineAcumulado({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (val: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value !== null ? String(value) : "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const num = draft ? Number(draft) : null;
    if (num !== value) onSave(num);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        className="h-7 w-[100px] rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 group text-sm"
      title="Editar acumulado"
    >
      <span className={value !== null && value < 0 ? "text-red-600 font-medium" : value !== null && value > 0 ? "text-emerald-700 font-medium" : ""}>
        {value !== null ? formatCurrency(value) : "—"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ComprovanteLightbox extracted to ./ComprovanteLightbox.tsx
// --- Month helpers ---

function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push(date);
  }
  return days;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" });
  const day = d.getDate();
  return `${weekday}, ${day}`;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// --- Main Component ---

export default function PlanilhamentoDiario({ closerId }: { closerId?: string }) {
  const { user, isAdmin } = useAuth();
  const viewingOther = !!closerId && closerId !== user?.id;
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Edit reason modal state
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingDiffs, setPendingDiffs] = useState<FieldDiff[]>([]);
  const [pendingInlineAction, setPendingInlineAction] = useState<(() => Promise<void>) | null>(null);
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DailyRecord | null>(null);
  const [modalDate, setModalDate] = useState("");
  const [formInfluencerId, setFormInfluencerId] = useState("");
  const [formValorPago, setFormValorPago] = useState("");
  const [formFaturamento, setFormFaturamento] = useState("");
  const [formObservacao, setFormObservacao] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  // Comprovante lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");

  // Shared/partners state
  const [formIsShared, setFormIsShared] = useState(false);
  const [formSharedNote, setFormSharedNote] = useState("");
  const [formSelectedPartners, setFormSelectedPartners] = useState<string[]>([]);
  const [formShareType, setFormShareType] = useState<string>("percent");
  const [formPartnerAmounts, setFormPartnerAmounts] = useState<Record<string, string>>({});
  const [allClosers, setAllClosers] = useState<CloserOption[]>([]);
  const [sharedPartnersMap, setSharedPartnersMap] = useState<Map<string, SharedPartner[]>>(new Map());

  // Persistent days from DB
  const [persistedDays, setPersistedDays] = useState<string[]>([]);

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const monthDays = useMemo(() => getMonthDays(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;

    const targetId = closerId || (!isAdmin ? user.id : undefined);

    let recordsQuery = supabase
      .from("daily_influencer_records")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (targetId) {
      recordsQuery = recordsQuery.eq("closer_id", targetId);
    }

    let sheetsQuery = supabase
      .from("daily_sheets")
      .select("date")
      .eq("month", monthKey);

    if (targetId) {
      sheetsQuery = sheetsQuery.eq("closer_id", targetId);
    }

    let infQuery = supabase.from("influencers").select("id, handle, last_closed_at").eq("ativo", true);
    if (targetId) {
      infQuery = infQuery.eq("owner_id", targetId);
    }

    const [recordsRes, infRes, sheetsRes, closersRes] = await Promise.all([
      recordsQuery,
      infQuery,
      sheetsQuery,
      supabase.from("profiles").select("id, nome").eq("status", "approved").order("nome"),
    ]);

    const fetchedRecords = (recordsRes.data as DailyRecord[]) || [];
    setRecords(fetchedRecords);
    setInfluencers(infRes.data || []);
    setPersistedDays((sheetsRes.data || []).map((s: any) => s.date));
    setAllClosers((closersRes.data || []) as CloserOption[]);

    // Fetch shared partners for all records that are shared
    const sharedRecordIds = fetchedRecords.filter((r) => r.is_shared).map((r) => r.id);
    if (sharedRecordIds.length > 0) {
      const { data: partnersData } = await supabase
        .from("daily_record_shared_partners")
        .select("*")
        .in("record_id", sharedRecordIds);
      const map = new Map<string, SharedPartner[]>();
      for (const p of (partnersData || []) as any[]) {
        const list = map.get(p.record_id) || [];
        list.push({ id: p.id, partner_user_id: p.partner_user_id, partner_nome: p.partner_nome, share_type: p.share_type, share_amount: p.share_amount ? Number(p.share_amount) : null });
        map.set(p.record_id, list);
      }
      setSharedPartnersMap(map);
    } else {
      setSharedPartnersMap(new Map());
    }

    setLoading(false);

    const today = new Date().toISOString().split("T")[0];
    if (today >= startDate && today <= endDate) {
      setExpandedDays(new Set([today]));
    }
  }, [user, isAdmin, closerId, selectedYear, selectedMonth, monthKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, DailyRecord[]>();
    for (const r of records) {
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  }, [records]);

  const activeDays = useMemo(() => {
    const days = new Set<string>();
    for (const d of recordsByDate.keys()) days.add(d);
    for (const d of persistedDays) days.add(d);
    const today = new Date().toISOString().split("T")[0];
    if (monthDays.includes(today)) days.add(today);
    return monthDays.filter((d) => days.has(d));
  }, [recordsByDate, persistedDays, monthDays]);

  const getInfluencerHandle = (id: string) => {
    return influencers.find((i) => i.id === id)?.handle || id;
  };

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // --- Add day (blue +) ---
  const handleAddDay = async () => {
    if (!user) return;
    const allDays = [...activeDays].sort();
    const lastDay = allDays[allDays.length - 1];
    let targetDate: string;

    if (lastDay) {
      const next = new Date(lastDay + "T12:00:00");
      next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().split("T")[0];
      if (!monthDays.includes(nextStr)) {
        toast.info("Fim do mês atingido");
        return;
      }
      targetDate = nextStr;
    } else {
      const today = new Date().toISOString().split("T")[0];
      targetDate = monthDays.includes(today) ? today : monthDays[0];
    }

    if (persistedDays.includes(targetDate)) {
      setExpandedDays((prev) => new Set([...prev, targetDate]));
      return;
    }

    try {
      const { error } = await supabase.from("daily_sheets").insert({
        date: targetDate,
        month: monthKey,
        closer_id: user.id,
      } as any);

      if (error) {
        console.error("Error inserting daily_sheet:", error);
        toast.error("Erro ao adicionar dia", { description: error.message });
        return;
      }

      setPersistedDays((prev) => [...prev, targetDate]);
      setExpandedDays((prev) => new Set([...prev, targetDate]));
      toast.success(`Dia ${new Date(targetDate + "T12:00:00").getDate()} adicionado`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Error adding day:", err);
      toast.error("Erro ao adicionar dia", { description: message });
    }
  };

  // --- Add row ---
  const openNewRecord = (date: string) => {
    setEditRecord(null);
    setModalDate(date);
    setFormInfluencerId("");
    setFormValorPago("");
    setFormFaturamento("");
    setFormObservacao("");
    setFormFile(null);
    setFormIsShared(false);
    setFormSharedNote("");
    setFormSelectedPartners([]);
    setFormShareType("percent");
    setFormPartnerAmounts({});
    setModalOpen(true);
  };

  const openEditRecord = (record: DailyRecord) => {
    setEditRecord(record);
    setModalDate(record.date);
    setFormInfluencerId(record.influencer_id);
    setFormValorPago(String(record.valor_pago));
    setFormFaturamento(record.faturamento !== null ? String(record.faturamento) : "");
    setFormObservacao(record.observacao || "");
    setFormFile(null);
    setFormIsShared(record.is_shared || false);
    setFormSharedNote(record.shared_note || "");
    // Load existing partners
    const existingPartners = sharedPartnersMap.get(record.id) || [];
    setFormSelectedPartners(existingPartners.map((p) => p.partner_user_id));
    setFormShareType(existingPartners[0]?.share_type || "percent");
    const amounts: Record<string, string> = {};
    existingPartners.forEach((p) => {
      if (p.share_amount != null) amounts[p.partner_user_id] = String(p.share_amount);
    });
    setFormPartnerAmounts(amounts);
    setModalOpen(true);
  };

  const getAvailableInfluencers = (date: string) => {
    const dayRecords = recordsByDate.get(date) || [];
    const usedIds = new Set(dayRecords.map((r) => r.influencer_id));
    return influencers.filter((i) => !usedIds.has(i.id));
  };

  // Critical fields that require a reason for editing (only exceptions)
  const CRITICAL_FIELDS = ["valor_pago", "faturamento", "comprovante_url"];

  const detectCriticalDiffs = (): FieldDiff[] => {
    if (!editRecord) return [];
    const diffs: FieldDiff[] = [];
    const newValorPago = Number(formValorPago);
    const newFaturamento = formFaturamento ? Number(formFaturamento) : null;
    const oldValorPago = Number(editRecord.valor_pago);
    const oldFaturamento = editRecord.faturamento != null ? Number(editRecord.faturamento) : null;

    // Require reason only when REDUCING valor_pago (when there was already a value > 0)
    if (oldValorPago > 0 && newValorPago < oldValorPago) {
      diffs.push({ field: "valor_pago", label: formatFieldLabel("valor_pago"), before: String(oldValorPago), after: String(newValorPago) });
    }
    // Require reason only when REDUCING faturamento (when there was already a value > 0)
    if (oldFaturamento !== null && oldFaturamento > 0 && (newFaturamento === null || newFaturamento < oldFaturamento)) {
      diffs.push({ field: "faturamento", label: formatFieldLabel("faturamento"), before: String(oldFaturamento), after: String(newFaturamento ?? "") });
    }
    // Require reason when REPLACING existing comprovante (not when adding for the first time)
    if (formFile && editRecord.comprovante_url) {
      diffs.push({ field: "comprovante_url", label: formatFieldLabel("comprovante_url"), before: "(arquivo anterior)", after: formFile.name });
    }
    // Require reason when changing influencer (not applicable from current UI, but future-proof)
    return diffs;
  };




  const handleSubmit = async (editReason?: string) => {
    if (!user) return;

    const available = getAvailableInfluencers(modalDate);
    if (!editRecord && available.length === 0) {
      toast.error("Sem influenciadores disponíveis para este dia");
      return;
    }
    if (!editRecord && !formInfluencerId) {
      toast.error("Selecione um influenciador");
      return;
    }
    if (!formValorPago || Number(formValorPago) <= 0) {
      toast.error("Informe o valor pago");
      return;
    }
    // Comprovante is NOT required - record will be marked as pending

    // If editing and has critical changes, require reason
    if (editRecord && !editReason) {
      const diffs = detectCriticalDiffs();
      if (diffs.length > 0) {
        setPendingDiffs(diffs);
        setReasonModalOpen(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      let comprovanteUrl = editRecord?.comprovante_url || "";

      if (formFile) {
        const ext = formFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes")
          .upload(path, formFile);
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Erro no upload do comprovante", { description: uploadError.message });
          setSubmitting(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        comprovanteUrl = urlData.publicUrl;
      }

      const payload: Record<string, unknown> = {
        valor_pago: Number(formValorPago),
        faturamento: formFaturamento ? Number(formFaturamento) : null,
        observacao: formObservacao || null,
        is_shared: formIsShared,
        shared_note: formIsShared ? (formSharedNote || null) : null,
      };

      let savedRecordId: string | null = null;

      if (editRecord) {
        if (formFile) payload.comprovante_url = comprovanteUrl;

        const { error } = await supabase
          .from("daily_influencer_records")
          .update(payload)
          .eq("id", editRecord.id);
        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        savedRecordId = editRecord.id;

        // Store edit reason via edge function (server-side, bypasses RLS)
        if (editReason) {
          const diffs = detectCriticalDiffs();
          const fieldChangesObj: Record<string, { before: any; after: any }> = {};
          diffs.forEach((d) => { fieldChangesObj[d.field] = { before: d.before, after: d.after }; });
          await supabase.functions.invoke("store-edit-reason", {
            body: {
              entity_id: editRecord.id,
              entity_type: "daily_influencer_records",
              edit_reason: editReason,
              field_changes: fieldChangesObj,
              influencer_handle: getInfluencerHandle(editRecord.influencer_id),
            },
          });
        }

        toast.success("Registro atualizado!");
      } else {
        payload.date = modalDate;
        payload.influencer_id = formInfluencerId;
        payload.closer_id = user.id;
        payload.comprovante_url = comprovanteUrl || null;
        const { data: insertData, error } = await supabase
          .from("daily_influencer_records")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        savedRecordId = insertData?.id || null;
        toast.success("Registro criado!");
      }

      // Save shared partners
      if (savedRecordId) {
        // Delete existing partners first
        if (editRecord) {
          await supabase
            .from("daily_record_shared_partners")
            .delete()
            .eq("record_id", savedRecordId);
        }
        // Insert new partners if shared
        if (formIsShared && formSelectedPartners.length > 0) {
          const closerNameMap = new Map(allClosers.map((c) => [c.id, c.nome]));
          const partnersToInsert = formSelectedPartners.map((partnerId) => ({
            record_id: savedRecordId!,
            partner_user_id: partnerId,
            partner_nome: closerNameMap.get(partnerId) || null,
            share_type: formPartnerAmounts[partnerId] ? formShareType : null,
            share_amount: formPartnerAmounts[partnerId] ? Number(formPartnerAmounts[partnerId]) : null,
          }));
          await supabase.from("daily_record_shared_partners").insert(partnersToInsert);
        }
      }

      setModalOpen(false);
      setReasonModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Submit error:", err);
      toast.error("Erro ao salvar", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReasonConfirm = (reason: string) => {
    if (pendingInlineAction) {
      // Inline edit (status/acumulado)
      (pendingInlineAction as any)(reason);
      setReasonModalOpen(false);
      setPendingInlineAction(null);
      setPendingDiffs([]);
    } else {
      // Form edit
      handleSubmit(reason);
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: string | null) => {
    const record = records.find((r) => r.id === recordId);
    const oldStatus = record?.status || null;
    if (oldStatus === newStatus) return;

    // Save directly without requiring reason (status is not critical)
    const { error } = await supabase
      .from("daily_influencer_records")
      .update({ status: newStatus } as any)
      .eq("id", recordId);
    if (error) {
      toast.error("Erro ao atualizar status", { description: error.message });
      return;
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, status: newStatus } : r))
    );
  };

  const handleAcumuladoSave = async (recordId: string, val: number | null) => {
    const record = records.find((r) => r.id === recordId);
    const oldVal = record?.acumulado;
    if (oldVal === val) return;

    // Save directly without requiring reason (acumulado is not critical)
    const { error } = await supabase
      .from("daily_influencer_records")
      .update({ acumulado: val } as any)
      .eq("id", recordId);
    if (error) {
      toast.error("Erro ao salvar acumulado", { description: error.message });
      return;
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, acumulado: val } : r))
    );
  };

  const handleViewComprovante = async (url: string) => {
    const path = url.split("/comprovantes/")[1];
    if (path) {
      const { data } = await supabase.storage.from("comprovantes").createSignedUrl(path, 300);
      if (data?.signedUrl) {
        setLightboxUrl(data.signedUrl);
        setLightboxOpen(true);
        return;
      }
    }
    setLightboxUrl(url);
    setLightboxOpen(true);
  };



  // --- Month totals ---
  const monthTotals = useMemo(() => {
    const totalInvestido = records.reduce((sum, r) => sum + Number(r.valor_pago), 0);
    const totalFaturado = records.reduce((sum, r) => sum + (Number(r.faturamento) || 0), 0);
    const totalTaxa = calcTaxaPlataforma(totalFaturado);
    const resultadoLiquido = totalFaturado - totalInvestido - totalTaxa;
    const totalPending = records.filter((r) => !r.comprovante_url).length;
    return { totalInvestido, totalFaturado, totalTaxa, resultadoLiquido, totalPending };
  }, [records]);

  // Check if modal has available influencers
  const modalAvailableInfluencers = useMemo(() => {
    if (!modalDate) return [];
    return getAvailableInfluencers(modalDate).sort((a, b) =>
      a.handle.localeCompare(b.handle, 'pt-BR')
    );
  }, [modalDate, influencers, recordsByDate]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold text-foreground min-w-[180px] text-center">
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month totals */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Investido: </span>
            <span className="font-medium">{formatCurrency(monthTotals.totalInvestido)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Faturado: </span>
            <span className="font-medium">{formatCurrency(monthTotals.totalFaturado)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Resultado: </span>
            <span className={`font-semibold ${monthTotals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatCurrency(monthTotals.resultadoLiquido)}
            </span>
          </div>
          {monthTotals.totalPending > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="h-3 w-3" />
              {monthTotals.totalPending} pendência{monthTotals.totalPending > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Day sections */}
      {activeDays.length === 0 ? (
        <div className="empty-state">
          <FileText className="empty-state-icon" />
          <h3 className="empty-state-title">Nenhum registro neste mês</h3>
          <p className="empty-state-description mb-4">Clique no botão abaixo para adicionar um dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDays.map((day) => {
            const dayRecords = recordsByDate.get(day) || [];
            const isExpanded = expandedDays.has(day);
            const dayTotal = dayRecords.reduce((s, r) => s + Number(r.valor_pago), 0);
            const dayFat = dayRecords.reduce((s, r) => s + (Number(r.faturamento) || 0), 0);
            const pendingCount = dayRecords.filter((r) => !r.comprovante_url).length;

            return (
              <div key={day} className="bg-card rounded-xl border overflow-hidden">
                {/* Day header */}
                <button
                  onClick={() => toggleDay(day)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-sm text-foreground capitalize">{formatDayLabel(day)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {dayRecords.length} {dayRecords.length === 1 ? "registro" : "registros"}
                    </Badge>
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {pendingCount} sem comprovante
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Pago: {formatCurrency(dayTotal)}</span>
                    <span>Fat: {formatCurrency(dayFat)}</span>
                  </div>
                </button>

                {/* Expanded table */}
                {isExpanded && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/60">
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Nome</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Valor Pago</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Faturamento</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Resultado</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Acumulado</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Status</th>
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-center">📎</th>
                          {!viewingOther && <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRecords.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                              Nenhum registro. Clique no + para adicionar.
                            </td>
                          </tr>
                        ) : (
                          dayRecords.map((record, idx) => {
                            const lucro = calcLucroLiquido(record.faturamento, record.valor_pago);
                            const resultado = getStatusResultado(record.faturamento, record.valor_pago);
                            const zebraClass = idx % 2 === 1 ? "bg-muted/50" : "bg-background";

                            return (
                              <tr key={record.id} className={`border-t border-border/30 hover:bg-muted/60 transition-colors ${zebraClass}`}>
                                <td className="py-2.5 px-4 text-sm font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {getInfluencerHandle(record.influencer_id)}
                                    {record.is_shared && (
                                      <SharedPartnersPopover
                                        partners={sharedPartnersMap.get(record.id) || []}
                                        sharedNote={record.shared_note}
                                        compact
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-sm">{formatCurrency(record.valor_pago)}</td>
                                <td className="py-2.5 px-4 text-sm">
                                  {record.faturamento !== null ? (
                                    formatCurrency(record.faturamento)
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">pendente</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${resultadoColor(resultado)}`}>
                                      {record.faturamento !== null ? formatCurrency(lucro) : "—"}
                                    </span>
                                    {resultado && <ResultadoChip status={resultado} />}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  {viewingOther ? (
                                    <span className={`text-sm ${record.acumulado !== null && record.acumulado < 0 ? "text-red-600 font-medium" : record.acumulado !== null && record.acumulado > 0 ? "text-emerald-700 font-medium" : ""}`}>
                                      {record.acumulado !== null ? formatCurrency(record.acumulado) : "—"}
                                    </span>
                                  ) : (
                                    <InlineAcumulado
                                      value={record.acumulado ?? null}
                                      onSave={(val) => handleAcumuladoSave(record.id, val)}
                                    />
                                  )}
                                </td>
                                <td className="py-2.5 px-4">
                                  {viewingOther ? (
                                    <span className="text-xs text-muted-foreground">{record.status || "—"}</span>
                                  ) : (
                                    <WorkflowStatusDropdown
                                      value={record.status}
                                      onChange={(val) => handleStatusChange(record.id, val)}
                                    />
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  {record.comprovante_url ? (
                                    <ComprovanteThumbnail
                                      url={record.comprovante_url}
                                      onClick={() => handleViewComprovante(record.comprovante_url)}
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center gap-1">
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                      <span className="text-[10px] text-destructive font-medium leading-tight">Pendente</span>
                                    </div>
                                  )}
                                </td>
                                {!viewingOther && (
                                  <td className="py-2.5 px-4 text-right">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditRecord(record)}>
                                      Editar
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Blue + button: add influencer to this day */}
                    {!viewingOther && (
                      <div className="px-4 py-2 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary bg-primary/10 shadow-[0_1px_4px_0_hsl(var(--primary)/0.2)] rounded-md hover:bg-primary/15 hover:shadow-[0_2px_8px_0_hsl(var(--primary)/0.25)] transition-all"
                          onClick={() => openNewRecord(day)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Adicionar influenciador
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Blue + button: add new day */}
      {!viewingOther && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            onClick={handleAddDay}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar dia
          </Button>
        </div>
      )}

      {/* Mobile month totals */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Investido</p>
          <p className="text-base font-semibold">{formatCurrency(monthTotals.totalInvestido)}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Faturado</p>
          <p className="text-base font-semibold">{formatCurrency(monthTotals.totalFaturado)}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Taxa (10%)</p>
          <p className="text-base font-semibold text-muted-foreground">{formatCurrency(monthTotals.totalTaxa)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${monthTotals.resultadoLiquido >= 0 ? "bg-emerald-50 border-emerald-200/50" : "bg-red-50 border-red-200/50"}`}>
          <p className="text-xs uppercase tracking-wider mb-1 text-muted-foreground">Resultado</p>
          <p className={`text-base font-semibold ${monthTotals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {formatCurrency(monthTotals.resultadoLiquido)}
          </p>
        </div>
      </div>

      {/* New/Edit Record Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
          </DialogHeader>

          {/* Empty state when no influencers available */}
          {!editRecord && modalAvailableInfluencers.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                Sem influenciadores disponíveis para este dia
              </p>
              <p className="text-xs text-muted-foreground">
                Todos os seus influenciadores já possuem registro nesta data.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {!editRecord && (
                <div className="space-y-2">
                  <Label>Influenciador</Label>
                  <Popover open={comboOpen} onOpenChange={setComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formInfluencerId
                          ? influencers.find((i) => i.id === formInfluencerId)?.handle
                          : "Buscar influenciador..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-popover z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar..." />
                        <CommandList>
                          <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                          <CommandGroup>
                            {modalAvailableInfluencers.map((inf) => (
                              <CommandItem
                                key={inf.id}
                                value={inf.handle}
                                onSelect={() => {
                                  setFormInfluencerId(inf.id);
                                  setComboOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${formInfluencerId === inf.id ? "opacity-100" : "opacity-0"}`}
                                />
                                {inf.handle}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {editRecord && (
                <div className="text-sm text-muted-foreground">
                  Influenciador: <strong>{getInfluencerHandle(editRecord.influencer_id)}</strong>
                </div>
              )}

              <div className="space-y-2">
                <Label>Valor Pago (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formValorPago}
                  onChange={(e) => setFormValorPago(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Faturamento (R$) <span className="text-muted-foreground text-xs">— pode preencher depois</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formFaturamento}
                  onChange={(e) => setFormFaturamento(e.target.value)}
                />
              </div>

              {formValorPago && formFaturamento && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa (10%)</span>
                    <span>{formatCurrency(calcTaxaPlataforma(Number(formFaturamento)))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucro líquido</span>
                    <span className={`font-medium ${calcLucroLiquido(Number(formFaturamento), Number(formValorPago)) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatCurrency(calcLucroLiquido(Number(formFaturamento), Number(formValorPago)))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margem</span>
                    <span>{formatPercent(calcMargem(Number(formFaturamento), Number(formValorPago)))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <ResultadoChip status={getStatusResultado(Number(formFaturamento), Number(formValorPago))} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {editRecord
                    ? (editRecord.comprovante_url ? "Substituir Comprovante" : "Anexar Comprovante")
                    : "Comprovante de Pagamento"}
                  {" "}<span className="text-muted-foreground text-xs">— pode anexar depois</span>
                </Label>
                <label className="cursor-pointer block">
                  <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4" />
                    {formFile ? formFile.name : "Selecionar arquivo (JPG, PNG, PDF)"}
                  </div>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label>Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Textarea
                  placeholder="Observações sobre o registro..."
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Shared / Partners toggle */}
              <div className="space-y-3 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Foi dividido com alguém?</Label>
                  <Switch checked={formIsShared} onCheckedChange={setFormIsShared} />
                </div>

                {formIsShared && (
                  <div className="space-y-3 pl-1">
                    {/* Partner selection */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Parceiros (até 4)</Label>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {allClosers
                          .filter((c) => c.id !== user?.id)
                          .map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={formSelectedPartners.includes(c.id)}
                                onCheckedChange={(checked) => {
                                  if (checked && formSelectedPartners.length >= 4) {
                                    toast.info("Máximo de 4 parceiros");
                                    return;
                                  }
                                  setFormSelectedPartners((prev) =>
                                    checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                  );
                                }}
                              />
                              {c.nome}
                            </label>
                          ))}
                      </div>
                    </div>

                    {/* Division type + amounts (optional) */}
                    {formSelectedPartners.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Tipo de divisão</Label>
                          <Select value={formShareType} onValueChange={setFormShareType}>
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent" className="text-xs">Porcentagem</SelectItem>
                              <SelectItem value="value" className="text-xs">Valor (R$)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {formSelectedPartners.map((pid) => {
                          const nome = allClosers.find((c) => c.id === pid)?.nome || pid;
                          return (
                            <div key={pid} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-24 truncate">{nome}</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={formShareType === "percent" ? "%" : "R$"}
                                className="h-7 text-xs w-24"
                                value={formPartnerAmounts[pid] || ""}
                                onChange={(e) =>
                                  setFormPartnerAmounts((prev) => ({ ...prev, [pid]: e.target.value }))
                                }
                              />
                              <span className="text-[10px] text-muted-foreground">(opcional)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Shared note */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Observação do split</Label>
                      <Input
                        placeholder="Ex: 50/50, pagamento em 2 pix..."
                        className="h-8 text-sm"
                        value={formSharedNote}
                        onChange={(e) => setFormSharedNote(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {(editRecord || modalAvailableInfluencers.length > 0) && (
              <Button onClick={() => handleSubmit()} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editRecord ? "Salvar" : "Registrar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprovante Lightbox */}
      <ComprovanteLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        url={lightboxUrl}
      />

      {/* Edit Reason Modal */}
      <EditReasonModal
        open={reasonModalOpen}
        onClose={() => {
          setReasonModalOpen(false);
          setPendingInlineAction(null);
          setPendingDiffs([]);
        }}
        onConfirm={handleReasonConfirm}
        diffs={pendingDiffs}
        submitting={submitting}
      />
    </div>
  );
}
