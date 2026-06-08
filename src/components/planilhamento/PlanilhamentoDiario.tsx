import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { DAILY_FEE_RATE, DAILY_FEE_LABEL } from "@/lib/constants";
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
  Search,
  Copy,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  ChevronsUpDown,
  Pencil,
  X,
  AlertCircle,
  CalendarDays,
  ArrowDown,
  ArrowUp,
  Info,
} from "lucide-react";
import ComprovanteThumbnail from "./ComprovanteThumbnail";
import ComprovanteLightbox from "./ComprovanteLightbox";
import ProofUploader from "./ProofUploader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  comprovante_url_2: string | null;
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
  return faturamento * DAILY_FEE_RATE;
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

// BRL input mask: stores formatted string like "1.000,00" in state.
function maskBRL(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(masked: string): number {
  if (!masked) return 0;
  const normalized = masked.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function formatBRLFromNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getHandleInitials(handle: string): string {
  return handle.replace("@", "").slice(0, 2).toUpperCase();
}

function workflowBadgeClass(status: string | null, hasProof: boolean) {
  if (!hasProof) return "bg-[#efefed] text-[#6e6e6e]";
  if (status === "Postou") return "bg-[#e9f6cf] text-[#628d1f]";
  if (status === "Apagou") return "bg-[#f1f1ef] text-[#7b7b78]";
  return "bg-[#eef2ff] text-[#5a67d8]";
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
  neutral = false,
}: {
  value: number | null;
  onSave: (val: number | null) => void;
  neutral?: boolean;
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

  const colorClass = neutral
    ? "text-foreground font-medium"
    : value !== null && value < 0
      ? "text-red-600 font-medium"
      : value !== null && value > 0
        ? "text-emerald-700 font-medium"
        : "";

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 group text-sm"
      title="Editar acumulado"
    >
      <span className={colorClass}>
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

export default function PlanilhamentoDiario({
  closerId,
  externalMonth,
  focusedDate,
  compact = false,
}: {
  closerId?: string;
  externalMonth?: string;
  focusedDate?: string;
  compact?: boolean;
}) {
  const { user, isAdmin } = useAuth();
  const viewingOther = !!closerId && closerId !== user?.id;
  const now = new Date();
  const [internalYear, setInternalYear] = useState(now.getFullYear());
  const [internalMonth, setInternalMonth] = useState(now.getMonth());

  // When externalMonth is provided, derive year/month from it and hide internal selector
  const resolvedExternalMonth = externalMonth || (focusedDate ? focusedDate.slice(0, 7) : undefined);
  const hasExternalMonth = !!resolvedExternalMonth;
  const selectedYear = hasExternalMonth ? Number(resolvedExternalMonth!.split("-")[0]) : internalYear;
  const selectedMonth = hasExternalMonth ? Number(resolvedExternalMonth!.split("-")[1]) - 1 : internalMonth;
  const setSelectedYear = setInternalYear;
  const setSelectedMonth = setInternalMonth;
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasFetchedOnce = useRef(false);
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
  const [formAcumulado, setFormAcumulado] = useState("");
  const [formObservacao, setFormObservacao] = useState("");
  const [formFile1, setFormFile1] = useState<File | null>(null);
  const [formFile2, setFormFile2] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  // Comprovante lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");

  // Shared/partners state — partners are now free-text names (not user IDs)
  const [formIsShared, setFormIsShared] = useState(false);
  const [formSharedNote, setFormSharedNote] = useState("");
  const [formPartnerNames, setFormPartnerNames] = useState<string[]>([]);
  const [formPartnerInput, setFormPartnerInput] = useState("");
  const [formShareType, setFormShareType] = useState<string>("percent");
  const [formPartnerAmounts, setFormPartnerAmounts] = useState<Record<string, string>>({});
  const [sharedPartnersMap, setSharedPartnersMap] = useState<Map<string, SharedPartner[]>>(new Map());

  // Persistent days from DB
  const [persistedDays, setPersistedDays] = useState<string[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [creatingAllDays, setCreatingAllDays] = useState(false);
  const [daySearch, setDaySearch] = useState("");
  const [dayFilter, setDayFilter] = useState<"all" | "proof" | "pending">("all");
  const [dayListOpen, setDayListOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const monthDays = useMemo(() => getMonthDays(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const prevFetchKey = useRef("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const isInitial = !hasFetchedOnce.current;
    if (isInitial) setLoading(true);
    else setIsSyncing(true);

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

    const [recordsRes, infRes, sheetsRes] = await Promise.all([
      recordsQuery,
      infQuery,
      sheetsQuery,
    ]);

    const fetchedRecords = (recordsRes.data as DailyRecord[]) || [];
    setRecords(fetchedRecords);
    setInfluencers(infRes.data || []);
    setPersistedDays((sheetsRes.data || []).map((s: any) => s.date));

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
    setIsSyncing(false);

    const today = new Date().toISOString().split("T")[0];
    if (isInitial && !viewingOther && today >= startDate && today <= endDate) {
      setExpandedDays(new Set([today]));
    }
    hasFetchedOnce.current = true;
  }, [user, isAdmin, closerId, selectedYear, selectedMonth, monthKey]);

  // Only reset hasFetchedOnce when the actual data key changes (month/year/closer)
  useEffect(() => {
    const newKey = `${selectedYear}-${selectedMonth}-${closerId || "self"}`;
    if (newKey !== prevFetchKey.current) {
      hasFetchedOnce.current = false;
      prevFetchKey.current = newKey;
    }
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
    if (focusedDate) return [focusedDate];
    const days = new Set<string>();
    for (const d of recordsByDate.keys()) days.add(d);
    for (const d of persistedDays) days.add(d);
    const today = new Date().toISOString().split("T")[0];
    if (monthDays.includes(today)) days.add(today);
    return monthDays.filter((d) => days.has(d));
  }, [recordsByDate, persistedDays, monthDays, focusedDate]);

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

  // --- Add specific day via date picker ---
  const handleAddSpecificDay = async (date: Date | undefined) => {
    if (!date || !user) return;
    setDatePickerOpen(false);
    const dateStr = format(date, "yyyy-MM-dd");

    if (persistedDays.includes(dateStr)) {
      setExpandedDays((prev) => new Set([...prev, dateStr]));
      toast.info("Esse dia já existe");
      return;
    }

    try {
      const { error } = await supabase.from("daily_sheets").insert({
        date: dateStr,
        month: monthKey,
        closer_id: user.id,
      } as any);

      if (error) {
        if (error.code === "23505") {
          toast.info("Esse dia já existe");
          setExpandedDays((prev) => new Set([...prev, dateStr]));
          return;
        }
        toast.error("Erro ao adicionar dia", { description: error.message });
        return;
      }

      setPersistedDays((prev) => [...prev, dateStr]);
      setExpandedDays((prev) => new Set([...prev, dateStr]));
      toast.success(`Dia ${date.getDate()} adicionado`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao adicionar dia", { description: message });
    }
  };

  // --- Create all missing days in the month (admin/migration) ---
  const handleCreateAllMissingDays = async () => {
    if (!user) return;
    setCreatingAllDays(true);

    const existingSet = new Set(persistedDays);
    const missingDays = monthDays.filter((d) => !existingSet.has(d));

    if (missingDays.length === 0) {
      toast.info("Todos os dias do mês já existem");
      setCreatingAllDays(false);
      return;
    }

    const toInsert = missingDays.map((d) => ({
      date: d,
      month: monthKey,
      closer_id: user.id,
    }));

    const { error } = await supabase.from("daily_sheets").insert(toInsert as any);

    if (error) {
      console.error("Error creating missing days:", error);
      toast.error("Erro ao criar dias faltantes", { description: error.message });
    } else {
      setPersistedDays((prev) => [...prev, ...missingDays]);
      toast.success(`${missingDays.length} dias faltantes criados`);
    }

    setCreatingAllDays(false);
  };

  // --- Add row ---
  const openNewRecord = (date: string) => {
    setEditRecord(null);
    setModalDate(date);
    setFormInfluencerId("");
    setFormValorPago("");
    setFormFaturamento("");
    setFormAcumulado("");
    setFormObservacao("");
    setFormFile1(null);
    setFormFile2(null);
    setFormIsShared(false);
    setFormSharedNote("");
    setFormPartnerNames([]);
    setFormPartnerInput("");
    setFormShareType("percent");
    setFormPartnerAmounts({});
    setModalOpen(true);
  };

  const openEditRecord = (record: DailyRecord) => {
    setEditRecord(record);
    setModalDate(record.date);
    setFormInfluencerId(record.influencer_id);
    setFormValorPago(formatBRLFromNumber(record.valor_pago));
    setFormFaturamento(record.faturamento !== null ? formatBRLFromNumber(record.faturamento) : "");
    setFormAcumulado(record.acumulado !== null ? formatBRLFromNumber(record.acumulado) : "");
    setFormObservacao(record.observacao || "");
    setFormFile1(null);
    setFormFile2(null);
    setFormIsShared(record.is_shared || false);
    setFormSharedNote(record.shared_note || "");
    // Load existing partners (by name)
    const existingPartners = sharedPartnersMap.get(record.id) || [];
    setFormPartnerNames(existingPartners.map((p) => p.partner_nome || ""));
    setFormPartnerInput("");
    setFormShareType(existingPartners[0]?.share_type || "percent");
    const amounts: Record<string, string> = {};
    existingPartners.forEach((p) => {
      const key = p.partner_nome || p.id;
      if (p.share_amount != null) amounts[key] = String(p.share_amount);
    });
    setFormPartnerAmounts(amounts);
    setModalOpen(true);
  };

  const getAvailableInfluencers = (date: string) => {
    const dayRecords = recordsByDate.get(date) || [];
    const usedIds = new Set(dayRecords.map((r) => r.influencer_id));
    return influencers.filter((i) => !usedIds.has(i.id));
  };

  // Helper: check if a date string is a past day (before today)
  const isPastDay = (dateStr: string): boolean => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr < today;
  };

  // Critical fields that require a reason for editing on PAST days
  const detectCriticalDiffs = (targetDate?: string): FieldDiff[] => {
    const dateToCheck = targetDate || modalDate;
    // Current day: no justification needed for anything
    if (!isPastDay(dateToCheck)) return [];

    // Past day: check for critical financial changes
    if (!editRecord) {
      // Adding a new record on a past day is critical
      return [{ field: "new_record", label: "Novo registro em dia passado", before: "(vazio)", after: `Adicionando em ${dateToCheck}` }];
    }

    const diffs: FieldDiff[] = [];
    const newValorPago = Number(formValorPago);
    const newFaturamento = formFaturamento ? Number(formFaturamento) : null;
    const oldValorPago = Number(editRecord.valor_pago);
    const oldFaturamento = editRecord.faturamento != null ? Number(editRecord.faturamento) : null;

    // Any change to valor_pago on a past day is critical
    if (newValorPago !== oldValorPago) {
      diffs.push({ field: "valor_pago", label: formatFieldLabel("valor_pago"), before: String(oldValorPago), after: String(newValorPago) });
    }
    // Any change to faturamento on a past day is critical
    if (String(newFaturamento ?? "") !== String(oldFaturamento ?? "")) {
      diffs.push({ field: "faturamento", label: formatFieldLabel("faturamento"), before: String(oldFaturamento ?? ""), after: String(newFaturamento ?? "") });
    }
    // Replacing existing comprovante on a past day
    if (formFile1 && editRecord.comprovante_url) {
      diffs.push({ field: "comprovante_url", label: formatFieldLabel("comprovante_url"), before: "(arquivo anterior)", after: formFile1.name });
    }
    if (formFile2 && editRecord.comprovante_url_2) {
      diffs.push({ field: "comprovante_url_2", label: "Comprovante 2", before: "(arquivo anterior)", after: formFile2.name });
    }
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

    // If critical changes detected (past day edits), require reason
    if (!editReason) {
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
      let comprovanteUrl2 = editRecord?.comprovante_url_2 || "";

      // Upload comprovante 1
      if (formFile1) {
        const ext = formFile1.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_1.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes")
          .upload(path, formFile1);
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Erro no upload do comprovante 1", { description: uploadError.message });
          setSubmitting(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        comprovanteUrl = urlData.publicUrl;
      }

      // Upload comprovante 2
      if (formFile2) {
        const ext = formFile2.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_2.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes")
          .upload(path, formFile2);
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Erro no upload do comprovante 2", { description: uploadError.message });
          setSubmitting(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        comprovanteUrl2 = urlData.publicUrl;
      }

      const payload: Record<string, unknown> = {
        valor_pago: Number(formValorPago),
        faturamento: formFaturamento ? Number(formFaturamento) : null,
        acumulado: formAcumulado ? Number(formAcumulado) : null,
        observacao: formObservacao || null,
        is_shared: formIsShared,
        shared_note: formIsShared ? (formSharedNote || null) : null,
      };

      let savedRecordId: string | null = null;

      if (editRecord) {
        if (formFile1) payload.comprovante_url = comprovanteUrl;
        if (formFile2) payload.comprovante_url_2 = comprovanteUrl2;

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
        payload.comprovante_url_2 = comprovanteUrl2 || null;
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

        // Auto-lock: upsert influencer_locks when creating a new daily record
        const selectedInf = influencers.find((i) => i.id === formInfluencerId);
        if (selectedInf) {
          const handleNorm = selectedInf.handle.trim().toLowerCase().replace(/^@/, "");
          const lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

          // Try update first (atomic upsert pattern)
          const { data: existingLock } = await supabase
            .from("influencer_locks")
            .select("id")
            .eq("handle_normalized", handleNorm)
            .maybeSingle();

          if (existingLock) {
            await supabase
              .from("influencer_locks")
              .update({
                locked_by_user_id: user.id,
                locked_by_nome: user.nome,
                locked_until: lockedUntil,
                last_activity_at: new Date().toISOString(),
                influencer_id: formInfluencerId,
              })
              .eq("handle_normalized", handleNorm);
          } else {
            await supabase
              .from("influencer_locks")
              .insert({
                handle_normalized: handleNorm,
                locked_by_user_id: user.id,
                locked_by_nome: user.nome,
                locked_until: lockedUntil,
                last_activity_at: new Date().toISOString(),
                influencer_id: formInfluencerId,
              });
          }

          // Also update influencers table for backward compat
          await supabase
            .from("influencers")
            .update({
              last_closed_at: new Date().toISOString(),
              owner_id: user.id,
              owner_nome: user.nome,
            })
            .eq("id", formInfluencerId);

          // Audit event
          await supabase.from("close_events").insert({
            influencer_id: formInfluencerId,
            influencer_handle: selectedInf.handle,
            feito_por_id: user.id,
            feito_por_nome: user.nome,
            feito_em: new Date().toISOString(),
            acao: "FECHAMENTO",
            motivo: `Auto-lock via registro diário até ${new Date(lockedUntil).toLocaleDateString("pt-BR")}`,
          });
        }

        // Store edit reason for new records on past days
        if (editReason && savedRecordId) {
          const selectedInfForReason = influencers.find((i) => i.id === formInfluencerId);
          await supabase.functions.invoke("store-edit-reason", {
            body: {
              entity_id: savedRecordId,
              entity_type: "daily_influencer_records",
              edit_reason: editReason,
              field_changes: { new_record: { before: null, after: { date: modalDate, valor_pago: Number(formValorPago), faturamento: formFaturamento ? Number(formFaturamento) : null } } },
              influencer_handle: selectedInfForReason?.handle || formInfluencerId,
            },
          });
        }

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
        if (formIsShared && formPartnerNames.length > 0) {
          const partnersToInsert = formPartnerNames.map((name) => ({
            record_id: savedRecordId!,
            partner_user_id: null,
            partner_nome: name,
            share_type: formPartnerAmounts[name] ? formShareType : null,
            share_amount: formPartnerAmounts[name] ? Number(formPartnerAmounts[name]) : null,
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

  const getFilteredDayRecords = (dayRecords: DailyRecord[]) => {
    return dayRecords.filter((record) => {
      const handle = getInfluencerHandle(record.influencer_id).toLowerCase();
      const matchesSearch = !daySearch.trim() || handle.includes(daySearch.trim().toLowerCase());
      const matchesFilter =
        dayFilter === "all" ? true : dayFilter === "proof" ? !!record.comprovante_url : !record.comprovante_url;
      return matchesSearch && matchesFilter;
    });
  };

  const copyDayInfluencers = async (dayRecords: DailyRecord[]) => {
    const text = dayRecords
      .map((record) => getInfluencerHandle(record.influencer_id))
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lista do dia copiada!");
    } catch {
      toast.error("Não foi possível copiar a lista.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Background sync indicator */}
      {isSyncing && (
        <div className="sticky top-0 z-30 flex items-center justify-center gap-2 py-1.5 bg-muted/80 backdrop-blur-sm rounded-md text-xs text-muted-foreground animate-in fade-in duration-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sincronizando…
        </div>
      )}
      {/* Month selector — hidden when controlled externally or embedded in workspace */}
      {!hasExternalMonth && !compact && !focusedDate && (
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
      )}
      {hasExternalMonth && !compact && !focusedDate && (
        <div className="flex items-center gap-6 text-sm flex-wrap">
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
      )}

      {/* Day sections */}
      {!focusedDate && activeDays.length === 0 ? (
        <div className="empty-state">
          <FileText className="empty-state-icon" />
          <h3 className="empty-state-title">Nenhum registro neste mês</h3>
          <p className="empty-state-description mb-4">Clique no botão abaixo para adicionar um dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDays.map((day) => {
            const dayRecords = recordsByDate.get(day) || [];
            const visibleDayRecords = focusedDate ? getFilteredDayRecords(dayRecords) : dayRecords;
            const isExpanded = focusedDate ? true : expandedDays.has(day);
            const dayTotal = dayRecords.reduce((s, r) => s + Number(r.valor_pago), 0);
            const dayFat = dayRecords.reduce((s, r) => s + (Number(r.faturamento) || 0), 0);
            const pendingCount = dayRecords.filter((r) => !r.comprovante_url).length;

            return (
              <div key={day} className="bg-card rounded-xl border overflow-hidden">
                {/* Day header */}
                {focusedDate ? null : (
                  <button
                    onClick={() => toggleDay(day)}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-muted/30 transition-colors gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-foreground capitalize whitespace-nowrap">{formatDayLabel(day)}</span>
                      <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                        {dayRecords.length} {dayRecords.length === 1 ? "registro" : "registros"}
                      </Badge>
                      {pendingCount > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap shrink-0 hidden sm:inline-flex">
                          <AlertCircle className="h-3 w-3" />
                          {pendingCount} sem comprovante
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      <span className="inline-flex items-center gap-0.5"><ArrowDown className="h-3 w-3" />{formatCurrency(dayTotal)}</span>
                      <span className="inline-flex items-center gap-0.5"><ArrowUp className="h-3 w-3" />{formatCurrency(dayFat)}</span>
                    </div>
                  </button>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t">
                    {focusedDate ? (
                      <div className="space-y-5 bg-[#fcfcf8] p-4 md:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => setDayListOpen(true)}
                              variant="outline"
                              className="h-12 rounded-full border-[#ececeb] bg-white px-5 text-[#1f1f1f] shadow-none hover:bg-[#f8f8f5]"
                            >
                              Lista do dia
                            </Button>
                          </div>


                          <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative min-w-[260px]">
                              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a97]" />
                              <Input
                                value={daySearch}
                                onChange={(e) => setDaySearch(e.target.value)}
                                placeholder="Buscar influenciador..."
                                className="h-12 rounded-full border-[#ececeb] bg-white pl-11 text-[14px] shadow-none"
                              />
                            </div>
                            {!viewingOther && (
                              <Button
                                onClick={() => openNewRecord(day)}
                                className="h-12 rounded-full bg-[#1f1f1f] px-5 text-white shadow-none hover:bg-[#000000]"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-[30px] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03]">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[1080px] border-collapse">
                              <thead>
                                <tr>
                                  <th className="w-[54px] px-5 py-5 text-left" />
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Nome</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Valor pago</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Faturamento</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Resultado</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Total no link</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Status</th>
                                  <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Comprovantes</th>
                                  {!viewingOther && <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e]">Ações</th>}
                                </tr>
                                <tr>
                                  <td colSpan={viewingOther ? 8 : 9} className="px-5">
                                    <div className="border-b border-dashed border-[#e6ddb0]" />
                                  </td>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleDayRecords.length === 0 ? (
                                  <tr>
                                    <td colSpan={viewingOther ? 8 : 9} className="px-6 py-12 text-center text-sm text-muted-foreground">
                                      Nenhum influenciador encontrado para esse dia.
                                    </td>
                                  </tr>
                                ) : (
                                  visibleDayRecords.map((record) => {
                                    const lucro = calcLucroLiquido(record.faturamento, record.valor_pago);
                                    const resultado = getStatusResultado(record.faturamento, record.valor_pago);
                                    const handle = getInfluencerHandle(record.influencer_id);
                                    const selected = selectedRecordId === record.id;

                                    return (
                                      <tr
                                        key={record.id}
                                        className={cn(
                                          "cursor-pointer transition",
                                          selected ? "bg-[linear-gradient(180deg,#ffe27a_0%,#ffd75b_100%)]" : "hover:bg-[#fbfbf8]"
                                        )}
                                        onClick={() => setSelectedRecordId(record.id)}
                                      >
                                        <td className="px-5 py-5 align-middle">
                                          <Checkbox
                                            checked={selected}
                                            onCheckedChange={() => setSelectedRecordId(selected ? null : record.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-5 w-5 rounded-[6px] border-[#cfcfcb] data-[state=checked]:border-[#242424] data-[state=checked]:bg-[#242424]"
                                          />
                                        </td>
                                        <td className="px-4 py-5 align-middle">
                                          <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#202020_0%,#3f3f3f_100%)] text-[12px] font-semibold text-white">
                                              {getHandleInitials(handle)}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="truncate text-[16px] font-medium tracking-[-0.02em] text-[#1f1f1f]">
                                                {handle}
                                              </div>
                                              {record.is_shared && (
                                                <div className="mt-1">
                                                  <SharedPartnersPopover
                                                    partners={sharedPartnersMap.get(record.id) || []}
                                                    sharedNote={record.shared_note}
                                                    compact
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-5 text-[15px] text-[#2c2c2c]">{formatCurrency(record.valor_pago)}</td>
                                        <td className="px-4 py-5 text-[15px] text-[#2c2c2c]">
                                          {record.faturamento !== null ? formatCurrency(record.faturamento) : "—"}
                                        </td>
                                        <td className={cn("px-4 py-5 text-[15px] font-medium", resultadoColor(resultado) || "text-[#2c2c2c]")}>
                                          {record.faturamento !== null ? formatCurrency(lucro) : "—"}
                                        </td>
                                        <td className="px-4 py-5">
                                          <div className="inline-flex items-center rounded-full border border-[#ececeb] bg-white/75 px-3 py-2 text-[14px] font-medium text-[#2c2c2c]">
                                            {record.acumulado !== null ? formatCurrency(record.acumulado) : "—"}
                                          </div>
                                        </td>
                                        <td className="px-4 py-5">
                                          <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium", workflowBadgeClass(record.status, !!record.comprovante_url))}>
                                            <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                            {!record.comprovante_url ? "Pendente" : record.status || "Gravando"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-5">
                                          <div className="flex items-center gap-2">
                                            {record.comprovante_url ? (
                                              <ComprovanteThumbnail
                                                url={record.comprovante_url}
                                                onClick={() => handleViewComprovante(record.comprovante_url)}
                                              />
                                            ) : (
                                              <span className="text-[13px] text-[#9a9a97]">—</span>
                                            )}
                                            {record.comprovante_url_2 ? (
                                              <ComprovanteThumbnail
                                                url={record.comprovante_url_2}
                                                onClick={() => handleViewComprovante(record.comprovante_url_2!)}
                                              />
                                            ) : null}
                                          </div>
                                        </td>
                                        {!viewingOther && (
                                          <td className="px-4 py-5 text-right">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-10 rounded-full border-[#ececeb] bg-white px-4 text-[#1f1f1f] shadow-none"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditRecord(record);
                                              }}
                                            >
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
                          </div>
                        </div>

                        <Dialog open={dayListOpen} onOpenChange={setDayListOpen}>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Lista do dia</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div className="max-h-[360px] overflow-y-auto rounded-[22px] border border-[#ececeb] bg-[#fcfcf8] p-4">
                                {dayRecords.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhum influenciador fechado neste dia.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {dayRecords.map((record) => (
                                      <div
                                        key={`day-list-${record.id}`}
                                        className="rounded-[16px] bg-white px-4 py-3 text-[15px] font-medium text-[#1f1f1f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                                      >
                                        {getInfluencerHandle(record.influencer_id)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  onClick={() => copyDayInfluencers(dayRecords)}
                                  className="h-11 rounded-full bg-[#242424] px-5 text-white shadow-none hover:bg-[#1b1b1b]"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copiar
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : null}

                    {/* Desktop table (hidden on mobile) */}
                    {!focusedDate && <div className="hidden md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/60">
                            <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Nome</th>
                            <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Valor Pago</th>
                            <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Faturamento</th>
                            <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">Resultado</th>
                            <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-left">
                              <span className="inline-flex items-center gap-1 group/tip">
                                Total no link
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[280px] text-xs font-normal normal-case tracking-normal leading-relaxed">
                                      Digite o valor total que está no link do influenciador. Amanhã você compara com o novo valor para saber quanto entrou no dia.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground/50 opacity-0 group-hover/tip:opacity-100 transition-opacity">(toque no ícone)</span>
                              </span>
                            </th>
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
                                    <div className="inline-block rounded-md bg-[#F3F4F6] px-2.5 py-1.5">
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
                                    </div>
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
                                    <div className="flex items-center justify-center gap-1">
                                      {record.comprovante_url ? (
                                        <ComprovanteThumbnail
                                          url={record.comprovante_url}
                                          onClick={() => handleViewComprovante(record.comprovante_url)}
                                        />
                                      ) : null}
                                      {record.comprovante_url_2 ? (
                                        <ComprovanteThumbnail
                                          url={record.comprovante_url_2}
                                          onClick={() => handleViewComprovante(record.comprovante_url_2!)}
                                        />
                                      ) : null}
                                      {!record.comprovante_url && (
                                        <div className="flex flex-col items-center gap-1">
                                          <AlertCircle className="h-4 w-4 text-destructive" />
                                          <span className="text-[10px] text-destructive font-medium leading-tight">Pendente</span>
                                        </div>
                                      )}
                                    </div>
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
                    </div>}

                    {/* Mobile card view (visible only on mobile) */}
                    {!focusedDate && <div className="md:hidden">
                      {dayRecords.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Nenhum registro. Clique no + para adicionar.
                        </div>
                      ) : (
                        <div className="divide-y divide-border/30">
                          {dayRecords.map((record) => {
                            const lucro = calcLucroLiquido(record.faturamento, record.valor_pago);
                            const resultado = getStatusResultado(record.faturamento, record.valor_pago);

                            return (
                              <div key={record.id} className="px-4 py-3 space-y-2">
                                {/* Header: handle + badges */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-medium text-sm min-w-0">
                                    <span className="truncate">{getInfluencerHandle(record.influencer_id)}</span>
                                    {record.is_shared && (
                                      <SharedPartnersPopover
                                        partners={sharedPartnersMap.get(record.id) || []}
                                        sharedNote={record.shared_note}
                                        compact
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {record.comprovante_url ? (
                                      <ComprovanteThumbnail
                                        url={record.comprovante_url}
                                        onClick={() => handleViewComprovante(record.comprovante_url)}
                                      />
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0.5">
                                        <AlertCircle className="h-3 w-3" />
                                        Pendente
                                      </Badge>
                                    )}
                                    {record.comprovante_url_2 && (
                                      <ComprovanteThumbnail
                                        url={record.comprovante_url_2}
                                        onClick={() => handleViewComprovante(record.comprovante_url_2!)}
                                      />
                                    )}
                                    {!viewingOther && (
                                      <button
                                        className="inline-flex items-center justify-center h-8 w-8 min-h-[40px] min-w-[40px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                        onClick={() => openEditRecord(record)}
                                        title="Editar registro"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Values grid */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block">Pago</span>
                                    <span className="font-medium">{formatCurrency(record.valor_pago)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Faturamento</span>
                                    <span className="font-medium">
                                      {record.faturamento !== null ? formatCurrency(record.faturamento) : <span className="italic text-muted-foreground">pendente</span>}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Resultado</span>
                                    <span className={`font-medium ${resultadoColor(resultado)}`}>
                                      {record.faturamento !== null ? formatCurrency(lucro) : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* Total no link */}
                                <div className="inline-block rounded-md bg-[#F3F4F6] px-3 py-1.5 max-w-[200px] w-fit">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total no link</span>
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[260px] text-xs font-normal normal-case tracking-normal leading-relaxed">
                                          Digite o valor total que está no link do influenciador. Amanhã você compara com o novo valor para saber quanto entrou no dia.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <span className="text-[10px] font-normal text-muted-foreground/40">(toque no ℹ)</span>
                                  </div>
                                  {viewingOther ? (
                                    <span className="text-sm font-medium text-foreground">
                                      {record.acumulado !== null ? formatCurrency(record.acumulado) : "—"}
                                    </span>
                                  ) : (
                                    <InlineAcumulado
                                      value={record.acumulado ?? null}
                                      onSave={(val) => handleAcumuladoSave(record.id, val)}
                                      neutral
                                    />
                                  )}
                                </div>

                                {/* Status + resultado badge row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {resultado && <ResultadoChip status={resultado} />}
                                  {record.status && (
                                    <Badge variant="secondary" className="text-[10px]">{record.status}</Badge>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>}

                    {/* Blue + button: add influencer to this day */}
                    {!viewingOther && !focusedDate && (
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

      {/* Action buttons: add day */}
      {!viewingOther && !compact && !focusedDate && (
        <div className="flex justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            onClick={handleAddDay}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar dia
          </Button>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarDays className="mr-2 h-4 w-4" />
                Adicionar dia específico
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={handleAddSpecificDay}
                defaultMonth={new Date(selectedYear, selectedMonth)}
                disabled={(date) => {
                  const m = date.getMonth();
                  const y = date.getFullYear();
                  return m !== selectedMonth || y !== selectedYear;
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleCreateAllMissingDays}
              disabled={creatingAllDays}
            >
              {creatingAllDays ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="mr-2 h-4 w-4" />
              )}
              Criar dias faltantes do mês
            </Button>
          )}
        </div>
      )}

      {/* Mobile month totals */}
      {!compact && !focusedDate && <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Investido</p>
          <p className="text-base font-semibold">{formatCurrency(monthTotals.totalInvestido)}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Faturado</p>
          <p className="text-base font-semibold">{formatCurrency(monthTotals.totalFaturado)}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{DAILY_FEE_LABEL}</p>
          <p className="text-base font-semibold text-muted-foreground">{formatCurrency(monthTotals.totalTaxa)}</p>
        </div>
        <div className={`rounded-xl border p-3 ${monthTotals.resultadoLiquido >= 0 ? "bg-emerald-50 border-emerald-200/50" : "bg-red-50 border-red-200/50"}`}>
          <p className="text-xs uppercase tracking-wider mb-1 text-muted-foreground">Resultado</p>
          <p className={`text-base font-semibold ${monthTotals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {formatCurrency(monthTotals.resultadoLiquido)}
          </p>
        </div>
      </div>}

      {/* New/Edit Record Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[min(1120px,calc(100vw-32px))] max-w-none overflow-hidden rounded-[32px] border border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbf8_100%)] p-0 shadow-[0_32px_80px_-40px_rgba(15,23,42,0.28)]">
          <div className="border-b border-[#ececeb] px-8 py-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-[34px] font-medium tracking-[-0.05em] text-[#1f1f1f]">
                {editRecord ? "Editar registro" : "Novo registro"}
              </DialogTitle>
              <p className="text-[14px] text-[#6e6e73]">
                Preencha tudo em uma única superfície, sem precisar rolar.
              </p>
            </DialogHeader>
          </div>

          <div className="px-8 py-6">
            {!editRecord && modalAvailableInfluencers.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  Sem influenciadores disponíveis para este dia
                </p>
                <p className="text-xs text-muted-foreground">
                  Todos os seus influenciadores já possuem registro nesta data.
                </p>
              </div>
            ) : (
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                <div className="h-full space-y-5 rounded-[28px] bg-white p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                  {!editRecord ? (
                    <div className="space-y-2">
                      <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Influenciador</Label>
                      <Popover open={comboOpen} onOpenChange={setComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={comboOpen}
                            className="h-14 w-full justify-between rounded-[20px] border-[#ececeb] bg-[#fcfcf8] px-5 text-[16px] font-normal text-[#1f1f1f] shadow-none"
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
                  ) : (
                    <div className="rounded-[20px] bg-[#f6f6f2] px-5 py-4 text-[15px] text-[#6e6e73]">
                      Influenciador: <strong className="text-[#1f1f1f]">{getInfluencerHandle(editRecord.influencer_id)}</strong>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Valor Pago (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={formValorPago}
                        onChange={(e) => setFormValorPago(e.target.value)}
                        className="h-14 rounded-[20px] border-[#ececeb] bg-[#fcfcf8] px-5 text-[16px] shadow-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Total no link</Label>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] text-xs font-normal leading-relaxed">
                              Digite o valor total que está no link do influenciador. Amanhã você compara com o novo valor para saber quanto entrou no dia.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={formAcumulado}
                        onChange={(e) => setFormAcumulado(e.target.value)}
                        className="h-14 rounded-[20px] border-[#ececeb] bg-[#f3f4f6] px-5 text-[16px] shadow-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Faturamento (R$) <span className="normal-case tracking-normal text-[#8d8d92]">— pode preencher depois</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formFaturamento}
                      onChange={(e) => setFormFaturamento(e.target.value)}
                      className="h-14 rounded-[20px] border-[#ececeb] bg-[#fcfcf8] px-5 text-[16px] shadow-none"
                    />
                  </div>

                  {formValorPago && formFaturamento && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[22px] bg-[#f6f6f2] px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#8a8a8a]">{DAILY_FEE_LABEL}</div>
                        <div className="mt-2 text-[18px] font-semibold text-[#1f1f1f]">{formatCurrency(calcTaxaPlataforma(Number(formFaturamento)))}</div>
                      </div>
                      <div className="rounded-[22px] bg-[#f6f6f2] px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#8a8a8a]">Lucro líquido</div>
                        <div className={`mt-2 text-[18px] font-semibold ${calcLucroLiquido(Number(formFaturamento), Number(formValorPago)) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {formatCurrency(calcLucroLiquido(Number(formFaturamento), Number(formValorPago)))}
                        </div>
                      </div>
                      <div className="rounded-[22px] bg-[#f6f6f2] px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#8a8a8a]">Margem</div>
                        <div className="mt-2 text-[18px] font-semibold text-[#1f1f1f]">{formatPercent(calcMargem(Number(formFaturamento), Number(formValorPago)))}</div>
                      </div>
                      <div className="rounded-[22px] bg-[#f6f6f2] px-4 py-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#8a8a8a]">Status</div>
                        <div className="mt-2"><ResultadoChip status={getStatusResultado(Number(formFaturamento), Number(formValorPago))} /></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-full space-y-5 rounded-[28px] bg-white p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                  <div className="grid items-start gap-4 md:grid-cols-2">
                    <ProofUploader
                      label={editRecord ? (editRecord.comprovante_url ? "Substituir Comprovante 1" : "Anexar Comprovante 1") : "Comprovante 1"}
                      sublabel="— pode anexar depois"
                      value={formFile1}
                      existingUrl={editRecord?.comprovante_url || undefined}
                      onChange={setFormFile1}
                      disabled={submitting}
                      compact
                    />

                    <ProofUploader
                      label={editRecord ? (editRecord.comprovante_url_2 ? "Substituir Comprovante 2" : "Anexar Comprovante 2") : "Comprovante 2"}
                      sublabel="(opcional)"
                      value={formFile2}
                      existingUrl={editRecord?.comprovante_url_2 || undefined}
                      onChange={setFormFile2}
                      disabled={submitting}
                      compact
                    />
                  </div>

                  <div className="space-y-4 border-t border-[#ececeb] pt-5">
                    <div className="flex min-h-[36px] items-center justify-between">
                      <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Foi dividido com alguém?</Label>
                      <Switch checked={formIsShared} onCheckedChange={setFormIsShared} />
                    </div>

                    {formIsShared && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Parceiros (até 4)</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome do parceiro"
                              className="h-12 flex-1 rounded-[18px] border-[#ececeb] bg-[#fcfcf8] px-4 text-sm shadow-none"
                              value={formPartnerInput}
                              onChange={(e) => setFormPartnerInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const name = formPartnerInput.trim();
                                  if (!name) return;
                                  if (formPartnerNames.length >= 4) {
                                    toast.info("Máximo de 4 parceiros");
                                    return;
                                  }
                                  if (formPartnerNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
                                    toast.info("Parceiro já adicionado");
                                    return;
                                  }
                                  setFormPartnerNames((prev) => [...prev, name]);
                                  setFormPartnerInput("");
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-12 rounded-[18px] px-4"
                              disabled={!formPartnerInput.trim() || formPartnerNames.length >= 4}
                              onClick={() => {
                                const name = formPartnerInput.trim();
                                if (!name) return;
                                if (formPartnerNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
                                  toast.info("Parceiro já adicionado");
                                  return;
                                }
                                setFormPartnerNames((prev) => [...prev, name]);
                                setFormPartnerInput("");
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {formPartnerNames.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {formPartnerNames.map((name) => (
                                <Badge key={name} variant="secondary" className="gap-1 rounded-full bg-[#f3f3ef] pr-1 text-xs">
                                  {name}
                                  <button
                                    type="button"
                                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                    onClick={() => setFormPartnerNames((prev) => prev.filter((n) => n !== name))}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {formPartnerNames.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Tipo de divisão</Label>
                              <Select value={formShareType} onValueChange={setFormShareType}>
                                <SelectTrigger className="h-9 w-[140px] rounded-[14px] border-[#ececeb] bg-[#fcfcf8] text-xs shadow-none">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent" className="text-xs">Porcentagem</SelectItem>
                                  <SelectItem value="value" className="text-xs">Valor (R$)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {formPartnerNames.map((name) => (
                                <div key={name} className="rounded-[18px] border border-[#ececeb] bg-[#fcfcf8] px-3 py-3">
                                  <div className="truncate text-xs font-medium text-[#6e6e73]">{name}</div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder={formShareType === "percent" ? "%" : "R$"}
                                      className="h-9 rounded-[12px] border-[#e5e7eb] bg-white text-xs shadow-none"
                                      value={formPartnerAmounts[name] || ""}
                                      onChange={(e) =>
                                        setFormPartnerAmounts((prev) => ({ ...prev, [name]: e.target.value }))
                                      }
                                    />
                                    <span className="text-[10px] text-muted-foreground">(opcional)</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7a7a78]">Observação do split</Label>
                          <Input
                            placeholder="Ex: 50/50, pagamento em 2 pix..."
                            className="h-12 rounded-[18px] border-[#ececeb] bg-[#fcfcf8] px-4 text-sm shadow-none"
                            value={formSharedNote}
                            onChange={(e) => setFormSharedNote(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#ececeb] px-8 py-5">
            <Button variant="outline" className="h-12 rounded-full border-[#ececeb] px-6" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {(editRecord || modalAvailableInfluencers.length > 0) && (
              <Button className="h-12 rounded-full bg-[#242424] px-6 text-white hover:bg-[#1b1b1b]" onClick={() => handleSubmit()} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? "Salvando…" : editRecord ? "Salvar" : "Registrar"}
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
