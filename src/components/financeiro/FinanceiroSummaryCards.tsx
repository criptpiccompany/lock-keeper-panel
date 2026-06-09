import { Receipt, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { BrandStat } from "@/components/PageHeader";
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
      <BrandStat
        label="Custo op. hoje"
        value={formatBRL(todayData.cost)}
        icon={Receipt}
        tone="amber"
        hint="Parcial"
      />
      <BrandStat
        label="Faturamento ontem"
        value={formatBRL(yesterdayData.revenue)}
        icon={TrendingUp}
        tone="emerald"
        hint="Fechado"
      />
      <BrandStat
        label="Taxas totais ontem"
        value={formatBRL(yTaxes)}
        icon={Percent}
        hint="2% dev · 3% gateway"
      />
      <BrandStat
        label="Resultado líquido ontem"
        value={formatBRL(yNet)}
        icon={yNet >= 0 ? TrendingUp : TrendingDown}
        tone={yNet >= 0 ? "emerald" : "rose"}
        hint="Fechado"
      />
      <BrandStat
        label="Margem ontem"
        value={`${yMargin.toFixed(1)}%`}
        icon={Percent}
        tone={yMargin >= 0 ? "emerald" : "rose"}
        hint="Fechado"
      />
    </div>
  );
}
