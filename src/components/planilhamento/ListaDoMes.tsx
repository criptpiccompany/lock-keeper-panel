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
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import SharedPartnersPopover, { type SharedPartner } from "./SharedPartnersPopover";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { DAILY_FEE_LABEL, DAILY_FEE_RATE } from "@/lib/constants";

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

function formatSheetAmount(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeHandle(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").split(/[/?#]/)[0];
  if (!trimmed) return "";
  return `@${trimmed.replace(/^@+/, "").toLowerCase()}`;
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
  platform_1_name: "Link 1",
  platform_2_name: "Link 2",
  platform_3_name: "Link 3",
};

function normalizePlatformName(value: string | null | undefined, index: number): string {
  if (!value || /^Casa \/ Plataforma \d$/i.test(value.trim())) return `Link ${index}`;
  return value;
}

/* ───── main component ───── */

export default function ListaDoMes({ closerId, externalMonth }: { closerId?: string; hideThermometer?: boolean; externalMonth?: string }) {
  const { user, isAdmin } = useAuth();
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

  /* ── load data + Realtime sync ── */
  useEffect(() => {
    if (!selectedCloserId || !selectedMonth) return;

    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const loadData = async () => {
      setLoading(true);

      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, "0")}`;

      // Parallel: daily records (for investido + influencer sync), platform names, existing list
      const [dailyRes, platformRes, existingRes, betaRes] = await Promise.all([
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
        supabase
          .from("planilha_beta")
          .select("influenciador, diaria_cents, faturamento_cents")
          .eq("closer_id", selectedCloserId)
          .eq("year", Number(year))
          .eq("month", Number(month)),
      ]);

      if (!active) return;

      // O Diário novo é a fonte de verdade financeira desta visualização.
      const dailyRecords = (dailyRes.data || []) as any[];
      const betaRows = (betaRes.data || []) as Array<{ influenciador: string | null; diaria_cents: number; faturamento_cents: number }>;
      const totalInvestido = betaRows.reduce((sum, row) => sum + (Number(row.diaria_cents) || 0), 0) / 100;
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
      if (!active) return;
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
          platform_1_name: normalizePlatformName(platformRes.data.platform_1_name, 1),
          platform_2_name: normalizePlatformName(platformRes.data.platform_2_name, 2),
          platform_3_name: normalizePlatformName(platformRes.data.platform_3_name, 3),
        });
      } else {
        setPlatforms({ ...DEFAULT_PLATFORMS });
      }

      // Lista única e alfabética derivada dos nomes efetivamente lançados no Diário.
      const uniqueHandles = [...new Set(
        betaRows
          .map((row) => normalizeHandle(row.influenciador || ""))
          .filter(Boolean),
      )].sort((a, b) => a.localeCompare(b, "pt-BR"));

      if (uniqueHandles.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, handle")
        .in("handle", uniqueHandles);

      if (!active) return;
      const influencerByHandle = new Map((influencers || []).map((influencer) => [normalizeHandle(influencer.handle), influencer]));
      const uniqueInfluencers = uniqueHandles
        .map((handle) => influencerByHandle.get(handle))
        .filter((influencer): influencer is { id: string; handle: string } => Boolean(influencer));
      const uniqueInfluencerIds = uniqueInfluencers.map((influencer) => influencer.id);
      const existingMap = new Map((existingRes.data || []).map((r: any) => [r.influencer_id, r]));

      const toInsert: any[] = [];
      for (const influencer of uniqueInfluencers) {
        if (!existingMap.has(influencer.id)) {
          toInsert.push({
            month: selectedMonth,
            closer_id: selectedCloserId,
            influencer_id: influencer.id,
            influencer_handle: influencer.handle,
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
        .in("influencer_id", uniqueInfluencerIds)
        .order("influencer_handle", { ascending: true });

      if (!active) return;
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

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (active) loadData();
      }, 400);
    };

    const channel = supabase
      .channel(`lista-mes-${selectedCloserId}-${selectedMonth}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_influencer_records",
          filter: `closer_id=eq.${selectedCloserId}`,
        },
        scheduleReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planilha_beta",
          filter: `closer_id=eq.${selectedCloserId}`,
        },
        scheduleReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_influencer_list",
          filter: `closer_id=eq.${selectedCloserId}`,
        },
        scheduleReload
      )
      .subscribe();

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedCloserId, selectedMonth]);


  /* ── computed summary ── */
  // Intermediate resultado for tier calculation
  const rawFaturado = rows.reduce((sum, r) => sum + r.valor_total, 0);
  const rawFee = rawFaturado * DAILY_FEE_RATE;
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
    <div className="min-h-screen bg-white pb-10">
      <div className="flex h-[72px] items-center justify-end gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
        {!externalMonth && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4 text-sm shadow-sm sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!closerId && isAdmin && closers.length > 1 && (
          <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="h-11 w-full rounded-2xl border-border bg-background px-4 text-sm shadow-sm sm:w-[220px]">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((closer) => (
                <SelectItem key={closer.id} value={closer.id}>{closer.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <section
        className="relative mx-[26px] w-[calc(100%-52px)] overflow-hidden rounded-2xl border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] font-[Poppins] shadow-sm"
        style={{
          "--sheet-title": "#000000",
          "--sheet-cell": "#ffffff",
          "--sheet-grid": "#c4c7c5",
          "--sheet-header": "#1f9d55",
          "--sheet-result-header": "#fbbc04",
          "--sheet-result-positive": "#b7e1cd",
          "--sheet-result-negative": "#f4c7c3",
          "--sheet-calculated": "#f1f2f1",
          "--sheet-alert": "#ea4335",
        } as React.CSSProperties}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/75 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="w-full overflow-hidden">
          <div className="grid w-full grid-cols-1 items-start gap-4 p-0">
            <table className="order-2 w-full table-fixed self-start border-collapse font-[Poppins]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[21%]" />
              </colgroup>
              <thead>
                <tr className="h-[58px] text-[15px] font-extrabold uppercase text-white xl:text-[16px]">
                  <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-title)] px-3">Influenciadores</th>
                  {[
                    { field: "platform_1_name", value: platforms.platform_1_name },
                    { field: "platform_2_name", value: platforms.platform_2_name },
                    { field: "platform_3_name", value: platforms.platform_3_name },
                  ].map((platform) => (
                    <th key={platform.field} className="overflow-hidden border border-[var(--sheet-grid)] bg-[var(--sheet-header)] px-2">
                      <EditableHeader value={platform.value} onChange={(value) => updatePlatformName(platform.field, value)} />
                    </th>
                  ))}
                  <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-header)] px-1 text-black">Valor total</th>
                </tr>
                <tr className="h-[28px] bg-[var(--sheet-header)] text-[9px] font-extrabold uppercase text-white xl:text-[10px]">
                  <th className="border border-[var(--sheet-grid)]">Nomes</th>
                  <th className="border border-[var(--sheet-grid)]">Valor link 1</th>
                  <th className="border border-[var(--sheet-grid)]">Valor link 2</th>
                  <th className="border border-[var(--sheet-grid)]">Valor link 3</th>
                  <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-alert)] px-1 text-[8px] leading-tight xl:text-[9px]">Calculado automaticamente</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr className="h-[54px]">
                    <td colSpan={5} className="border border-[var(--sheet-grid)] text-center text-[14px] text-muted-foreground">
                      Nenhum influenciador fechado neste mês.
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="h-[38px] max-h-[38px] text-[12px] xl:text-[13px]">
                    <td className="overflow-hidden border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-1 font-semibold text-black">
                      <div className="flex items-center justify-center gap-2">
                        <span>@{row.influencer_handle.replace(/^@/, "")}</span>
                        {sharedInfluencerMap.has(row.influencer_id) && (() => {
                          const entries = sharedInfluencerMap.get(row.influencer_id)!;
                          return <SharedPartnersPopover partners={entries.flatMap((entry) => entry.partners)} sharedNote={entries.find((entry) => entry.note)?.note || null} compact />;
                        })()}
                      </div>
                    </td>
                    <CasaCell valor={row.casa_1_valor} email={row.casa_1_email} onValorChange={(value) => updateField(row.id, "casa_1_valor", value)} onEmailChange={(value) => updateField(row.id, "casa_1_email", value)} />
                    <CasaCell valor={row.casa_2_valor} email={row.casa_2_email} onValorChange={(value) => updateField(row.id, "casa_2_valor", value)} onEmailChange={(value) => updateField(row.id, "casa_2_email", value)} />
                    <CasaCell valor={row.casa_3_valor} email={row.casa_3_email} onValorChange={(value) => updateField(row.id, "casa_3_valor", value)} onEmailChange={(value) => updateField(row.id, "casa_3_email", value)} />
                    <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-calculated)] px-1 text-center font-medium tabular-nums text-black">{formatSheetAmount(row.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-[38px] text-[13px] font-extrabold">
                  <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] text-center" colSpan={4}>TOTAL DO MÊS</td>
                  <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-positive)] text-center tabular-nums">{formatSheetAmount(summary.faturado)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="order-1 min-w-0 overflow-hidden">
              <div className="flex h-[72px] items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-title)] text-[36px] font-extrabold tracking-[-0.02em] text-white">TOTAL</div>
              <div className="grid grid-cols-5">
                {["Faturamento", "Gastos", DAILY_FEE_LABEL, "Balanço geral", `Comissão (${tierLoading ? "—" : `${currentPercentage}%`})`].map((label) => (
                  <div key={label} className="flex h-[64px] min-w-0 items-center justify-center border border-[var(--sheet-grid)] bg-[var(--sheet-header)] px-2 text-center text-[16px] font-extrabold uppercase leading-tight text-white xl:text-[18px]">{label}</div>
                ))}
                <SummaryValue value={summary.faturado} tone="positive" />
                <SummaryValue value={investido} tone="negative" />
                <SummaryValue value={summary.fee} />
                <SummaryValue value={summary.resultado} />
                <SummaryValue value={summary.comissao} />
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

/* ───── sub-components ───── */

function SummaryValue({ value, tone }: { value: number; tone?: "positive" | "negative" }) {
  return (
    <div
      className={`flex h-[70px] min-w-0 items-center justify-center overflow-hidden border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-2 text-[21px] font-semibold tabular-nums tracking-[-0.02em] xl:text-[25px] ${
        tone === "positive" ? "text-[var(--sheet-header)]" : tone === "negative" ? "text-[var(--sheet-alert)]" : "text-black"
      }`}
    >
      {formatSheetAmount(value)}
    </div>
  );
}

function EditableHeader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      className="w-full border-0 bg-transparent px-0.5 text-center text-[13px] font-extrabold uppercase text-white outline-none placeholder:text-white/70 xl:text-[14px]"
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
    <input
      className="h-[21px] w-full border-0 bg-transparent px-0.5 text-center text-[11px] tabular-nums text-black outline-none focus:bg-[var(--sheet-focus,#e8f0fe)] xl:text-[12px]"
      inputMode="numeric"
      value={display}
      placeholder=""
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
  const [showEmail, setShowEmail] = useState(Boolean(email));
  useEffect(() => { setLocalEmail(email); }, [email]);

  return (
    <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0 align-middle">
      <div className="relative flex h-[37px] flex-col justify-center">
        <CurrencyInput value={valor} onChange={onValorChange} />
        {showEmail || localEmail ? (
          <div className="flex h-[16px] items-center gap-1 border-t border-[var(--sheet-grid)] px-1">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              autoFocus={!email}
              className="h-full w-full bg-transparent text-[9px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
              value={localEmail}
              placeholder="e-mail do link"
              onChange={(event) => setLocalEmail(event.target.value)}
              onBlur={() => {
                if (localEmail !== email) onEmailChange(localEmail);
                if (!localEmail) setShowEmail(false);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="absolute bottom-1 right-1 inline-flex h-4 w-4 items-center justify-center text-muted-foreground/50 hover:text-muted-foreground"
            title="Adicionar e-mail do link"
            onClick={() => setShowEmail(true)}
          >
            <Mail className="h-3 w-3" />
          </button>
        )}
      </div>
    </td>
  );
}
