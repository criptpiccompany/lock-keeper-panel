import { Receipt, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { formatBRL, type DayAggregate, TAX_TOTAL } from "./financeiroHelpers";

interface Props {
  todayData: DayAggregate;
  yesterdayData: DayAggregate;
}

export default function FinanceiroSummaryCards({ todayData, yesterdayData }: Props) {
  const yTaxes = yesterdayData.revenue * TAX_TOTAL;
  const yNet = yesterdayData.revenue - yTaxes;
  const yMargin = yesterdayData.revenue > 0 ? (yNet / yesterdayData.revenue) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card label="Custo Operacional Hoje" value={formatBRL(todayData.cost)} icon={Receipt} badge="PARCIAL" badgeColor="amber" />
      <Card label="Faturamento Ontem" value={formatBRL(yesterdayData.revenue)} icon={TrendingUp} badge="FECHADO" badgeColor="emerald" variant="positive" />
      <Card label="Taxas Totais Ontem (5%)" value={formatBRL(yTaxes)} icon={Percent} sub="2% dev · 3% gateway" />
      <Card
        label="Resultado Líquido Ontem"
        value={formatBRL(yNet)}
        icon={yNet >= 0 ? TrendingUp : TrendingDown}
        badge="FECHADO"
        badgeColor="emerald"
        variant={yNet >= 0 ? "positive" : "negative"}
      />
      <Card label="Margem Ontem" value={`${yMargin.toFixed(1)}%`} icon={Percent} badge="FECHADO" badgeColor="emerald" variant={yMargin >= 0 ? "positive" : "negative"} />
    </div>
  );
}

function Card({
  label,
  value,
  icon: Icon,
  sub,
  badge,
  badgeColor,
  variant = "default",
}: {
  label: string;
  value: string;
  icon: any;
  sub?: string;
  badge?: string;
  badgeColor?: "amber" | "emerald";
  variant?: "default" | "positive" | "negative";
}) {
  const colorMap = {
    default: "",
    positive: "text-emerald-700",
    negative: "text-red-600",
  };
  const badgeCls =
    badgeColor === "amber"
      ? "bg-amber-100 text-amber-700"
      : badgeColor === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "";

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 space-y-1.5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums tracking-tight ${colorMap[variant]}`}>{value}</p>
      <div className="flex items-center gap-1.5">
        {badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeCls}`}>{badge}</span>}
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}
