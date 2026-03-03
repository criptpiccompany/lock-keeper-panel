import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { FileText, List, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import UnifiedThermometerWidget from "@/components/home/UnifiedThermometerWidget";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const { user } = useAuth();
  const [resultado, setResultado] = useState(0);
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

      let invested = 0;
      let revenue = 0;
      (data || []).forEach((r: any) => {
        invested += Number(r.valor_pago) || 0;
        revenue += Number(r.faturamento) || 0;
      });
      const fee = revenue * feeRate;
      setResultado(revenue - invested - fee);
      setLoading(false);
    };

    fetchResultado();
  }, [user, month, feeRate]);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];

  return (
    <main className="container-premium py-8 sm:py-12 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Bem-vindo, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe sua performance do mês.
        </p>
      </div>

      {/* Unified Thermometer */}
      <div className="card-premium p-4 sm:p-8 md:p-10 mb-8 overflow-visible">
        {!loading && (
          <UnifiedThermometerWidget resultado={resultado} month={month} />
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Button asChild variant="outline" className="gap-2">
          <Link to="/registro">
            <FileText className="h-4 w-4" />
            Planilhamento
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/meu">
            <List className="h-4 w-4" />
            Minha Lista
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
