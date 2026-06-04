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
import { Loader2, ListChecks, DollarSign, TrendingUp, TrendingDown, Receipt, Percent, Mail, Wallet } from "lucide-react";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { toast } from "sonner";
import SharedPartnersPopover, { type SharedPartner } from "./SharedPartnersPopover";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { cn } from "@/lib/utils";

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
    const saldo = resultado - comissao;
    return { faturado, fee, resultado, comissao, saldo };
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
      <section className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#676767]">
              <ListChecks className="h-3.5 w-3.5" />
              Monthly List
            </div>
            <div>
              <h2 className="text-[34px] font-medium tracking-[-0.06em] text-foreground sm:text-[42px]">
                {monthOptions.find((o) => o.value === selectedMonth)?.label || "Lista do mês"}
              </h2>
              <p className="mt-2 text-[14px] text-[#6e6e73]">
                Leitura consolidada por influenciador com plataformas, faturamento, taxa e comissão.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {!externalMonth && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-11 w-full rounded-full border-[#ececeb] bg-white px-4 text-sm shadow-none md:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {currentCloser && (
                <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                  Comissão atual: <span className="ml-1 text-[#1f1f1f]">{currentPercentage}%</span>
                </div>
              )}

              {!closerId && isAdmin && closers.length > 1 && (
                <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                  <SelectTrigger className="h-11 w-full rounded-full border-[#ececeb] bg-white px-4 text-sm shadow-none md:w-[210px]">
                    <SelectValue placeholder="Selecionar closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {closers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[28px] bg-white py-20 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[28px] bg-white py-20 text-center text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
          <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum influenciador registrado neste mês.</p>
        </div>
      ) : (
        <>
          {!hideThermometer && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Termômetro</div>
                    <div className="mt-1 text-[28px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Performance do mês</div>
                  </div>
                  <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                    {rows.length} influenciadores
                  </div>
                </div>
                <UnifiedThermometerWidget resultado={summary.resultado} month={selectedMonth} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard label="Faturamento" value={summary.faturado} icon={TrendingUp} />
                <SummaryCard label="Investido" value={investido} icon={DollarSign} />
                <SummaryCard label={feeLabel} value={summary.fee} icon={Percent} variant="muted" />
                <SummaryCard
                  label="Resultado"
                  value={summary.resultado}
                  icon={summary.resultado >= 0 ? TrendingUp : TrendingDown}
                  variant={summary.resultado > 0 ? (investido > 0 && summary.resultado / investido >= 0.3 ? "positive" : "warning") : "negative"}
                />
                <SummaryCard label="Comissão" value={summary.comissao} icon={Receipt} />
                <SummaryCard
                  label="Saldo Final"
                  value={summary.saldo}
                  icon={Wallet}
                  variant={summary.saldo >= 0 ? "positive" : "negative"}
                />
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <div className="mb-3 flex items-center justify-between px-2 pt-2">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Distribuição mensal</div>
                <div className="mt-1 text-[24px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Influenciadores do mês</div>
              </div>
              <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                {rows.length} linhas
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-5 text-left text-[12px] font-medium text-[#6e6e6e] whitespace-nowrap">
                      Influenciador
                    </th>
                    {[
                      { field: "platform_1_name", val: platforms.platform_1_name },
                      { field: "platform_2_name", val: platforms.platform_2_name },
                      { field: "platform_3_name", val: platforms.platform_3_name },
                    ].map((p) => (
                      <th key={p.field} className="px-3 py-5 text-center text-[12px] font-medium text-[#6e6e6e] min-w-[180px]">
                        <EditableHeader
                          value={p.val}
                          onChange={(v) => updatePlatformName(p.field, v)}
                        />
                      </th>
                    ))}
                    <th className="px-4 py-5 text-right text-[12px] font-medium text-[#6e6e6e] whitespace-nowrap">
                      Valor total
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">
                      Obs
                    </th>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-5">
                      <div className="border-b border-dashed border-[#e6ddb0]" />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={idx % 2 === 1 ? "bg-[#fbfbf8]" : "bg-white"}
                    >
                      <td className="px-5 py-4 text-[13px] font-medium text-[#1f1f1f] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.influencer_handle}
                          {sharedInfluencerMap.has(row.influencer_id) && (() => {
                            const entries = sharedInfluencerMap.get(row.influencer_id)!;
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
                      <CasaCell
                        valor={row.casa_1_valor}
                        email={row.casa_1_email}
                        onValorChange={(v) => updateField(row.id, "casa_1_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_1_email", v)}
                      />
                      <CasaCell
                        valor={row.casa_2_valor}
                        email={row.casa_2_email}
                        onValorChange={(v) => updateField(row.id, "casa_2_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_2_email", v)}
                      />
                      <CasaCell
                        valor={row.casa_3_valor}
                        email={row.casa_3_email}
                        onValorChange={(v) => updateField(row.id, "casa_3_valor", v)}
                        onEmailChange={(v) => updateField(row.id, "casa_3_email", v)}
                      />
                      <td className="px-4 py-4 text-right text-[13px] tabular-nums font-medium text-[#1f1f1f] whitespace-nowrap">
                        {formatBRL(row.valor_total)}
                      </td>
                      <EditableTextCell
                        value={row.observacoes}
                        onChange={(v) => updateField(row.id, "observacoes", v)}
                        placeholder="—"
                      />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ececeb] bg-[#f5f5f2] font-semibold text-foreground">
                    <td className="px-5 py-4 text-[13px]" colSpan={4}>
                      Total do mês
                    </td>
                    <td className="px-4 py-4 text-right text-[13px] tabular-nums">
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
  variant?: "default" | "positive" | "negative" | "warning" | "muted";
}) {
  const colorMap = {
    default: "text-[#1f1f1f]",
    positive: "text-emerald-700",
    negative: "text-red-600",
    warning: "text-amber-700",
    muted: "text-[#7b7b78]",
  };

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#f3f3ef] text-[#6e6e73]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[13px] font-medium text-[#7b7b78]">{label}</span>
      </div>
      <p className={cn("mt-4 text-[20px] font-semibold tracking-[-0.04em] tabular-nums", colorMap[variant])}>
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
      className="w-full rounded-full border border-transparent bg-transparent px-2 py-1 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#6e6e6e] outline-none transition-colors focus:border-[#e5e5e1] focus:bg-white"
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
      className="h-10 w-full rounded-[16px] border-[#ececeb] bg-white px-3 text-right text-[13px] tabular-nums shadow-none"
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
    <td className="px-3 py-4 align-top">
      <div className="flex flex-col gap-2">
        <CurrencyInput value={valor} onChange={onValorChange} />
        <div className="flex items-center gap-2 rounded-[14px] border border-[#efefeb] bg-[#fbfbf8] px-2.5 py-2">
          <Mail className="h-3.5 w-3.5 text-[#9a9a96] shrink-0" />
          <input
            className="h-5 w-full bg-transparent text-[11px] text-[#6f6f6b] outline-none transition-colors placeholder:text-[#b5b5af] focus:text-[#1f1f1f]"
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
    <td className="px-4 py-4 align-top">
      <Input
        className="h-10 min-w-[140px] rounded-[16px] border-[#ececeb] bg-white px-3 text-[13px] shadow-none"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
      />
    </td>
  );
}
