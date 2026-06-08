import { useEffect, useState } from "react";
import { Clock3, UserPlus, Pencil, Trash2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface CardHistorySheetProps {
  cardId: string | null;
  cardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuditEntry = {
  id: string;
  created_at: string;
  actor_nome: string | null;
  action: string;
  description: string | null;
  field_changes: Record<string, unknown> | null;
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  classificacao: "Classificação",
  valor_negociado: "Valor",
  apoios: "Pontes",
  display_name: "Nome",
  instagram_username: "@",
  instagram_url: "Link",
  archived: "Arquivamento",
  assigned_to: "Responsável",
  closer_id: "Closer",
};

function summarizeChange(entry: AuditEntry): string {
  if (entry.action === "INSERT") return "Card criado";
  if (entry.action === "DELETE") return "Card removido";
  const changes = entry.field_changes as Record<string, { before: unknown; after: unknown }> | null;
  if (!changes) return "Alteração";
  const fields = Object.keys(changes).filter((k) => k !== "last_moved_at" && k !== "updated_at");
  if (fields.length === 0) return "Alteração";
  return fields
    .map((f) => {
      const label = FIELD_LABELS[f] ?? f;
      const after = changes[f]?.after;
      if (after == null || after === "") return `${label} limpo`;
      if (typeof after === "object") return `${label} atualizado`;
      return `${label}: ${String(after)}`;
    })
    .join(" · ");
}

function actionMeta(action: string) {
  if (action === "INSERT") return { Icon: UserPlus, color: "#16a34a" };
  if (action === "DELETE") return { Icon: Trash2, color: "#dc2626" };
  return { Icon: Pencil, color: "#52525b" };
}

export function CardHistorySheet({ cardId, cardName, open, onOpenChange }: CardHistorySheetProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cardId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("audit_logs")
      .select("id, created_at, actor_nome, action, description, field_changes")
      .eq("entity_type", "team_shared_board")
      .eq("entity_id", cardId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setEntries((data ?? []) as AuditEntry[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, cardId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] sm:max-w-[460px] overflow-y-auto bg-white p-0">
        <SheetHeader className="border-b border-[#ececea] px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em] text-[#1f1f1f]">
            <Clock3 className="h-4 w-4 text-[#8d8d89]" />
            Histórico — {cardName}
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-[12px] text-[#9a9a95]">Carregando…</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-[12px] text-[#9a9a95]">
              <FileText className="h-5 w-5" />
              Nenhum histórico ainda
            </div>
          ) : (
            <ol className="relative space-y-3 border-l border-[#ececea] pl-6">
              {entries.map((entry) => {
                const { Icon, color } = actionMeta(entry.action);
                return (
                  <li key={entry.id} className="relative">
                    <span
                      className="absolute -left-[34px] grid h-6 w-6 place-items-center rounded-full border border-[#ececea] bg-white"
                      style={{ color }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="rounded-[14px] border border-[#ececea] bg-white p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[13px] font-medium text-[#1f1f1f]">
                          {summarizeChange(entry)}
                        </div>
                        <div className="shrink-0 text-[11px] text-[#9a9a95]">
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </div>
                      </div>
                      <div className="mt-1 text-[12px] text-[#71716c]">
                        por {entry.actor_nome ?? "Sistema"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
