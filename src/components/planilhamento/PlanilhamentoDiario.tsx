import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  Paperclip,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  ChevronsUpDown,
} from "lucide-react";

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
  created_at: string;
  updated_at: string;
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
  const margem = calcMargem(faturamento, valorPago);
  if (margem === null) return null;
  if (margem >= 0.30) return "VERDE";
  if (margem > 0) return "AMARELO";
  return "VERMELHO";
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

const WORKFLOW_STATUSES = ["Gravando", "Postou", "Apagou"] as const;

function WorkflowStatusDropdown({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (val: string) => void;
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs w-[110px] border-border/50">
        <SelectValue placeholder="Status..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {WORKFLOW_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

export default function PlanilhamentoDiario() {
  const { user, isAdmin } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [renewingId, setRenewingId] = useState<string | null>(null);

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

  // Persistent days from DB
  const [persistedDays, setPersistedDays] = useState<string[]>([]);

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const monthDays = useMemo(() => getMonthDays(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;

    // Fetch records, influencers, and persisted days in parallel
    let recordsQuery = supabase
      .from("daily_influencer_records")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (!isAdmin) {
      recordsQuery = recordsQuery.eq("closer_id", user.id);
    }

    let sheetsQuery = supabase
      .from("daily_sheets")
      .select("date")
      .eq("month", monthKey);

    if (!isAdmin) {
      sheetsQuery = sheetsQuery.eq("closer_id", user.id);
    }

    let infQuery = supabase.from("influencers").select("id, handle, last_closed_at").eq("ativo", true);
    if (!isAdmin) {
      infQuery = infQuery.eq("owner_id", user.id);
    }

    const [recordsRes, infRes, sheetsRes] = await Promise.all([
      recordsQuery,
      infQuery,
      sheetsQuery,
    ]);

    setRecords((recordsRes.data as DailyRecord[]) || []);
    setInfluencers(infRes.data || []);
    setPersistedDays((sheetsRes.data || []).map((s: any) => s.date));
    setLoading(false);

    // Auto-expand today
    const today = new Date().toISOString().split("T")[0];
    if (today >= startDate && today <= endDate) {
      setExpandedDays(new Set([today]));
    }
  }, [user, isAdmin, selectedYear, selectedMonth, monthKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group records by date
  const recordsByDate = useMemo(() => {
    const map = new Map<string, DailyRecord[]>();
    for (const r of records) {
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  }, [records]);

  // Days that have data or are persisted
  const activeDays = useMemo(() => {
    const days = new Set<string>();
    for (const d of recordsByDate.keys()) days.add(d);
    for (const d of persistedDays) days.add(d);
    // Also add today if in current month
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

  // Month navigation
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

  // --- Add day (blue +) — now persists to DB ---
  const handleAddDay = async () => {
    if (!user) return;

    // Find the latest active day and add the next one
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

    // Check if already exists
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

  // --- Add row (red +) — always opens modal, shows empty state if no influencers ---
  const openNewRecord = (date: string) => {
    setEditRecord(null);
    setModalDate(date);
    setFormInfluencerId("");
    setFormValorPago("");
    setFormFaturamento("");
    setFormObservacao("");
    setFormFile(null);
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
    setModalOpen(true);
  };

  const getAvailableInfluencers = (date: string) => {
    const dayRecords = recordsByDate.get(date) || [];
    const usedIds = new Set(dayRecords.map((r) => r.influencer_id));
    return influencers.filter((i) => !usedIds.has(i.id));
  };

  const handleSubmit = async () => {
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
    if (!editRecord && !formFile) {
      toast.error("O comprovante é obrigatório");
      return;
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
      };

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
        toast.success("Registro atualizado!");
      } else {
        payload.date = modalDate;
        payload.influencer_id = formInfluencerId;
        payload.closer_id = user.id;
        payload.comprovante_url = comprovanteUrl;
        const { error } = await supabase
          .from("daily_influencer_records")
          .insert(payload as any);
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        toast.success("Registro criado!");
      }

      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Submit error:", err);
      toast.error("Erro ao salvar", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: string) => {
    const { error } = await supabase
      .from("daily_influencer_records")
      .update({ status: newStatus })
      .eq("id", recordId);
    if (error) {
      console.error("Status update error:", error);
      toast.error("Erro ao atualizar status", { description: error.message });
      return;
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, status: newStatus } : r))
    );
  };

  const handleViewComprovante = async (url: string) => {
    const path = url.split("/comprovantes/")[1];
    if (path) {
      const { data } = await supabase.storage.from("comprovantes").createSignedUrl(path, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        return;
      }
    }
    window.open(url, "_blank");
  };

  const handleRenovar = async (record: DailyRecord) => {
    if (!user) return;
    const { data: existingEvents } = await supabase
      .from("close_events")
      .select("id")
      .eq("influencer_id", record.influencer_id)
      .eq("feito_por_id", user.id)
      .gte("feito_em", new Date().toISOString().split("T")[0] + "T00:00:00Z");

    if (existingEvents && existingEvents.length > 0) {
      toast.error("Já renovado hoje");
      return;
    }

    setRenewingId(record.influencer_id);
    const now2 = new Date().toISOString();
    const handle = getInfluencerHandle(record.influencer_id);

    const { error: updateError } = await supabase
      .from("influencers")
      .update({ last_closed_at: now2, owner_id: user.id, owner_nome: user.nome })
      .eq("id", record.influencer_id);

    if (updateError) {
      console.error("Renovar error:", updateError);
      toast.error("Erro ao renovar", { description: updateError.message });
      setRenewingId(null);
      return;
    }

    await supabase.from("close_events").insert({
      influencer_id: record.influencer_id,
      influencer_handle: handle,
      feito_por_id: user.id,
      feito_por_nome: user.nome,
      feito_em: now2,
      acao: "FECHAMENTO",
      motivo: "Renovação via registro diário",
    });

    toast.success("Renovado!", { description: `${handle} renovado por +10 dias.` });
    setRenewingId(null);
    fetchData();
  };

  // --- Month totals ---
  const monthTotals = useMemo(() => {
    const totalInvestido = records.reduce((sum, r) => sum + Number(r.valor_pago), 0);
    const totalFaturado = records.reduce((sum, r) => sum + (Number(r.faturamento) || 0), 0);
    const totalTaxa = calcTaxaPlataforma(totalFaturado);
    const resultadoLiquido = totalFaturado - totalInvestido - totalTaxa;
    return { totalInvestido, totalFaturado, totalTaxa, resultadoLiquido };
  }, [records]);

  // Running accumulated total
  const accumulatedByDate = useMemo(() => {
    const sorted = [...activeDays].sort();
    const map = new Map<string, number>();
    let acc = 0;
    for (const day of sorted) {
      const dayRecords = recordsByDate.get(day) || [];
      for (const r of dayRecords) {
        acc += calcLucroLiquido(r.faturamento, r.valor_pago);
      }
      map.set(day, acc);
    }
    return map;
  }, [activeDays, recordsByDate]);

  // Check if modal has available influencers
  const modalAvailableInfluencers = useMemo(() => {
    if (!modalDate) return [];
    return getAvailableInfluencers(modalDate);
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
                          <th className="text-xs font-semibold text-foreground/70 uppercase tracking-wider py-2.5 px-4 text-right">Ações</th>
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
                          dayRecords.map((record) => {
                            const lucro = calcLucroLiquido(record.faturamento, record.valor_pago);
                            const resultado = getStatusResultado(record.faturamento, record.valor_pago);
                            const accumulated = accumulatedByDate.get(day) ?? 0;

                            return (
                              <tr key={record.id} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                                <td className="py-2.5 px-4 text-sm font-medium">{getInfluencerHandle(record.influencer_id)}</td>
                                <td className="py-2.5 px-4 text-sm">{formatCurrency(record.valor_pago)}</td>
                                <td className="py-2.5 px-4 text-sm">
                                  {record.faturamento !== null ? (
                                    formatCurrency(record.faturamento)
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">pendente</span>
                                  )}
                                </td>
                                <td className={`py-2.5 px-4 text-sm font-medium ${lucro > 0 ? "text-emerald-700" : lucro < 0 ? "text-red-600" : ""}`}>
                                  {record.faturamento !== null ? formatCurrency(lucro) : "—"}
                                </td>
                                <td className={`py-2.5 px-4 text-sm font-medium ${accumulated >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                  {formatCurrency(accumulated)}
                                </td>
                                <td className="py-2.5 px-4">
                                  <WorkflowStatusDropdown
                                    value={record.status}
                                    onChange={(val) => handleStatusChange(record.id, val)}
                                  />
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <button
                                    onClick={() => handleViewComprovante(record.comprovante_url)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    title="Ver comprovante"
                                  >
                                    <Paperclip className="h-4 w-4" />
                                  </button>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditRecord(record)}>
                                      Editar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleRenovar(record)}
                                      disabled={renewingId === record.influencer_id}
                                    >
                                      {renewingId === record.influencer_id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="mr-1 h-3 w-3" />
                                          Renovar
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Red + button: add row to this day — always clickable */}
                    <div className="px-4 py-2 border-t border-border/30">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openNewRecord(day)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Adicionar registro
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Blue + button: add new day */}
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
                <Label>{editRecord ? "Substituir Comprovante" : "Comprovante de Pagamento *"}</Label>
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            {(editRecord || modalAvailableInfluencers.length > 0) && (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editRecord ? "Salvar" : "Registrar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
