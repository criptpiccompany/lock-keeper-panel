import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/helpers";
import { FileText, Loader2, CheckCircle, Shield, Archive, UserCog, Mail, Key, Users } from "lucide-react";

interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string;
  user_nome: string;
  acao: string;
  descricao: string;
  detalhes: any;
}

interface CloseEvent {
  id: string;
  feito_em: string;
  feito_por_nome: string;
  influencer_handle: string;
  acao: string;
  motivo: string | null;
}

export default function Auditoria() {
  const [closeEvents, setCloseEvents] = useState<CloseEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [eventsRes, logsRes] = await Promise.all([
        supabase.from('close_events').select('*').order('feito_em', { ascending: false }).limit(100),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100)
      ]);
      setCloseEvents(eventsRes.data || []);
      setAuditLogs(logsRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const getCloseActionConfig = (acao: string) => {
    const configs: Record<string, { label: string; icon: any; className: string }> = {
      FECHAMENTO: { label: "Fechamento", icon: CheckCircle, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      OVERRIDE_ADMIN: { label: "Override", icon: Shield, className: "bg-amber-50 text-amber-700 border-amber-200" },
      ARQUIVAR: { label: "Arquivar", icon: Archive, className: "bg-slate-100 text-slate-600 border-slate-200" },
    };
    return configs[acao] || configs.FECHAMENTO;
  };

  const getAuditActionConfig = (acao: string) => {
    const configs: Record<string, { label: string; icon: any; className: string }> = {
      ROLE_CHANGE: { label: "Papel Alterado", icon: UserCog, className: "bg-purple-50 text-purple-700 border-purple-200" },
      PASSWORD_RESET: { label: "Reset Senha", icon: Key, className: "bg-blue-50 text-blue-700 border-blue-200" },
      USER_LOGIN: { label: "Login", icon: Users, className: "bg-green-50 text-green-700 border-green-200" },
      EMAIL_SENT: { label: "Email Enviado", icon: Mail, className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    };
    return configs[acao] || { label: acao, icon: FileText, className: "bg-gray-50 text-gray-700 border-gray-200" };
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
          <p className="text-muted-foreground text-sm mt-1">Histórico imutável de todas as ações do sistema</p>
        </div>
      </div>
      <div className="container py-6">
        <Tabs defaultValue="fechamentos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="fechamentos" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Fechamentos ({closeEvents.length})
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="h-4 w-4" />
              Ações Admin ({auditLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fechamentos">
            <div className="bg-card rounded-xl border">
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Influenciador</th>
                    <th>Usuário</th>
                    <th>Data/Hora</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {closeEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum evento registrado
                      </td>
                    </tr>
                  ) : (
                    closeEvents.map(event => {
                      const config = getCloseActionConfig(event.acao);
                      const Icon = config.icon;
                      return (
                        <tr key={event.id}>
                          <td>
                            <Badge variant="outline" className={config.className}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </td>
                          <td className="font-medium">{event.influencer_handle}</td>
                          <td className="text-muted-foreground">{event.feito_por_nome}</td>
                          <td className="text-muted-foreground text-sm">{formatDateTime(event.feito_em)}</td>
                          <td className="text-muted-foreground text-sm max-w-[200px] truncate">{event.motivo || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="admin">
            <div className="bg-card rounded-xl border">
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Descrição</th>
                    <th>Usuário</th>
                    <th>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma ação administrativa registrada
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      const config = getAuditActionConfig(log.acao);
                      const Icon = config.icon;
                      return (
                        <tr key={log.id}>
                          <td>
                            <Badge variant="outline" className={config.className}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </td>
                          <td className="text-sm">{log.descricao}</td>
                          <td className="text-muted-foreground">{log.user_nome}</td>
                          <td className="text-muted-foreground text-sm">{formatDateTime(log.created_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
