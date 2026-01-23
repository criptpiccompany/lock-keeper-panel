import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/helpers";
import { FileText, Loader2, CheckCircle, Shield, Archive } from "lucide-react";

export default function Auditoria() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from('close_events').select('*').order('feito_em', { ascending: false }).limit(100);
      setEvents(data || []);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const getActionConfig = (acao: string) => {
    const configs: Record<string, { label: string; icon: any; className: string }> = {
      FECHAMENTO: { label: "Fechamento", icon: CheckCircle, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      OVERRIDE_ADMIN: { label: "Override", icon: Shield, className: "bg-amber-50 text-amber-700 border-amber-200" },
      ARQUIVAR: { label: "Arquivar", icon: Archive, className: "bg-slate-100 text-slate-500 border-slate-200" },
    };
    return configs[acao] || configs.FECHAMENTO;
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />Auditoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico imutável de todas as ações</p>
        </div>
      </div>
      <div className="container py-6">
        <div className="bg-card rounded-xl border">
          <table className="table-minimal">
            <thead><tr><th>Ação</th><th>Influenciador</th><th>Usuário</th><th>Data/Hora</th><th>Motivo</th></tr></thead>
            <tbody>
              {events.map(event => {
                const config = getActionConfig(event.acao);
                return (
                  <tr key={event.id}>
                    <td><Badge variant="outline" className={config.className}>{config.label}</Badge></td>
                    <td className="font-medium">{event.influencer_handle}</td>
                    <td className="text-muted-foreground">{event.feito_por_nome}</td>
                    <td className="text-muted-foreground text-sm">{formatDateTime(event.feito_em)}</td>
                    <td className="text-muted-foreground text-sm max-w-[200px] truncate">{event.motivo || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
