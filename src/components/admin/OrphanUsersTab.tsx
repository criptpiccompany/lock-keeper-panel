import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, Search, AlertTriangle, UserX } from "lucide-react";

interface OrphanUser {
  id: string;
  nome: string;
  status: string;
  role: string;
  created_at: string;
}

export function OrphanUsersTab() {
  const [orphans, setOrphans] = useState<OrphanUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stats, setStats] = useState({ totalProfiles: 0, totalAuth: 0 });

  const handleScan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-orphan-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      setOrphans(data.orphans || []);
      setStats({ totalProfiles: data.totalProfiles, totalAuth: data.totalAuth });
      setScanned(true);
      setSelected(new Set());
    } catch (error: any) {
      toast.error("Erro ao buscar usuários", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orphans.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orphans.map((o) => o.id)));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-orphan-users", {
        body: { action: "delete", userIds: Array.from(selected) },
      });
      if (error) throw error;
      toast.success(`${data.deleted} usuário(s) órfão(s) excluído(s)`);
      setConfirmOpen(false);
      handleScan();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5" />
          Usuários Órfãos (Importados)
        </CardTitle>
        <CardDescription>
          Perfis que existem no banco de dados mas não possuem conta de autenticação.
          Esses usuários foram importados de outro projeto e não conseguem fazer login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleScan} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {scanned ? "Reescanear" : "Buscar Usuários Órfãos"}
        </Button>

        {scanned && (
          <>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Total de perfis: <strong className="text-foreground">{stats.totalProfiles}</strong></span>
              <span>Com conta auth: <strong className="text-foreground">{stats.totalAuth}</strong></span>
              <span>Órfãos: <strong className="text-foreground text-destructive">{orphans.length}</strong></span>
            </div>

            {orphans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário órfão encontrado ✓
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.size === orphans.length && orphans.length > 0}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                  {selected.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir Selecionados ({selected.size})
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 w-10"></th>
                        <th className="text-left p-3 font-medium text-sm">Nome</th>
                        <th className="text-left p-3 font-medium text-sm">Papel</th>
                        <th className="text-left p-3 font-medium text-sm">Status</th>
                        <th className="text-left p-3 font-medium text-sm">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphans.map((o) => (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <Checkbox
                              checked={selected.has(o.id)}
                              onCheckedChange={() => toggleSelect(o.id)}
                            />
                          </td>
                          <td className="p-3 font-medium text-sm">{o.nome}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{o.role}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{o.status}</Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Você está prestes a excluir <strong>{selected.size}</strong> perfil(is) órfão(s).
                Isso removerá os registros das tabelas <code>profiles</code> e <code>user_roles</code>.
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir {selected.size} Perfil(is)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
