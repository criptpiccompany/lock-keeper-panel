import { Clock, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDelta, TAX_DEV, TAX_GATEWAY, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  todayData: DayAggregate;
  yesterdayData: DayAggregate;
  dayBeforeData: DayAggregate;
}

export default function FinanceiroDetailBlocks({ todayData, yesterdayData, dayBeforeData }: Props) {
  const tHasRevenue = todayData.revenue > 0;
  const tTaxDev = todayData.revenue * TAX_DEV;
  const tTaxGw = todayData.revenue * TAX_GATEWAY;
  const tTaxTotal = todayData.revenue * TAX_TOTAL;
  const tNet = todayData.revenue - tTaxTotal;
  const tMargin = todayData.revenue > 0 ? (tNet / todayData.revenue) * 100 : 0;

  const yTaxDev = yesterdayData.revenue * TAX_DEV;
  const yTaxGw = yesterdayData.revenue * TAX_GATEWAY;
  const yTaxTotal = yesterdayData.revenue * TAX_TOTAL;
  const yNet = yesterdayData.revenue - yTaxTotal;
  const yMargin = yesterdayData.revenue > 0 ? (yNet / yesterdayData.revenue) * 100 : 0;

  // Day before yesterday for delta
  const dbTaxTotal = dayBeforeData.revenue * TAX_TOTAL;
  const dbNet = dayBeforeData.revenue - dbTaxTotal;

  const deltaCost = formatDelta(todayData.cost, yesterdayData.cost);
  const deltaRev = tHasRevenue ? formatDelta(todayData.revenue, yesterdayData.revenue) : null;
  const deltaNet = tHasRevenue ? formatDelta(tNet, yNet) : null;

  // Delta for yesterday vs day before
  const yDeltaNet = formatDelta(yNet, dbNet);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* TODAY */}
      <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Clock className="h-4 w-4 text-amber-600" />
            Hoje
          </div>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">PARCIAL</span>
        </div>
        <div className="space-y-1.5 text-sm">
          <Row label="Custo operacional" value={formatBRL(todayData.cost)} delta={deltaCost} />
          <Row label="Faturamento bruto" value={tHasRevenue ? formatBRL(todayData.revenue) : "Aguardando"} muted={!tHasRevenue} delta={deltaRev} />
          <Row label="Taxa dev (2%)" value={tHasRevenue ? formatBRL(tTaxDev) : "—"} muted />
          <Row label="Taxa gateway (3%)" value={tHasRevenue ? formatBRL(tTaxGw) : "—"} muted />
          <Row label="Taxas totais (5%)" value={tHasRevenue ? formatBRL(tTaxTotal) : "—"} muted />
          <div className="border-t border-border/30 pt-1.5">
            <Row label="Resultado líquido" value={tHasRevenue ? formatBRL(tNet) : "—"} highlight={tHasRevenue ? (tNet >= 0 ? "positive" : "negative") : undefined} delta={deltaNet} />
            <Row label="Margem" value={tHasRevenue ? `${tMargin.toFixed(1)}%` : "—"} highlight={tHasRevenue ? (tMargin >= 0 ? "positive" : "negative") : undefined} />
          </div>
        </div>
      </div>

      {/* YESTERDAY */}
      <div className="rounded-xl border border-border/40 bg-muted/30 p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Ontem
            </div>
            <span className="text-[10px] text-muted-foreground ml-6">Base para decisões</span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">FECHADO</span>
        </div>
        <div className="space-y-1.5 text-sm">
          <Row label="Custo operacional" value={formatBRL(yesterdayData.cost)} />
          <Row label="Faturamento bruto" value={formatBRL(yesterdayData.revenue)} />
          <Row label="Taxa dev (2%)" value={formatBRL(yTaxDev)} muted />
          <Row label="Taxa gateway (3%)" value={formatBRL(yTaxGw)} muted />
          <Row label="Taxas totais (5%)" value={formatBRL(yTaxTotal)} muted />
          <div className="border-t border-border/30 pt-1.5">
            <Row label="Resultado líquido" value={formatBRL(yNet)} highlight={yNet >= 0 ? "positive" : "negative"} delta={yDeltaNet} deltaLabel="vs dia anterior" />
            <Row label="Margem" value={`${yMargin.toFixed(1)}%`} highlight={yMargin >= 0 ? "positive" : "negative"} />
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
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: "positive" | "negative";
  delta?: { text: string; positive: boolean | null } | null;
  deltaLabel?: string;
}) {
  const valCls = highlight === "positive"
    ? "text-emerald-700 font-semibold"
    : highlight === "negative"
    ? "text-red-600 font-semibold"
    : muted
    ? "text-muted-foreground"
    : "font-medium";

  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`tabular-nums ${valCls}`}>{value}</span>
        {delta && delta.positive !== null && (
          <span className={`text-[10px] tabular-nums font-medium ${delta.positive ? "text-emerald-600" : "text-red-500"}`}>
            {delta.positive ? "▲" : "▼"} {delta.text}{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
