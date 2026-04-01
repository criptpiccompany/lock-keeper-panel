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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import ListaDoMes from "@/components/planilhamento/ListaDoMes";
import PlanilhamentoDiario from "@/components/planilhamento/PlanilhamentoDiario";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
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
  const [closerTeamId, setCloserTeamId] = useState<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const { feeRate, feeLabel } = useTeamFeeRate(closerTeamId);

  useEffect(() => {
    setLoading(true);
    const [year, mo] = month.split("-");
    const startDate = `${year}-${mo}-01`;
    const endDate = `${year}-${mo}-${String(new Date(Number(year), Number(mo), 0).getDate()).padStart(2, "0")}`;

    Promise.all([
      supabase
        .from("daily_influencer_records")
        .select("valor_pago, faturamento")
        .eq("closer_id", closerId)
        .gte("date", startDate)
        .lte("date", endDate)
        .is("deleted_at", null),
      supabase.from("profiles").select("team_id").eq("id", closerId).single(),
    ]).then(([{ data }, { data: profile }]) => {
      let inv = 0, rev = 0;
      (data || []).forEach((r: any) => {
        inv += Number(r.valor_pago) || 0;
        rev += Number(r.faturamento) || 0;
      });
      setInvested(inv);
      setRevenue(rev);
      if (profile) setCloserTeamId((profile as any).team_id);
      setLoading(false);
    });
  }, [closerId, month]);

  const fee = revenue * feeRate;
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
    <div className="min-w-0">
      {/* Month selector — shared across all tabs */}
      <div className="flex items-center gap-3 mb-4">
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

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
          <TabsTrigger value="lista" className="text-xs">Lista do Mês</TabsTrigger>
          <TabsTrigger value="planilhamento" className="text-xs">Planilhamento</TabsTrigger>
        </TabsList>

        {/* Tab 1: Visão Geral */}
        <TabsContent value="overview" className="space-y-5 mt-0">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard label="Faturamento" value={revenue} icon={TrendingUp} />
              <SummaryCard label="Investido" value={invested} icon={DollarSign} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard label={feeLabel} value={fee} icon={Percent} variant="muted" />
              <SummaryCard
                label="Resultado"
                value={result}
                icon={result >= 0 ? TrendingUp : TrendingDown}
                variant={result >= 0 ? "positive" : "negative"}
              />
            </div>
            <SummaryCard label="Comissão" value={commission} icon={Receipt} />
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-4 min-w-0 overflow-hidden">
            <div className="max-w-[380px] mx-auto overflow-visible">
              <UnifiedThermometerWidget resultado={result} month={month} compact />
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Lista do Mês */}
        <TabsContent value="lista" className="mt-0">
          <ListaDoMes closerId={closerId} hideThermometer />
        </TabsContent>

        {/* Tab 3: Planilhamento Diário */}
        <TabsContent value="planilhamento" className="mt-0">
          <PlanilhamentoDiario closerId={closerId} />
        </TabsContent>
      </Tabs>
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
      <p className={`text-base font-semibold tabular-nums whitespace-nowrap ${colorClass}`}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
