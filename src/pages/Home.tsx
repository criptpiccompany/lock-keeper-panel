import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";
import { FileText, List, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThermometerWidget from "@/components/home/ThermometerWidget";
import TeamThermometerWidget from "@/components/home/TeamThermometerWidget";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Home() {
  const { user } = useAuth();
  const [resultado, setResultado] = useState(0);
  const [loading, setLoading] = useState(true);
  const month = useMemo(() => getCurrentMonth(), []);

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
      const fee = revenue * PLATFORM_FEE_RATE;
      setResultado(revenue - invested - fee);
      setLoading(false);
    };

    fetchResultado();
  }, [user, month]);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];

  return (
    <main className="container-premium py-10 space-y-10 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          Bem-vindo, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe sua performance do mês.
        </p>
      </div>

      {/* Thermometer cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Individual */}
        <div className="card-premium p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Meu Termômetro
          </h2>
          {!loading && <ThermometerWidget resultado={resultado} />}
        </div>

        {/* Team */}
        <div className="card-premium p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Termômetro do Time
          </h2>
          <TeamThermometerWidget month={month} />
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="gap-2">
          <Link to="/registro">
            <FileText className="h-4 w-4" />
            Ir para Planilhamento
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/meu">
            <List className="h-4 w-4" />
            Ir para Minha Lista
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
