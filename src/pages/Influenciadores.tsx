import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, Filter, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KanbanInfluencer {
  id: string;
  instagram_username: string;
  display_name: string;
  status: string;
  closer_id: string;
  created_at: string;
  archived: boolean;
  valor_negociado: number | null;
}

interface ProfileMap { [id: string]: string; }

interface GroupedInfluencer {
  username: string;
  entries: (KanbanInfluencer & { closer_nome: string })[];
}

export default function Influenciadores() {
  const { isAdmin } = useAuth();
  const [influencers, setInfluencers] = useState<KanbanInfluencer[]>([]);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [infRes, profRes] = await Promise.all([
      supabase
        .from("kanban_influencers")
        .select("id, instagram_username, display_name, status, closer_id, created_at, archived, valor_negociado")
        .order("instagram_username"),
      supabase.from("profiles").select("id, nome").eq("status", "approved"),
    ]);
    if (infRes.data) setInfluencers(infRes.data as KanbanInfluencer[]);
    if (profRes.data) {
      const map: ProfileMap = {};
      profRes.data.forEach((p: any) => (map[p.id] = p.nome));
      setProfileMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const profiles = useMemo(
    () => Object.entries(profileMap).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    [profileMap]
  );

  const grouped = useMemo(() => {
    const filtered = influencers.filter((inf) => {
      if (filterUser !== "all" && inf.closer_id !== filterUser) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!inf.instagram_username.toLowerCase().includes(term) && !inf.display_name.toLowerCase().includes(term)) return false;
      }
      return true;
    });
    const map = new Map<string, GroupedInfluencer>();
    filtered.forEach((inf) => {
      const key = inf.instagram_username.toLowerCase();
      if (!map.has(key)) map.set(key, { username: inf.instagram_username, entries: [] });
      map.get(key)!.entries.push({ ...inf, closer_nome: profileMap[inf.closer_id] || "Desconhecido" });
    });
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [influencers, profileMap, searchTerm, filterUser]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("kanban_influencers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Influenciador excluído com sucesso" });
      setInfluencers((prev) => prev.filter((i) => i.id !== id));
    }
    setDeleting(null);
  };

  if (!isAdmin) return <Navigate to="/home" replace />;

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      Fechar: "tone-danger",
      Abordado: "tone-warning",
      Negociando: "tone-neutral",
      Positivo: "border-primary/20 bg-primary/10 text-primary",
      Empatando: "tone-warning",
      "Empatando / Negociar": "tone-warning",
      Pausado: "tone-danger",
      "Com a equipe": "tone-success",
      "Não posta mais": "tone-neutral",
      Golpe: "tone-danger",
    };
    return colors[status] || "tone-neutral";
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Administração"
        title="Influenciadores"
        description={`Gerenciamento completo com ${grouped.length} influenciador(es) e ${influencers.length} registro(s).`}
      />

      <PanelCard
        title="Consolidação por username"
        description="Agrupamento rápido para identificar duplicidade de entrada entre closers."
      >
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por username ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full sm:w-56 rounded-full">
              <Filter className="h-4 w-4 mr-1.5" />
              <SelectValue placeholder="Filtrar por closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Nenhum influenciador encontrado.</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)] pr-2">
            <div className="space-y-2">
              {grouped.map((group) => (
                <div key={group.username} className="surface-soft border border-border/40">
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">@{group.username}</span>
                      {group.entries.length > 1 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Users className="h-3 w-3" />{group.entries.length} closers
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-card">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium">{entry.closer_nome}</span>
                              <Badge variant="outline" className={`border text-[10px] px-1.5 py-0 ${statusColor(entry.status)}`}>
                                {entry.status}
                              </Badge>
                              {entry.archived && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Arquivado</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              <span>
                                Adicionado em {format(new Date(entry.created_at), "dd/MM/yy", { locale: ptBR })}
                              </span>
                              {entry.valor_negociado != null && (
                                <span>· R$ {entry.valor_negociado.toLocaleString("pt-BR")}</span>
                              )}
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir influenciador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso removerá permanentemente <strong>@{entry.instagram_username}</strong> do board de{" "}
                                  <strong>{entry.closer_nome}</strong>. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(entry.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deleting === entry.id}
                                >
                                  {deleting === entry.id ? "Excluindo..." : "Excluir"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PanelCard>
    </div>
  );
}
