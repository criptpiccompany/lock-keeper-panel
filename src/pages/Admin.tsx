import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer, formatDate } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Settings, Archive, RefreshCw, AlertTriangle, Loader2, Users, Mail, Shield, ShieldCheck } from "lucide-react";

interface UserWithRole {
  id: string;
  nome: string;
  email: string;
  role: 'CLOSER' | 'ADMIN';
}

export default function Admin() {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveAction, setArchiveAction] = useState<"archive" | "unarchive">("archive");
  const [sendingReset, setSendingReset] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const fetchInfluencers = async () => {
    const { data } = await supabase.from('influencers').select('*');
    const enriched = (data || []).map(inf => enrichInfluencer({
      id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
      lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
    }));
    setInfluencers(enriched);
  };

  const fetchUsers = async () => {
    // Fetch profiles and roles
    const { data: profiles } = await supabase.from('profiles').select('id, nome');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    
    if (profiles && roles) {
      const usersWithRoles: UserWithRole[] = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          nome: profile.nome,
          email: '', // We'll need to get this from auth
          role: (userRole?.role as 'CLOSER' | 'ADMIN') || 'CLOSER'
        };
      });
      setUsers(usersWithRoles);
    }
  };

  useEffect(() => { 
    Promise.all([fetchInfluencers(), fetchUsers()]).then(() => setLoading(false));
  }, []);

  const selected = influencers.find(i => i.id === selectedId);

  const handleArchiveClick = (archive: boolean) => {
    setArchiveAction(archive ? "archive" : "unarchive");
    setArchiveModalOpen(true);
  };

  const handleArchiveConfirm = async (motivo: string) => {
    if (!selected || !user) return;
    
    await supabase.from('influencers').update({ ativo: archiveAction !== "archive" }).eq('id', selected.id);
    await supabase.from('close_events').insert({
      influencer_id: selected.id, influencer_handle: selected.handle,
      feito_por_id: user.id, feito_por_nome: user.nome,
      feito_em: new Date().toISOString(), acao: 'ARQUIVAR',
      motivo: `${archiveAction === "archive" ? "Arquivado" : "Desarquivado"}: ${motivo}`
    });

    toast.success(archiveAction === "archive" ? "Influenciador arquivado" : "Influenciador desarquivado");
    setSelectedId("");
    fetchInfluencers();
  };

  const handleSendPasswordReset = async (userId: string, userNome: string) => {
    setSendingReset(userId);
    try {
      // We need to use an edge function to send password reset since we need service role
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { userId }
      });

      if (error) throw error;
      
      // Log audit action
      await supabase.from('audit_log').insert({
        user_id: user!.id,
        user_nome: user!.nome,
        acao: 'PASSWORD_RESET',
        descricao: `Reset de senha enviado para ${userNome}`,
        detalhes: { target_user_id: userId, target_user_nome: userNome }
      });

      toast.success(`Email de redefinição enviado para ${userNome}`);
    } catch (error: any) {
      toast.error('Erro ao enviar email', { description: error.message });
    } finally {
      setSendingReset(null);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: 'CLOSER' | 'ADMIN', userNome: string) => {
    if (userId === user?.id) {
      toast.error('Você não pode alterar seu próprio papel');
      return;
    }

    setUpdatingRole(userId);
    const newRole = currentRole === 'ADMIN' ? 'CLOSER' : 'ADMIN';
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
      
      // Log audit action
      await supabase.from('audit_log').insert({
        user_id: user!.id,
        user_nome: user!.nome,
        acao: 'ROLE_CHANGE',
        descricao: `Papel de ${userNome} alterado de ${currentRole} para ${newRole}`,
        detalhes: { target_user_id: userId, target_user_nome: userNome, old_role: currentRole, new_role: newRole }
      });

      toast.success(`Papel alterado para ${newRole}`);
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao alterar papel', { description: error.message });
    } finally {
      setUpdatingRole(null);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" />Painel Admin
          </h1>
        </div>
      </div>
      <div className="container py-6 space-y-6">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Atenção</AlertTitle>
          <AlertDescription className="text-amber-700">Todas as ações são registradas no log de auditoria.</AlertDescription>
        </Alert>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Gerenciar Usuários</CardTitle>
            <CardDescription>Lista de usuários, papéis e redefinição de senha</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Papel</th>
                    <th className="text-right p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.nome}</span>
                          {u.id === user?.id && (
                            <Badge variant="outline" className="text-xs">Você</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant="outline" 
                          className={u.role === 'ADMIN' 
                            ? "border-amber-300 text-amber-700 bg-amber-50" 
                            : "border-emerald-300 text-emerald-700 bg-emerald-50"
                          }
                        >
                          {u.role === 'ADMIN' ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                          {u.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleToggleRole(u.id, u.role, u.nome)}
                            disabled={updatingRole === u.id || u.id === user?.id}
                          >
                            {updatingRole === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-1" />
                                {u.role === 'ADMIN' ? 'Tornar Closer' : 'Tornar Admin'}
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSendPasswordReset(u.id, u.nome)}
                            disabled={sendingReset === u.id}
                          >
                            {sendingReset === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-1" />
                                Reset Senha
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Archive Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" />Arquivar/Desarquivar</CardTitle>
            <CardDescription>Arquive influenciadores inativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Selecionar Influenciador</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                <SelectContent>
                  {influencers.map(inf => (
                    <SelectItem key={inf.id} value={inf.id}>
                      <div className="flex items-center gap-2">
                        <span>{inf.handle}</span>
                        <StatusBadge status={inf.status} showIcon={false} size="sm" />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selected.handle}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Dono: {selected.ownerNome || "Nenhum"}</p>
                  <p>Último fechamento: {formatDate(selected.lastClosedAt)}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => handleArchiveClick(selected.status !== "ARQUIVADO")}>
                  {selected.status !== "ARQUIVADO" ? <><Archive className="mr-2 h-4 w-4"/>Arquivar</> : <><RefreshCw className="mr-2 h-4 w-4"/>Desarquivar</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReasonModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title={archiveAction === "archive" ? "Arquivar" : "Desarquivar"}
        description={`Informe o motivo para ${archiveAction === "archive" ? "arquivar" : "desarquivar"} ${selected?.handle}`}
        actionLabel="Confirmar"
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
