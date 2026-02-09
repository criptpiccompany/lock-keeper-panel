import { useState, useEffect, useMemo } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/helpers";
import {
  Loader2,
  Plus,
  FileText,
  Upload,
  RefreshCw,
  Eye,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Paperclip,
} from "lucide-react";

interface DailyRecord {
  id: string;
  date: string;
  influencer_id: string;
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
  comprovante_url: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

interface InfluencerOption {
  id: string;
  handle: string;
  last_closed_at: string | null;
}

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
  const lucro = calcLucroLiquido(faturamento, valorPago);
  return lucro / valorPago;
}

function getStatusResultado(faturamento: number | null, valorPago: number): StatusResultado {
  if (!faturamento) return null;
  const margem = calcMargem(faturamento, valorPago);
  if (margem === null) return null;
  if (margem >= 0.30) return "VERDE";
  if (margem > 0) return "AMARELO";
  return "VERMELHO";
}

function StatusChip({ status }: { status: StatusResultado }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const config = {
    VERDE: { label: "Lucro", className: "bg-emerald-50 text-emerald-700 border-emerald-200/50" },
    AMARELO: { label: "Margem baixa", className: "bg-amber-50 text-amber-700 border-amber-200/50" },
    VERMELHO: { label: "Prejuízo", className: "bg-red-50 text-red-700 border-red-200/50" },
  };
  const c = config[status];
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(val: number | null): string {
  if (val === null) return "—";
  return (val * 100).toFixed(1) + "%";
}

export default function RegistroDiario() {
  const { user, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DailyRecord | null>(null);
  const [viewingComprovante, setViewingComprovante] = useState<string | null>(null);

  // Form state
  const [formInfluencerId, setFormInfluencerId] = useState("");
  const [formValorPago, setFormValorPago] = useState("");
  const [formFaturamento, setFormFaturamento] = useState("");
  const [formObservacao, setFormObservacao] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch records for selected date
    let recordsQuery = supabase
      .from("daily_influencer_records")
      .select("*")
      .eq("date", selectedDate)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      recordsQuery = recordsQuery.eq("closer_id", user.id);
    }

    const { data: recordsData } = await recordsQuery;

    // Fetch user's influencers
    let infQuery = supabase.from("influencers").select("id, handle, last_closed_at").eq("ativo", true);
    if (!isAdmin) {
      infQuery = infQuery.eq("owner_id", user.id);
    }
    const { data: infData } = await infQuery;

    setRecords((recordsData as DailyRecord[]) || []);
    setInfluencers(infData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedDate]);

  const getInfluencerHandle = (id: string) => {
    return influencers.find((i) => i.id === id)?.handle || id;
  };

  // Records already registered today for these influencers
  const registeredInfluencerIds = new Set(records.map((r) => r.influencer_id));
  const availableInfluencers = influencers.filter((i) => !registeredInfluencerIds.has(i.id));

  const openNewRecord = () => {
    setEditRecord(null);
    setFormInfluencerId("");
    setFormValorPago("");
    setFormFaturamento("");
    setFormObservacao("");
    setFormFile(null);
    setModalOpen(true);
  };

  const openEditRecord = (record: DailyRecord) => {
    setEditRecord(record);
    setFormInfluencerId(record.influencer_id);
    setFormValorPago(String(record.valor_pago));
    setFormFaturamento(record.faturamento !== null ? String(record.faturamento) : "");
    setFormObservacao(record.observacao || "");
    setFormFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
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

      // Upload file if provided
      if (formFile) {
        const ext = formFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes")
          .upload(path, formFile);

        if (uploadError) {
          toast.error("Erro no upload do comprovante", { description: uploadError.message });
          setSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        comprovanteUrl = urlData.publicUrl;
      }

      const payload: any = {
        valor_pago: Number(formValorPago),
        faturamento: formFaturamento ? Number(formFaturamento) : null,
        observacao: formObservacao || null,
      };

      if (editRecord) {
        // Update
        if (formFile) payload.comprovante_url = comprovanteUrl;

        const { error } = await supabase
          .from("daily_influencer_records")
          .update(payload)
          .eq("id", editRecord.id);

        if (error) throw error;
        toast.success("Registro atualizado!");
      } else {
        // Insert
        payload.date = selectedDate;
        payload.influencer_id = formInfluencerId;
        payload.closer_id = user.id;
        payload.comprovante_url = comprovanteUrl;

        const { error } = await supabase
          .from("daily_influencer_records")
          .insert(payload);

        if (error) throw error;
        toast.success("Registro criado!");
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenovar = async (record: DailyRecord) => {
    if (!user) return;

    // Check if already renewed today
    const { data: existingEvents } = await supabase
      .from("close_events")
      .select("id")
      .eq("influencer_id", record.influencer_id)
      .eq("feito_por_id", user.id)
      .gte("feito_em", new Date().toISOString().split("T")[0] + "T00:00:00Z");

    if (existingEvents && existingEvents.length > 0) {
      toast.error("Já renovado hoje", { description: "Só é possível renovar uma vez por dia por influenciador." });
      return;
    }

    setRenewingId(record.influencer_id);

    const now = new Date().toISOString();
    const handle = getInfluencerHandle(record.influencer_id);

    // Update influencer
    const { error: updateError } = await supabase
      .from("influencers")
      .update({ last_closed_at: now, owner_id: user.id, owner_nome: user.nome })
      .eq("id", record.influencer_id);

    if (updateError) {
      toast.error("Erro ao renovar");
      setRenewingId(null);
      return;
    }

    // Create audit event
    await supabase.from("close_events").insert({
      influencer_id: record.influencer_id,
      influencer_handle: handle,
      feito_por_id: user.id,
      feito_por_nome: user.nome,
      feito_em: now,
      acao: "FECHAMENTO",
      motivo: "Renovação via registro diário",
    });

    toast.success("Renovado!", { description: `${handle} renovado por +10 dias.` });
    setRenewingId(null);
    fetchData();
  };

  const handleViewComprovante = async (url: string) => {
    // For private buckets, generate a signed URL
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

  // Day totals
  const totals = useMemo(() => {
    const totalInvestido = records.reduce((sum, r) => sum + Number(r.valor_pago), 0);
    const totalFaturado = records.reduce((sum, r) => sum + (Number(r.faturamento) || 0), 0);
    const totalTaxa = calcTaxaPlataforma(totalFaturado);
    const resultadoLiquido = totalFaturado - totalInvestido - totalTaxa;
    return { totalInvestido, totalFaturado, totalTaxa, resultadoLiquido };
  }, [records]);

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
      <div className="border-b">
        <div className="container py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Registro Diário
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Registre pagamentos, faturamento e comprovantes diários
              </p>
            </div>
            <Button onClick={openNewRecord} disabled={availableInfluencers.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Registro
            </Button>
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {records.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-state-icon" />
            <h3 className="empty-state-title">Nenhum registro para esta data</h3>
            <p className="empty-state-description mb-4">
              Clique em "Novo Registro" para adicionar.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border">
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th>Influenciador</th>
                    <th>Valor Pago</th>
                    <th>Faturamento</th>
                    <th>Taxa (10%)</th>
                    <th>Lucro</th>
                    <th>Margem</th>
                    <th>Status</th>
                    <th>📎</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const taxa = calcTaxaPlataforma(record.faturamento);
                    const lucro = calcLucroLiquido(record.faturamento, record.valor_pago);
                    const margem = calcMargem(record.faturamento, record.valor_pago);
                    const status = getStatusResultado(record.faturamento, record.valor_pago);

                    return (
                      <tr key={record.id}>
                        <td className="font-medium">{getInfluencerHandle(record.influencer_id)}</td>
                        <td className="text-sm">{formatCurrency(record.valor_pago)}</td>
                        <td className="text-sm">{record.faturamento !== null ? formatCurrency(record.faturamento) : <span className="text-muted-foreground italic">pendente</span>}</td>
                        <td className="text-sm text-muted-foreground">{record.faturamento !== null ? formatCurrency(taxa) : "—"}</td>
                        <td className={`text-sm font-medium ${lucro > 0 ? "text-emerald-700" : lucro < 0 ? "text-red-600" : ""}`}>
                          {record.faturamento !== null ? formatCurrency(lucro) : "—"}
                        </td>
                        <td className="text-sm">{formatPercent(margem)}</td>
                        <td><StatusChip status={status} /></td>
                        <td>
                          <button
                            onClick={() => handleViewComprovante(record.comprovante_url)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver comprovante"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditRecord(record)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRenovar(record)}
                              disabled={renewingId === record.influencer_id}
                            >
                              {renewingId === record.influencer_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                  Renovar
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Day totals */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Investido</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalInvestido)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Faturado</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalFaturado)}</p>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Taxa (10%)</p>
                <p className="text-lg font-semibold text-muted-foreground">{formatCurrency(totals.totalTaxa)}</p>
              </div>
              <div className={`rounded-xl border p-4 ${totals.resultadoLiquido >= 0 ? "bg-emerald-50 border-emerald-200/50" : "bg-red-50 border-red-200/50"}`}>
                <p className="text-xs uppercase tracking-wider mb-1 text-muted-foreground">Resultado Líquido</p>
                <p className={`text-lg font-semibold ${totals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatCurrency(totals.resultadoLiquido)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New/Edit Record Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editRecord ? "Editar Registro" : "Novo Registro Diário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Influencer select (only on create) */}
            {!editRecord && (
              <div className="space-y-2">
                <Label>Influenciador</Label>
                <Select value={formInfluencerId} onValueChange={setFormInfluencerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInfluencers.map((inf) => (
                      <SelectItem key={inf.id} value={inf.id}>
                        {inf.handle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editRecord && (
              <div className="text-sm text-muted-foreground">
                Influenciador: <strong>{getInfluencerHandle(editRecord.influencer_id)}</strong>
              </div>
            )}

            {/* Valor Pago */}
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

            {/* Faturamento */}
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

            {/* Preview calculado */}
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
                  <StatusChip status={getStatusResultado(Number(formFaturamento), Number(formValorPago))} />
                </div>
              </div>
            )}

            {/* Comprovante Upload */}
            <div className="space-y-2">
              <Label>{editRecord ? "Substituir Comprovante" : "Comprovante de Pagamento *"}</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
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
            </div>

            {/* Observação */}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editRecord ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
