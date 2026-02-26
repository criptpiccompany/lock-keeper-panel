import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Link2, Copy, Trash2, UserPlus } from "lucide-react";

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
  created_at: string;
}

export function InviteManagement() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("CLOSER");

  const fetchData = async () => {
    setLoading(true);
    
    const [teamsRes, invitesRes] = await Promise.all([
      supabase.from("teams").select("id, name"),
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
    ]);

    const fetchedTeams = (teamsRes.data || []) as Team[];
    setTeams(fetchedTeams);

    const fetchedInvites = ((invitesRes.data || []) as any[]).map((inv) => ({
      ...inv,
      team_name: fetchedTeams.find((t) => t.id === inv.team_id)?.name || "—",
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

  const handleCreate = async () => {
    if (!user || !selectedTeamId) return;
    setCreating(true);

    try {
      const { error } = await supabase.from("invites").insert({
        created_by: user.id,
        team_id: selectedTeamId,
        role_to_assign: selectedRole,
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

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const isUsed = (inv: Invite) => inv.use_count >= inv.max_uses;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Convites
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "Gere convites para qualquer equipe"
            : "Gere convites para sua equipe"}
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
            Gerar Convite
          </Button>
        </div>

        {/* Invites list */}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum convite criado ainda.
          </p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-xs">Equipe</th>
                  <th className="text-left p-3 font-medium text-xs">Função</th>
                  <th className="text-left p-3 font-medium text-xs">Status</th>
                  <th className="text-left p-3 font-medium text-xs">Criado</th>
                  <th className="text-right p-3 font-medium text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const expired = isExpired(inv.expires_at);
                  const used = isUsed(inv);
                  return (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="p-3 text-sm">{inv.team_name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {inv.role_to_assign}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {used ? (
                          <Badge variant="secondary" className="text-xs">Usado</Badge>
                        ) : expired ? (
                          <Badge variant="destructive" className="text-xs">Expirado</Badge>
                        ) : (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                            Ativo
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {!expired && !used && (
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
