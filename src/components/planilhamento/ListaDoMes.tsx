import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ListChecks, DollarSign, TrendingUp, TrendingDown, Receipt, Percent, Mail } from "lucide-react";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { toast } from "sonner";
import SharedPartnersPopover, { type SharedPartner } from "./SharedPartnersPopover";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { getEstimatedCommission } from "@/lib/commissionCalc";

/* ───── types ───── */

interface ListRow {
  id: string;
  influencer_id: string;
  influencer_handle: string;
  casa_1_valor: number;
  casa_1_email: string;
  casa_2_valor: number;
  casa_2_email: string;
  casa_3_valor: number;
  casa_3_email: string;
  valor_total: number;
  observacoes: string;
}

interface PlatformNames {
  id?: string;
  platform_1_name: string;
  platform_2_name: string;
  platform_3_name: string;
}

interface CloserProfile {
  id: string;
  nome: string;
  commission_rate: number;
}

/* ───── helpers ───── */

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

const DEFAULT_PLATFORMS: PlatformNames = {
  platform_1_name: "Casa / Plataforma 1",
  platform_2_name: "Casa / Plataforma 2",
  platform_3_name: "Casa / Plataforma 3",
};

/* ───── main component ───── */

export default function ListaDoMes({ closerId, hideThermometer = false, externalMonth }: { closerId?: string; hideThermometer?: boolean; externalMonth?: string }) {
  const { user, isAdmin } = useAuth();
  const { feeRate, feeLabel } = useTeamFeeRate(user?.teamId);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [platforms, setPlatforms] = useState<PlatformNames>(DEFAULT_PLATFORMS);
  const [investido, setInvestido] = useState(0);
  const [sharedInfluencerMap, setSharedInfluencerMap] = useState<Map<string, { note: string | null; partners: SharedPartner[] }[]>>(new Map());
  const [internalMonth, setInternalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const selectedMonth = externalMonth || internalMonth;
  const setSelectedMonth = setInternalMonth;
  const [selectedCloserId, setSelectedCloserId] = useState<string>(closerId || "");

  const monthOptions = useMemo(() => getMonthOptions(), []);

  /* ── fetch closers ── */
  useEffect(() => {
    const fetchClosers = async () => {
      if (!user) return;
      if (closerId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .eq("id", closerId)
          .single();
        if (data) {
          setClosers([data as any as CloserProfile]);
          setSelectedCloserId(closerId);
        }
        return;
      }
      if (isAdmin) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .order("nome");
        setClosers((data as any as CloserProfile[]) || []);
        if (!selectedCloserId && data && data.length > 0) {
          setSelectedCloserId(data[0].id);
        }
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, commission_rate")
          .eq("id", user.id)
          .single();
        if (data) {
          setClosers([data as any as CloserProfile]);
          setSelectedCloserId(user.id);
        }
      }
    };
    fetchClosers();
  }, [user, isAdmin, closerId]);

  /* ── load data ── */
  useEffect(() => {
    const loadData = async () => {
      if (!selectedCloserId || !selectedMonth) return;
      setLoading(true);

      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, "0")}`;

      // Parallel: daily records (for investido + influencer sync), platform names, existing list
      const [dailyRes, platformRes, existingRes] = await Promise.all([
        supabase
          .from("daily_influencer_records")
          .select("influencer_id, valor_pago, is_shared, shared_note, id")
          .eq("closer_id", selectedCloserId)
          .gte("date", startDate)
          .lte("date", endDateStr)
          .is("deleted_at", null),
        supabase
          .from("monthly_platform_names")
          .select("*")
          .eq("closer_id", selectedCloserId)
          .eq("month", selectedMonth)
          .maybeSingle(),
        supabase
          .from("monthly_influencer_list")
          .select("*")
          .eq("closer_id", selectedCloserId)
          .eq("month", selectedMonth),
      ]);

      // Investido = sum of valor_pago from daily records
      const dailyRecords = (dailyRes.data || []) as any[];
      const totalInvestido = dailyRecords.reduce((sum: number, r: any) => sum + (Number(r.valor_pago) || 0), 0);
      setInvestido(totalInvestido);

      // Build shared influencer map
      const sharedRecords = dailyRecords.filter((r: any) => r.is_shared);
      const sharedRecordIds = sharedRecords.map((r: any) => r.id);
      let partnersData: any[] = [];
      if (sharedRecordIds.length > 0) {
        const { data } = await supabase
          .from("daily_record_shared_partners")
          .select("*")
          .in("record_id", sharedRecordIds);
        partnersData = data || [];
      }
      const partnersByRecord = new Map<string, SharedPartner[]>();
      for (const p of partnersData) {
        const list = partnersByRecord.get(p.record_id) || [];
        list.push({ id: p.id, partner_user_id: p.partner_user_id, partner_nome: p.partner_nome, share_type: p.share_type, share_amount: p.share_amount ? Number(p.share_amount) : null });
        partnersByRecord.set(p.record_id, list);
      }
      // Group by influencer_id
      const infSharedMap = new Map<string, { note: string | null; partners: SharedPartner[] }[]>();
      for (const r of sharedRecords) {
        const list = infSharedMap.get(r.influencer_id) || [];
        list.push({ note: r.shared_note || null, partners: partnersByRecord.get(r.id) || [] });
        infSharedMap.set(r.influencer_id, list);
      }
      setSharedInfluencerMap(infSharedMap);

      // Platform names
      if (platformRes.data) {
        setPlatforms({
          id: platformRes.data.id,
          platform_1_name: platformRes.data.platform_1_name || DEFAULT_PLATFORMS.platform_1_name,
          platform_2_name: platformRes.data.platform_2_name || DEFAULT_PLATFORMS.platform_2_name,
          platform_3_name: platformRes.data.platform_3_name || DEFAULT_PLATFORMS.platform_3_name,
        });
      } else {
        setPlatforms({ ...DEFAULT_PLATFORMS });
      }

      // Sync influencers
      const uniqueInfluencerIds = [...new Set(dailyRecords.map((r) => r.influencer_id))];

      if (uniqueInfluencerIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, handle")
        .in("id", uniqueInfluencerIds);

      const handleMap = new Map((influencers || []).map((i) => [i.id, i.handle]));
      const existingMap = new Map((existingRes.data || []).map((r: any) => [r.influencer_id, r]));

      const toInsert: any[] = [];
      for (const infId of uniqueInfluencerIds) {
        if (!existingMap.has(infId)) {
          toInsert.push({
            month: selectedMonth,
            closer_id: selectedCloserId,
            influencer_id: infId,
            influencer_handle: handleMap.get(infId) || "???",
          });
        }
      }

      if (toInsert.length > 0) {
        await supabase.from("monthly_influencer_list").insert(toInsert);
      }

      // Re-fetch final rows
      const { data: finalRows } = await supabase
        .from("monthly_influencer_list")
        .select("*")
        .eq("closer_id", selectedCloserId)
        .eq("month", selectedMonth)
        .order("influencer_handle", { ascending: true });

      setRows(
        (finalRows || []).map((r: any) => ({
          id: r.id,
          influencer_id: r.influencer_id,
          influencer_handle: r.influencer_handle,
          casa_1_valor: Number(r.casa_1_valor) || 0,
          casa_1_email: r.casa_1_email || "",
          casa_2_valor: Number(r.casa_2_valor) || 0,
          casa_2_email: r.casa_2_email || "",
          casa_3_valor: Number(r.casa_3_valor) || 0,
          casa_3_email: r.casa_3_email || "",
          valor_total: (Number(r.casa_1_valor) || 0) + (Number(r.casa_2_valor) || 0) + (Number(r.casa_3_valor) || 0),
          observacoes: r.observacoes || "",
        }))
      );
      setLoading(false);
    };
    loadData();
  }, [selectedCloserId, selectedMonth]);

  /* ── computed summary ── */
  const currentCloser = closers.find((c) => c.id === selectedCloserId);

  // Intermediate resultado for tier calculation
  const rawFaturado = rows.reduce((sum, r) => sum + r.valor_total, 0);
  const rawFee = rawFaturado * feeRate;
  const rawResultado = rawFaturado - investido - rawFee;

  // Use tier-based commission (same source of truth as thermometer)
  const { currentPercentage, loading: tierLoading } = useCommissionTier(rawResultado);
  const tierComissao = getEstimatedCommission(rawResultado, currentPercentage);

  const summary = useMemo(() => {
    const faturado = rawFaturado;
    const fee = rawFee;
    const resultado = rawResultado;
    const comissao = tierComissao;
    return { faturado, fee, resultado, comissao };
  }, [rawFaturado, rawFee, rawResultado, tierComissao]);

  /* ── field update ── */
  const updateField = useCallback(
    async (rowId: string, field: string, value: string | number) => {
      setRows((prev) => {
        const updated = prev.map((r) => {
          if (r.id !== rowId) return r;
          const next = { ...r, [field]: value };
          // Auto-calc valor_total
          next.valor_total = (Number(next.casa_1_valor) || 0) + (Number(next.casa_2_valor) || 0) + (Number(next.casa_3_valor) || 0);
          return next;
        });
        return updated;
      });

      const updatePayload: Record<string, any> = { [field]: value };
      const { error } = await supabase
        .from("monthly_influencer_list")
        .update(updatePayload)
        .eq("id", rowId);

      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
      }
    },
    []
  );

  /* ── platform name update ── */
  const updatePlatformName = useCallback(
    async (field: string, value: string) => {
      setPlatforms((prev) => ({ ...prev, [field]: value }));

      if (platforms.id) {
        await supabase
          .from("monthly_platform_names")
          .update({ [field]: value })
          .eq("id", platforms.id);
      } else {
        // Upsert
        const { data } = await supabase
          .from("monthly_platform_names")
          .insert({
            closer_id: selectedCloserId,
            month: selectedMonth,
            [field]: value,
          })
          .select("id")
          .single();
        if (data) {
          setPlatforms((prev) => ({ ...prev, id: data.id }));
        }
      }
    },
    [platforms.id, selectedCloserId, selectedMonth]
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        {!externalMonth && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!closerId && isAdmin && closers.length > 1 && (
          <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {currentCloser && (
          <span className="text-xs text-muted-foreground ml-auto">
            Comissão: {currentPercentage}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum influenciador registrado neste mês.</p>
        </div>
      ) : (
        <>
          {/* Two-column layout: Thermometer + Cards (same as Balanço) */}
          {!hideThermometer && (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-3">
            {/* Left: Thermometer */}
            <div className="card-premium p-5 flex items-center justify-center lg:min-h-[380px]">
              <UnifiedThermometerWidget resultado={summary.resultado} month={selectedMonth} />
            </div>

            {/* Right: Financial Cards Grid */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <SummaryCard label="Faturamento" value={summary.faturado} icon={TrendingUp} />
                <SummaryCard label="Investido" value={investido} icon={DollarSign} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SummaryCard label={feeLabel} value={summary.fee} icon={Percent} variant="muted" />
                <SummaryCard
                  label="Resultado"
                  value={summary.resultado}
                  icon={summary.resultado >= 0 ? TrendingUp : TrendingDown}
                  variant={summary.resultado >= 0 ? "positive" : "negative"}
                />
              </div>
              <SummaryCard label="Comissão" value={summary.comissao} icon={Receipt} />
            </div>
          </div>
          )}

          {/* Table */}
          <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: '#E9E9EA' }}>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase whitespace-nowrap">
                      Influenciador
                    </th>
                    {[
                      { field: "platform_1_name", val: platforms.platform_1_name },
                      { field: "platform_2_name", val: platforms.platform_2_name },
                      { field: "platform_3_name", val: platforms.platform_3_name },
                    ].map((p) => (
                      <th key={p.field} className="text-center py-1.5 px-2 font-semibold text-xs tracking-wide uppercase min-w-[160px]">
                        <EditableHeader
                          value={p.val}
                          onChange={(v) => updatePlatformName(p.field, v)}
                        />
                      </th>
                    ))}
                    <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase whitespace-nowrap">
                      Valor total
                    </th>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                      Obs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}
                    >
                      <td className="py-2 px-4 text-xs font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {row.influencer_handle}
                          {sharedInfluencerMap.has(row.influencer_id) && (() => {
                            const entries = sharedInfluencerMap.get(row.influencer_id)!;
                            // Combine all partners from all shared records
                            const allPartners = entries.flatMap((e) => e.partners);
                            const firstNote = entries.find((e) => e.note)?.note || null;
                            return (
                              <SharedPartnersPopover
                                partners={allPartners}
                                sharedNote={firstNote}
                                compact
                              />
                            );
                          })()}
                        </div>
                      </td>
                      {/* Casa 1 */}
                      <CasaCell
                        valor={row.casa_1_valor}
                        email={row.casa_1_email}
                        onValorChange={(v) => updateField(row.id, "casa_1_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_1_email", v)}
                      />
                      {/* Casa 2 */}
                      <CasaCell
                        valor={row.casa_2_valor}
                        email={row.casa_2_email}
                        onValorChange={(v) => updateField(row.id, "casa_2_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_2_email", v)}
                      />
                      {/* Casa 3 */}
                      <CasaCell
                        valor={row.casa_3_valor}
                        email={row.casa_3_email}
                        onValorChange={(v) => updateField(row.id, "casa_3_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_3_email", v)}
                      />
                      {/* Valor total (auto-calc, read-only) */}
                      <td className="py-2 px-4 text-xs text-right tabular-nums font-semibold whitespace-nowrap">
                        {formatBRL(row.valor_total)}
                      </td>
                      {/* Obs */}
                      <EditableTextCell
                        value={row.observacoes}
                        onChange={(v) => updateField(row.id, "observacoes", v)}
                        placeholder="—"
                      />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 font-semibold text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <td className="py-3 px-4 text-xs" colSpan={4}>
                      Total do mês
                    </td>
                    <td className="py-3 px-4 text-xs text-right tabular-nums">
                      {formatBRL(summary.faturado)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ───── sub-components ───── */

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: any;
  variant?: "default" | "positive" | "negative" | "muted";
}) {
  const colorMap = {
    default: "",
    positive: "text-emerald-700",
    negative: "text-red-600",
    muted: "text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${colorMap[variant]}`}>
        {formatBRL(value)}
      </p>
    </div>
  );
}

function EditableHeader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      className="w-full text-center text-xs font-semibold uppercase tracking-wide bg-transparent border-none outline-none focus:bg-white/60 focus:ring-1 focus:ring-border rounded px-1 py-0.5 transition-colors"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
    />
  );
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const formatDisplay = (cents: number): string => {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const [cents, setCents] = useState(Math.round(value * 100));
  const [display, setDisplay] = useState(value ? formatDisplay(Math.round(value * 100)) : "");

  useEffect(() => {
    const newCents = Math.round(value * 100);
    setCents(newCents);
    setDisplay(value ? formatDisplay(newCents) : "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      setCents(0);
      setDisplay("");
      return;
    }
    const newCents = parseInt(raw, 10);
    setCents(newCents);
    setDisplay(formatDisplay(newCents));
  };

  const handleBlur = () => {
    const numericValue = cents / 100;
    if (numericValue !== value) onChange(numericValue);
    if (cents === 0) setDisplay("");
  };

  return (
    <Input
      className="h-7 text-xs text-right tabular-nums w-full"
      inputMode="numeric"
      value={display}
      placeholder="R$ 0,00"
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

function CasaCell({
  valor,
  email,
  onValorChange,
  onEmailChange,
}: {
  valor: number;
  email: string;
  onValorChange: (v: number) => void;
  onEmailChange: (v: string) => void;
}) {
  const [localEmail, setLocalEmail] = useState(email);
  useEffect(() => { setLocalEmail(email); }, [email]);

  return (
    <td className="py-1.5 px-2">
      <div className="flex flex-col gap-1.5">
        <CurrencyInput value={valor} onChange={onValorChange} />
        <div className="flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5">
          <Mail className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          <input
            className="h-5 text-[11px] text-foreground/70 w-full bg-transparent outline-none focus:text-foreground transition-colors placeholder:text-muted-foreground/50"
            value={localEmail}
            placeholder="email afiliado"
            onChange={(e) => setLocalEmail(e.target.value)}
            onBlur={() => { if (localEmail !== email) onEmailChange(localEmail); }}
          />
        </div>
      </div>
    </td>
  );
}

function EditableTextCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <td className="py-1.5 px-2">
      <Input
        className="h-7 text-xs w-full min-w-[100px]"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
      />
    </td>
  );
}
