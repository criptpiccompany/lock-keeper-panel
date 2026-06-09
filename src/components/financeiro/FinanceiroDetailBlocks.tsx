import { Clock, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDelta, computeNet, TAX_DEV, TAX_GATEWAY, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  currentData: DayAggregate;
  currentLabel: string;
  partial?: boolean;
  previousData: DayAggregate;
  previousLabel: string;
  previousDeltaBase?: DayAggregate | null;
  previousDeltaBaseLabel?: string;
}

export default function FinanceiroDetailBlocks({
  currentData,
  currentLabel,
  partial,
  previousData,
  previousLabel,
  previousDeltaBase,
  previousDeltaBaseLabel,
}: Props) {
  const cHasRevenue = currentData.revenue > 0;
  const cTaxDev = currentData.revenue * TAX_DEV;
  const cTaxGw = currentData.revenue * TAX_GATEWAY;
  const cTaxTotal = currentData.revenue * TAX_TOTAL;
  const cNet = computeNet(currentData.revenue, currentData.cost);
  const cMargin = currentData.revenue > 0 ? (cNet / currentData.revenue) * 100 : 0;

  const pTaxDev = previousData.revenue * TAX_DEV;
  const pTaxGw = previousData.revenue * TAX_GATEWAY;
  const pTaxTotal = previousData.revenue * TAX_TOTAL;
  const pNet = computeNet(previousData.revenue, previousData.cost);
  const pMargin = previousData.revenue > 0 ? (pNet / previousData.revenue) * 100 : 0;

  const baseNet = previousDeltaBase
    ? computeNet(previousDeltaBase.revenue, previousDeltaBase.cost)
    : null;

  const deltaCost = formatDelta(currentData.cost, previousData.cost);
  const deltaRev = cHasRevenue ? formatDelta(currentData.revenue, previousData.revenue) : null;
  const deltaNet = cHasRevenue ? formatDelta(cNet, pNet) : null;
  const pDeltaNet = baseNet != null ? formatDelta(pNet, baseNet) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CURRENT */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 sm:p-6 space-y-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-50">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-950">{currentLabel}</span>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border ${partial ? "text-amber-700 bg-amber-50 border-amber-200/60" : "text-emerald-700 bg-emerald-50 border-emerald-200/60"}`}>
            {partial ? "Parcial" : "Fechado"}
          </span>
        </div>
        <div className="space-y-1.5 text-[13px]">
          <Row label="Custo operacional" value={formatBRL(currentData.cost)} delta={deltaCost} deltaLabel={`vs ${previousLabel.toLowerCase()}`} />
          <Row label="Faturamento bruto" value={cHasRevenue ? formatBRL(currentData.revenue) : "Aguardando"} muted={!cHasRevenue} delta={deltaRev} deltaLabel={`vs ${previousLabel.toLowerCase()}`} />
          <Row label="Taxa dev (2%)" value={cHasRevenue ? formatBRL(cTaxDev) : "—"} muted />
          <Row label="Taxa gateway (3%)" value={cHasRevenue ? formatBRL(cTaxGw) : "—"} muted />
          <Row label="Taxas totais (5%)" value={cHasRevenue ? formatBRL(cTaxTotal) : "—"} muted />
          <div className="border-t border-black/5 pt-2 mt-2">
            <Row
              label="Resultado líquido"
              value={cHasRevenue ? formatBRL(cNet) : "—"}
              highlight={cHasRevenue ? (cNet >= 0 ? "positive" : "negative") : undefined}
              delta={deltaNet}
              deltaLabel={`vs ${previousLabel.toLowerCase()}`}
              tooltip="Faturamento − Custo − Taxas (5%)"
            />
            <Row label="Margem" value={cHasRevenue ? `${cMargin.toFixed(1)}%` : "—"} highlight={cHasRevenue ? (cMargin >= 0 ? "positive" : "negative") : undefined} />
          </div>
        </div>
      </div>

      {/* PREVIOUS */}
      <div className="rounded-2xl border border-emerald-200/60 bg-white p-5 sm:p-6 space-y-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-950">{previousLabel}</span>
              <span className="text-[11px] text-slate-500/90">Base para decisões</span>
            </div>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">Fechado</span>
        </div>
        <div className="space-y-1.5 text-[13px]">
          <Row label="Custo operacional" value={formatBRL(previousData.cost)} />
          <Row label="Faturamento bruto" value={formatBRL(previousData.revenue)} />
          <Row label="Taxa dev (2%)" value={formatBRL(pTaxDev)} muted />
          <Row label="Taxa gateway (3%)" value={formatBRL(pTaxGw)} muted />
          <Row label="Taxas totais (5%)" value={formatBRL(pTaxTotal)} muted />
          <div className="border-t border-black/5 pt-2 mt-2">
            <Row
              label="Resultado líquido"
              value={formatBRL(pNet)}
              highlight={pNet >= 0 ? "positive" : "negative"}
              delta={pDeltaNet}
              deltaLabel={previousDeltaBaseLabel ? `vs ${previousDeltaBaseLabel.toLowerCase()}` : undefined}
              tooltip="Faturamento − Custo − Taxas (5%)"
            />
            <Row label="Margem" value={`${pMargin.toFixed(1)}%`} highlight={pMargin >= 0 ? "positive" : "negative"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
  delta,
  deltaLabel,
  tooltip,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: "positive" | "negative";
  delta?: { text: string; positive: boolean | null } | null;
  deltaLabel?: string;
  tooltip?: string;
}) {
  const valCls = highlight === "positive"
    ? "text-emerald-700 font-semibold"
    : highlight === "negative"
    ? "text-rose-600 font-semibold"
    : muted
    ? "text-slate-500"
    : "font-medium text-slate-950";

  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-600"} title={tooltip}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`tabular-nums ${valCls}`}>{value}</span>
        {delta && delta.positive !== null && (
          <span className={`text-[10px] tabular-nums font-medium ${delta.positive ? "text-emerald-600" : "text-rose-500"}`}>
            {delta.positive ? "▲" : "▼"} {delta.text}{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
