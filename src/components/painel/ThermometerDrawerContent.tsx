import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Receipt, Percent } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import ListaDoMes from "@/components/planilhamento/ListaDoMes";
import { PLATFORM_FEE_RATE, PLATFORM_FEE_LABEL } from "@/lib/constants";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { getEstimatedCommission } from "@/lib/commissionCalc";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthOptions() {
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

interface Props {
  closerId: string;
  initialMonth: string;
}

export default function ThermometerDrawerContent({ closerId, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(true);
  const [invested, setInvested] = useState(0);
  const [revenue, setRevenue] = useState(0);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    setLoading(true);
    const [year, mo] = month.split("-");
    const startDate = `${year}-${mo}-01`;
    const endDate = `${year}-${mo}-${String(new Date(Number(year), Number(mo), 0).getDate()).padStart(2, "0")}`;

    supabase
      .from("daily_influencer_records")
      .select("valor_pago, faturamento")
      .eq("closer_id", closerId)
      .gte("date", startDate)
      .lte("date", endDate)
      .is("deleted_at", null)
      .then(({ data }) => {
        let inv = 0, rev = 0;
        (data || []).forEach((r: any) => {
          inv += Number(r.valor_pago) || 0;
          rev += Number(r.faturamento) || 0;
        });
        setInvested(inv);
        setRevenue(rev);
        setLoading(false);
      });
  }, [closerId, month]);

  const fee = revenue * PLATFORM_FEE_RATE;
  const result = revenue - invested - fee;

  const { currentPercentage, loading: tierLoading } = useCommissionTier(result);
  const commission = getEstimatedCommission(result, currentPercentage);
  

  if (loading || tierLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      {/* Month selector + commission label */}
      <div className="flex items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          Comissão: {currentPercentage}%
        </span>
      </div>

      {/* Summary Cards — same pattern as Balanço */}
      <div className="flex flex-col gap-2 min-w-0">
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="Faturamento" value={revenue} icon={TrendingUp} />
          <SummaryCard label="Investido" value={invested} icon={DollarSign} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label={PLATFORM_FEE_LABEL} value={fee} icon={Percent} variant="muted" />
          <SummaryCard
            label="Resultado"
            value={result}
            icon={result >= 0 ? TrendingUp : TrendingDown}
            variant={result >= 0 ? "positive" : "negative"}
          />
        </div>
        <SummaryCard label="Comissão" value={commission} icon={Receipt} />
      </div>

      {/* Compact Thermometer */}
      <div className="rounded-xl border border-border/40 bg-card p-4 min-w-0 overflow-hidden">
        <div className="max-w-[380px] mx-auto overflow-visible">
          <UnifiedThermometerWidget resultado={result} month={month} compact />
        </div>
      </div>

      {/* Lista do Mês (table only) */}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold mb-3">Lista do Mês</h3>
        <ListaDoMes closerId={closerId} hideThermometer />
      </div>
    </div>
  );
}

/* ── SummaryCard ── */

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
  const colorClass =
    variant === "positive" ? "text-emerald-700" :
    variant === "negative" ? "text-destructive" :
    variant === "muted" ? "text-muted-foreground" :
    "text-foreground";

  return (
    <div className="rounded-lg border border-border/40 bg-card px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">{label}</span>
      </div>
      <p className={`text-base font-semibold tabular-nums ${colorClass}`}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
