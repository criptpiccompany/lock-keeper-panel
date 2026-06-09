import { Receipt, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { BrandStat } from "@/components/PageHeader";
import { formatBRL, computeNet, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

interface Props {
  currentData: DayAggregate;
  currentLabel: string;
  partial?: boolean;
  previousData: DayAggregate;
  previousLabel: string;
}

export default function FinanceiroSummaryCards({
  currentData,
  currentLabel,
  partial,
  previousData,
  previousLabel,
}: Props) {
  // Mostramos a leitura "fechada" (período anterior) como referência principal,
  // pois o atual pode estar parcial.
  const taxes = previousData.revenue * TAX_TOTAL;
  const net = computeNet(previousData.revenue, previousData.cost);
  const margin = previousData.revenue > 0 ? (net / previousData.revenue) * 100 : 0;
  const hint = "Fechado";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <BrandStat
        label={`Custo op. — ${currentLabel.toLowerCase()}`}
        value={formatBRL(currentData.cost)}
        icon={Receipt}
        tone="amber"
        hint={partial ? "Parcial" : "Fechado"}
      />
      <BrandStat
        label={`Faturamento — ${previousLabel.toLowerCase()}`}
        value={formatBRL(previousData.revenue)}
        icon={TrendingUp}
        tone="emerald"
        hint={hint}
      />
      <BrandStat
        label={`Taxas (5%) — ${previousLabel.toLowerCase()}`}
        value={formatBRL(taxes)}
        icon={Percent}
        hint="2% dev · 3% gateway"
      />
      <BrandStat
        label={`Resultado líquido — ${previousLabel.toLowerCase()}`}
        value={formatBRL(net)}
        icon={net >= 0 ? TrendingUp : TrendingDown}
        tone={net >= 0 ? "emerald" : "rose"}
        hint="Fat − Custo − Taxas"
      />
      <BrandStat
        label={`Margem — ${previousLabel.toLowerCase()}`}
        value={`${margin.toFixed(1)}%`}
        icon={Percent}
        tone={margin >= 0 ? "emerald" : "rose"}
        hint={hint}
      />
    </div>
  );
}
