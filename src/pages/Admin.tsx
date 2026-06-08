import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalsTab } from "@/components/admin/ApprovalsTab";
import { InviteManagement } from "@/components/admin/InviteManagement";
import { ReasonModal } from "@/components/ReasonModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer, formatDate, LockInfo } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Settings, Archive, RefreshCw, AlertTriangle, Loader2, Users, Mail, Shield, ShieldCheck, Pencil, Key, Percent, UserCheck, UserX, Download, UserPlus, ArrowRightLeft } from "lucide-react";
import { exportMonthXlsx } from "@/lib/exportMonthXlsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrphanUsersTab } from "@/components/admin/OrphanUsersTab";

interface Team {
  id: string;
  name: string;
}

interface UserWithRole {
  id: string;
  nome: string;
  email: string;
  role: 'CLOSER' | 'ADMIN' | 'SUBADMIN' | 'FINANCEIRO';
  commission_rate: number;
  team_id: string | null;
}

export default function Admin() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveAction, setArchiveAction] = useState<"archive" | "unarchive">("archive");
  const [sendingReset, setSendingReset] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  
  // Team filter for user list (ADMIN only)
  const [teamFilter, setTeamFilter] = useState<string>("all");
  
  // Move user modal
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movingUser, setMovingUser] = useState<UserWithRole | null>(null);
  const [moveTargetTeam, setMoveTargetTeam] = useState<string>("");
  const [movingInProgress, setMovingInProgress] = useState(false);
  
  // Edit name modal
  const [editNameModalOpen, setEditNameModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  
  // Change password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Commission rate
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);

  // Export
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exporting, setExporting] = useState(false);
  const [exportTeamId, setExportTeamId] = useState<string>("");

  const handleExport = async (teamIdOverride?: string, teamNameOverride?: string) => {
    setExporting(true);
    try {
      const tid = teamIdOverride || exportTeamId || undefined;
      const tname = teamNameOverride || (tid ? teams.find(t => t.id === tid)?.name : undefined);
      await exportMonthXlsx(exportMonth, (msg) => toast.info(msg), tid, tname);
      toast.success("Arquivo exportado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar", { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  const exportMonthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts;
  })();

  const fetchInfluencers = async () => {
    const [{ data }, { data: locksData }] = await Promise.all([
      supabase.from('influencers').select('*'),
      supabase.from('influencer_locks').select('influencer_id, locked_until').gt('locked_until', new Date().toISOString()),
    ]);
    const locksMap = new Map<string, LockInfo>();
    for (const l of (locksData || []) as any[]) {
      if (l.influencer_id) locksMap.set(l.influencer_id, { locked_until: l.locked_until });
    }
    const enriched = (data || []).map(inf => enrichInfluencer({
      id: inf.id, handle: inf.handle, ownerId: inf.owner_id, ownerNome: inf.owner_nome,
      lastClosedAt: inf.last_closed_at, ativo: inf.ativo, notas: inf.notas || undefined
    }, locksMap.get(inf.id) || null));
    setInfluencers(enriched);
  };

  const fetchUsers = async () => {
    const [{ data: profiles }, { data: roles }, { data: teamsData }] = await Promise.all([
      supabase.from('profiles').select('id, nome, commission_rate, team_id'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('teams').select('id, name'),
    ]);
    
    setTeams((teamsData || []) as Team[]);

    if (profiles && roles) {
      const usersWithRoles: UserWithRole[] = (profiles as any[]).map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          nome: profile.nome,
          email: '',
          role: (userRole?.role as 'CLOSER' | 'ADMIN' | 'SUBADMIN' | 'FINANCEIRO') || 'CLOSER',
          commission_rate: profile.commission_rate ?? 0.1,
          team_id: profile.team_id,
        };
      });
      setUsers(usersWithRoles);
    }
  };

  useEffect(() => { 
    Promise.all([fetchInfluencers(), fetchUsers()]).then(() => setLoading(false));
  }, []);

  const selected = influencers.find(i => i.id === selectedId);

  // Filter users by team
  const filteredUsers = teamFilter === "all"
    ? users
    : users.filter(u => u.team_id === teamFilter);

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "—";
    return teams.find(t => t.id === teamId)?.name || "—";
  };

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
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { userId }
      });
      if (error) throw error;
      toast.success(`Email de redefinição enviado para ${userNome}`);
    } catch (error: any) {
      toast.error('Erro ao enviar email', { description: error.message });
    } finally {
      setSendingReset(null);
    }
  };

  const handleOpenEditName = (u: UserWithRole) => {
    setEditingUser(u);
    setNewName(u.nome);
    setEditNameModalOpen(true);
  };

  const handleSaveName = async () => {
    if (!editingUser || !newName.trim()) return;
    setSavingName(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: { userId: editingUser.id, action: 'update_name', newName: newName.trim() }
      });
      if (error) throw error;
      toast.success(`Nome alterado para "${newName.trim()}"`);
      setEditNameModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao alterar nome', { description: error.message });
    } finally {
      setSavingName(false);
    }
  };

  const handleOpenPassword = (u: UserWithRole) => {
    setPasswordUser(u);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalOpen(true);
  };

  const handleSavePassword = async () => {
    if (!passwordUser || !newPassword) return;
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return; }
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return; }
    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: { userId: passwordUser.id, action: 'update_password', newPassword }
      });
      if (error) throw error;
      toast.success(`Senha alterada para ${passwordUser.nome}`);
      setPasswordModalOpen(false);
    } catch (error: any) {
      toast.error('Erro ao alterar senha', { description: error.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSetRole = async (userId: string, newRole: UserWithRole['role']) => {
    if (userId === user?.id) { toast.error('Você não pode alterar seu próprio papel'); return; }
    setUpdatingRole(userId);
    try {
      const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
      if (error) throw error;
      toast.success(`Papel alterado para ${newRole}`);
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao alterar papel', { description: error.message });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleSaveCommission = async (userId: string) => {
    const rate = parseFloat(commissionInput);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      toast.error("Taxa inválida. Use valores entre 0 e 1 (ex: 0.10 = 10%)");
      return;
    }
    setSavingCommission(true);
    try {
      const { error } = await supabase.from("profiles").update({ commission_rate: rate } as any).eq("id", userId);
      if (error) throw error;
      toast.success(`Comissão alterada para ${(rate * 100).toFixed(0)}%`);
      setEditingCommission(null);
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao salvar comissão", { description: error.message });
    } finally {
      setSavingCommission(false);
    }
  };

  // Move user between teams
  const handleOpenMoveModal = (u: UserWithRole) => {
    setMovingUser(u);
    // Pre-select the OTHER team
    const otherTeam = teams.find(t => t.id !== u.team_id);
    setMoveTargetTeam(otherTeam?.id || "");
    setMoveModalOpen(true);
  };

  const handleMoveUser = async () => {
    if (!movingUser || !moveTargetTeam) return;
    setMovingInProgress(true);
    try {
      const { error } = await supabase.rpc('admin_move_user_team', {
        _target_user_id: movingUser.id,
        _new_team_id: moveTargetTeam,
      });
      if (error) throw error;
      toast.success(`${movingUser.nome} movido para ${getTeamName(moveTargetTeam)}`);
      setMoveModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao mover usuário', { description: error.message });
    } finally {
      setMovingInProgress(false);
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

        <Tabs defaultValue="gestao" className="space-y-6">
          <TabsList>
            <TabsTrigger value="gestao"><Users className="h-4 w-4 mr-1.5" />Gestão</TabsTrigger>
            <TabsTrigger value="convites"><UserPlus className="h-4 w-4 mr-1.5" />Convites</TabsTrigger>
            {isAdmin && <TabsTrigger value="aprovacoes"><UserCheck className="h-4 w-4 mr-1.5" />Aprovações</TabsTrigger>}
            {isAdmin && <TabsTrigger value="orfaos"><UserX className="h-4 w-4 mr-1.5" />Órfãos</TabsTrigger>}
          </TabsList>

          <TabsContent value="gestao" className="space-y-6">

        {/* Users Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Gerenciar Usuários</CardTitle>
            <CardDescription>Lista de usuários, papéis e redefinição de senha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
           {/* Team filter tabs - ADMIN only */}
            {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={teamFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTeamFilter("all")}
              >
                Todos ({users.length})
              </Button>
              {teams.map(t => {
                const count = users.filter(u => u.team_id === t.id).length;
                return (
                  <Button
                    key={t.id}
                    variant={teamFilter === t.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTeamFilter(t.id)}
                  >
                    {t.name} ({count})
                  </Button>
                );
              })}
            </div>
            )}

            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Equipe</th>
                    <th className="text-left p-3 font-medium">Papel</th>
                    <th className="text-right p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
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
                        <Badge variant="outline" className="text-xs">
                          {getTeamName(u.team_id)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant="outline" 
                          className={u.role === 'ADMIN' 
                            ? "border-amber-300 text-amber-700 bg-amber-50" 
                            : u.role === 'SUBADMIN'
                            ? "border-blue-300 text-blue-700 bg-blue-50"
                            : "border-emerald-300 text-emerald-700 bg-emerald-50"
                          }
                        >
                          {u.role === 'ADMIN' ? <ShieldCheck className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                          {u.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Mover de equipe"
                            onClick={() => handleOpenMoveModal(u)}
                            disabled={u.id === user?.id}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Editar nome"
                            onClick={() => handleOpenEditName(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Alterar senha"
                            onClick={() => handleOpenPassword(u)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleToggleRole(u.id, u.role)}
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
                          )}
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
                                Reset Email
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

        {/* Archive Management - ADMIN only */}
        {isAdmin && (
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
        )}

        {/* Export Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Exportar Mês Completo</CardTitle>
            <CardDescription>
              {isAdmin 
                ? "Gere um arquivo XLSX com dados do mês — escolha a equipe" 
                : "Gere um arquivo XLSX com dados da sua equipe"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={exportMonth} onValueChange={setExportMonth}>
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exportMonthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={exportTeamId} onValueChange={setExportTeamId}>
                  <SelectTrigger className="w-[200px] h-9 text-sm">
                    <SelectValue placeholder="Todas as equipes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as equipes</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button 
                onClick={() => {
                  if (isAdmin) {
                    const tid = exportTeamId === "all" ? undefined : exportTeamId || undefined;
                    const tname = tid ? teams.find(t => t.id === tid)?.name : undefined;
                    handleExport(tid, tname);
                  } else {
                    // SUBADMIN: use their own team_id from users list
                    const myUser = users.find(u => u.id === user?.id);
                    const myTeamId = myUser?.team_id;
                    const myTeamName = myTeamId ? teams.find(t => t.id === myTeamId)?.name : undefined;
                    handleExport(myTeamId || undefined, myTeamName);
                  }
                }} 
                disabled={exporting}
              >
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Exportar XLSX
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Commission Settings - ADMIN only */}
        {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" />Comissão por Closer</CardTitle>
            <CardDescription>Defina a taxa de comissão individual (ex: 0.10 = 10%)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-sm">Closer</th>
                    <th className="text-left p-3 font-medium text-sm">Papel</th>
                    <th className="text-right p-3 font-medium text-sm">Comissão</th>
                    <th className="text-right p-3 font-medium text-sm w-32">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-sm">{u.nome}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {editingCommission === u.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={commissionInput}
                            onChange={(e) => setCommissionInput(e.target.value)}
                            className="w-24 h-8 text-sm text-right ml-auto"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium tabular-nums">
                            {(u.commission_rate * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {editingCommission === u.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCommission(null)}
                              disabled={savingCommission}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveCommission(u.id)}
                              disabled={savingCommission}
                            >
                              {savingCommission && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Salvar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCommission(u.id);
                              setCommissionInput(String(u.commission_rate));
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}
          </TabsContent>

          <TabsContent value="convites">
            <InviteManagement />
          </TabsContent>

          <TabsContent value="aprovacoes">
            <ApprovalsTab />
          </TabsContent>

          <TabsContent value="orfaos">
            <OrphanUsersTab />
          </TabsContent>
        </Tabs>
      </div>

      <ReasonModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title={archiveAction === "archive" ? "Arquivar" : "Desarquivar"}
        description={`Informe o motivo para ${archiveAction === "archive" ? "arquivar" : "desarquivar"} ${selected?.handle}`}
        actionLabel="Confirmar"
        onConfirm={handleArchiveConfirm}
      />

      {/* Edit Name Modal */}
      <Dialog open={editNameModalOpen} onOpenChange={setEditNameModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome</DialogTitle>
            <DialogDescription>Altere o nome de {editingUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Novo nome</Label>
              <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Digite o novo nome" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveName} disabled={savingName || !newName.trim()}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {passwordUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite novamente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePassword} disabled={savingPassword || !newPassword || newPassword !== confirmPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move User Modal */}
      <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Usuário de Equipe</DialogTitle>
            <DialogDescription>
              Mover <strong>{movingUser?.nome}</strong> para outra equipe?
              <br />
              <span className="text-xs text-muted-foreground">O histórico antigo permanece na equipe original. Novos registros usarão a nova equipe.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Equipe atual</Label>
              <p className="text-sm font-medium">{getTeamName(movingUser?.team_id || null)}</p>
            </div>
            <div className="space-y-2">
              <Label>Nova equipe</Label>
              <Select value={moveTargetTeam} onValueChange={setMoveTargetTeam}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe" /></SelectTrigger>
                <SelectContent>
                  {teams.filter(t => t.id !== movingUser?.team_id).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleMoveUser} disabled={movingInProgress || !moveTargetTeam}>
              {movingInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mover para {getTeamName(moveTargetTeam)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
