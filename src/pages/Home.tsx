import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, List, Wallet } from "lucide-react";

import { MetricCard } from "@/components/design/MetricCard";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { supabase } from "@/integrations/supabase/client";

type HomeStats = {
  revenue: number;
  invested: number;
  fee: number;
  result: number;
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<HomeStats>({
    revenue: 0,
    invested: 0,
    fee: 0,
    result: 0,
  });
  const [loading, setLoading] = useState(true);
  const month = useMemo(() => getCurrentMonth(), []);
  const { feeRate } = useTeamFeeRate(user?.teamId);

  useEffect(() => {
    const fetchResultado = async () => {
      if (!user) return;
      setLoading(true);

      const [year, mo] = month.split("-");
      const startDate = `${year}-${mo}-01`;
      const endDate = new Date(Number(year), Number(mo), 0);
      const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;

      const { data } = await supabase
        .from("daily_influencer_records")
        .select("valor_pago, faturamento")
        .eq("closer_id", user.id)
        .gte("date", startDate)
        .lte("date", endDateStr)
        .is("deleted_at", null);

      const rows = (data ?? []) as Array<{ valor_pago: number | null; faturamento: number | null }>;
      const invested = rows.reduce((total, row) => total + Number(row.valor_pago ?? 0), 0);
      const revenue = rows.reduce((total, row) => total + Number(row.faturamento ?? 0), 0);
      const fee = revenue * feeRate;

      setStats({
        invested,
        revenue,
        fee,
        result: revenue - invested - fee,
      });
      setLoading(false);
    };

    void fetchResultado();
  }, [user, month, feeRate]);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${firstName}`}
        description="Resumo do mês, atalhos operacionais e leitura rápida da sua performance atual."
        actions={
          <div className="token-pill">
            <Wallet className="h-3.5 w-3.5" />
            <span>Total no link</span>
          </div>
        }
      />

      <div className="metric-grid">
        <MetricCard label="Total no link" value={formatCurrency(stats.revenue)} hint="Faturamento bruto do mês atual." />
        <MetricCard label="Investimento" value={formatCurrency(stats.invested)} hint="Soma dos valores pagos no período." />
        <MetricCard label="Taxa operacional" value={formatCurrency(stats.fee)} hint="Cálculo com a taxa da equipe ativa." />
        <MetricCard label="Resultado líquido" value={formatCurrency(stats.result)} hint="Valor final após investimento e taxa." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
        <PanelCard
          title="Pulso do mês"
          description="A régua principal continua conectada aos seus dados reais."
        >
          <div className="hero-panel overflow-hidden">
            {!loading ? (
              <UnifiedThermometerWidget resultado={stats.result} month={month} />
            ) : (
              <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                Carregando visão do mês...
              </div>
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Atalhos"
          description="Acesso rápido às rotinas que mais movem a operação."
        >
          <div className="grid gap-3">
            <Button asChild className="justify-between rounded-2xl">
              <Link to="/registro">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Planilhamento
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="justify-between rounded-2xl">
              <Link to="/meu">
                <span className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Minha Lista
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <div className="surface-soft p-4">
              <p className="metric-kicker">Mês ativo</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {new Date(`${month}-02T12:00:00`).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use essa base para acompanhar o fechamento antes do consolidado final.
              </p>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
