import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CheckCircle, XCircle, ShieldOff, Loader2, UserCheck, Link2, Copy, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingUser {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
}

interface Invite {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  max_uses: number;
  use_count: number;
}

export function ApprovalsTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingUser, setRejectingUser] = useState<PendingUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState('1');

  const fetchData = async () => {
    const [{ data: profilesData }, { data: invitesData }] = await Promise.all([
      supabase.from('profiles').select('id, nome, status, created_at, rejection_reason'),
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
    ]);
    
    setUsers((profilesData || []).filter((p: any) => p.status !== 'approved') as PendingUser[]);
    setInvites((invitesData || []) as Invite[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (u: PendingUser) => {
    if (!user) return;
    setProcessing(u.id);
    try {
      const { error } = await supabase.from('profiles').update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      } as any).eq('id', u.id);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_nome: user.nome,
        acao: 'APROVAR_USUARIO',
        descricao: `Aprovou o usuário ${u.nome}`,
      });

      toast.success(`${u.nome} aprovado com sucesso`);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao aprovar', { description: err.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingUser || !user || !rejectionReason.trim()) return;
    setProcessing(rejectingUser.id);
    try {
      const { error } = await supabase.from('profiles').update({
        status: 'rejected',
        rejection_reason: rejectionReason.trim(),
      } as any).eq('id', rejectingUser.id);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_nome: user.nome,
        acao: 'REJEITAR_USUARIO',
        descricao: `Rejeitou o usuário ${rejectingUser.nome}. Motivo: ${rejectionReason.trim()}`,
      });

      toast.success(`${rejectingUser.nome} rejeitado`);
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao rejeitar', { description: err.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleBlock = async (u: PendingUser) => {
    if (!user) return;
    setProcessing(u.id);
    try {
      const { error } = await supabase.from('profiles').update({
        status: 'blocked',
      } as any).eq('id', u.id);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_nome: user.nome,
        acao: 'BLOQUEAR_USUARIO',
        descricao: `Bloqueou o usuário ${u.nome}`,
      });

      toast.success(`${u.nome} bloqueado`);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao bloquear', { description: err.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!user) return;
    setCreatingInvite(true);
    try {
      const { error } = await supabase.from('invites').insert({
        created_by: user.id,
        max_uses: parseInt(inviteMaxUses) || 1,
      } as any);
      if (error) throw error;
      toast.success('Convite criado');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao criar convite', { description: err.message });
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/login?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pendente', className: 'border-amber-300 text-amber-700 bg-amber-50' },
      rejected: { label: 'Rejeitado', className: 'border-red-300 text-red-700 bg-red-50' },
      blocked: { label: 'Bloqueado', className: 'border-red-300 text-red-700 bg-red-50' },
    };
    const s = map[status] || map.pending;
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" />Aprovações</CardTitle>
          <CardDescription>Gerencie contas pendentes de aprovação</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta pendente</p>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-sm">Nome</th>
                    <th className="text-left p-3 font-medium text-sm">Status</th>
                    <th className="text-left p-3 font-medium text-sm">Criado em</th>
                    <th className="text-right p-3 font-medium text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-sm">{u.nome}</td>
                      <td className="p-3">{statusBadge(u.status)}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {u.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleApprove(u)}
                              disabled={processing === u.id}
                            >
                              {processing === u.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                              Aprovar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => { setRejectingUser(u); setRejectModalOpen(true); }}
                            disabled={processing === u.id}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBlock(u)}
                            disabled={processing === u.id}
                          >
                            <ShieldOff className="h-3.5 w-3.5 mr-1" />Bloquear
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Convites</CardTitle>
          <CardDescription>Gere links de convite para novos usuários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Máx. de usos</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={inviteMaxUses}
                onChange={e => setInviteMaxUses(e.target.value)}
                className="w-24 h-9"
              />
            </div>
            <Button size="sm" onClick={handleCreateInvite} disabled={creatingInvite}>
              {creatingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Gerar Convite
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-xs">Token</th>
                    <th className="text-left p-3 font-medium text-xs">Usos</th>
                    <th className="text-left p-3 font-medium text-xs">Expira</th>
                    <th className="text-right p-3 font-medium text-xs">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => {
                    const expired = new Date(inv.expires_at) < new Date();
                    const full = inv.use_count >= inv.max_uses;
                    return (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="p-3 text-xs font-mono text-muted-foreground">{inv.token.slice(0, 12)}…</td>
                        <td className="p-3 text-xs">{inv.use_count}/{inv.max_uses}</td>
                        <td className="p-3 text-xs">
                          {expired ? (
                            <Badge variant="outline" className="text-xs border-red-300 text-red-600">Expirado</Badge>
                          ) : (
                            format(new Date(inv.expires_at), "dd/MM HH:mm")
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={expired || full}
                            onClick={() => copyInviteLink(inv.token)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />Copiar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Usuário</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição de {rejectingUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Motivo</Label>
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Descreva o motivo da rejeição..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || processing === rejectingUser?.id}
            >
              {processing === rejectingUser?.id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
