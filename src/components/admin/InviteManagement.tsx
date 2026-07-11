import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Link2, Copy, Trash2, UserPlus, CheckCircle2, Clock, XCircle } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface Invite {
  id: string;
  token: string;
  team_id: string;
  team_name?: string;
  role_to_assign: string;
  expires_at: string;
  use_count: number;
  max_uses: number;
  used_at: string | null;
  used_by: string | null;
  used_by_nome?: string;
  created_at: string;
}

type StatusFilter = "ALL" | "ATIVO" | "USADO" | "EXPIRADO";

export function InviteManagement() {
  const { user, isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("CLOSER");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [teamFilterId, setTeamFilterId] = useState<string>("ALL");

  const fetchData = async () => {
    setLoading(true);
    
    const [teamsRes, invitesRes, profilesRes] = await Promise.all([
      supabase.from("teams").select("id, name"),
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
    ]);

    const fetchedTeams = (teamsRes.data || []) as Team[];
    setTeams(fetchedTeams);

    const profiles = (profilesRes.data || []) as { id: string; nome: string }[];
    const profileMap = new Map(profiles.map(p => [p.id, p.nome]));

    const fetchedInvites = ((invitesRes.data || []) as any[]).map((inv) => ({
      ...inv,
      team_name: fetchedTeams.find((t) => t.id === inv.team_id)?.name || "—",
      used_by_nome: inv.used_by ? profileMap.get(inv.used_by) || "Desconhecido" : undefined,
    }));
    setInvites(fetchedInvites);

    // For SUBADMIN, auto-select their team
    if (isSubAdmin && !isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", user?.id || "")
        .single();
      if (profile?.team_id) {
        setSelectedTeamId(profile.team_id);
      }
    } else if (fetchedTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(fetchedTeams[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getInviteStatus = (inv: Invite): "ATIVO" | "USADO" | "EXPIRADO" => {
    if (inv.use_count >= inv.max_uses || inv.used_at) return "USADO";
    if (new Date(inv.expires_at) < new Date()) return "EXPIRADO";
    return "ATIVO";
  };

  const filteredInvites = useMemo(() => {
    let result = invites;
    if (statusFilter !== "ALL") {
      result = result.filter(inv => getInviteStatus(inv) === statusFilter);
    }
    if (isAdmin && teamFilterId !== "ALL") {
      result = result.filter(inv => inv.team_id === teamFilterId);
    }
    return result;
  }, [invites, statusFilter, teamFilterId, isAdmin]);

  const handleCreate = async () => {
    if (!user || !selectedTeamId) return;
    setCreating(true);

    try {
      const { error } = await supabase.from("invites").insert({
        created_by: user.id,
        team_id: selectedTeamId,
        role_to_assign: selectedRole,
        max_uses: 1,
      } as any);

      if (error) throw error;

      toast.success("Convite criado com sucesso!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao criar convite", { description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/login?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
      toast.success("Convite removido");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err.message });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const statusCounts = {
    ATIVO: invites.filter(i => getInviteStatus(i) === "ATIVO").length,
    USADO: invites.filter(i => getInviteStatus(i) === "USADO").length,
    EXPIRADO: invites.filter(i => getInviteStatus(i) === "EXPIRADO").length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Convites
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "Gere convites para qualquer equipe — uso único por convite"
            : "Gere convites para sua equipe — uso único por convite"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create invite form */}
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border bg-muted/30">
          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs">Equipe</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue placeholder="Selecionar equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Função</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLOSER">CLOSER</SelectItem>
                  {isAdmin && <SelectItem value="FINANCEIRO">FINANCEIRO</SelectItem>}
                {isAdmin && <SelectItem value="SUBADMIN">SUBADMIN</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreate} disabled={creating || !selectedTeamId} size="sm">
            {creating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-1.5 h-4 w-4" />
            )}
            Gerar Convite (1 uso)
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1">Filtrar:</span>
          {(["ALL", "ATIVO", "USADO", "EXPIRADO"] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? `Todos (${invites.length})` :
               s === "ATIVO" ? `Ativos (${statusCounts.ATIVO})` :
               s === "USADO" ? `Usados (${statusCounts.USADO})` :
               `Expirados (${statusCounts.EXPIRADO})`}
            </Button>
          ))}
          {isAdmin && (
            <Select value={teamFilterId} onValueChange={setTeamFilterId}>
              <SelectTrigger className="w-[180px] h-7 text-xs ml-2">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas equipes</SelectItem>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Invites list */}
        {filteredInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum convite encontrado.
          </p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-xs">Equipe</th>
                  <th className="text-left p-3 font-medium text-xs">Função</th>
                  <th className="text-left p-3 font-medium text-xs">Status</th>
                  <th className="text-left p-3 font-medium text-xs">Usado por</th>
                  <th className="text-left p-3 font-medium text-xs">Data uso</th>
                  <th className="text-left p-3 font-medium text-xs">Criado</th>
                  <th className="text-right p-3 font-medium text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((inv) => {
                  const status = getInviteStatus(inv);
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="p-3 text-sm">{inv.team_name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {inv.role_to_assign}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {status === "USADO" ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />Usado
                          </Badge>
                        ) : status === "EXPIRADO" ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <XCircle className="h-3 w-3" />Expirado
                          </Badge>
                        ) : (
                          <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                            <Clock className="h-3 w-3" />Ativo
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {inv.used_by_nome ? (
                          <span className="font-medium">{inv.used_by_nome}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {inv.used_at
                          ? new Date(inv.used_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {status === "ATIVO" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Copiar link"
                              onClick={() => handleCopyLink(inv.token)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Remover"
                            onClick={() => handleDelete(inv.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
  );
}
