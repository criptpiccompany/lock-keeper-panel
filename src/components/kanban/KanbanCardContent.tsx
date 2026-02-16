import { useState, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { COLUMNS, type KanbanCard } from "./types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface KanbanCardContentProps {
  card: KanbanCard;
  onDelete: (id: string) => void;
  onUpdate: (id: string, fields: Partial<KanbanCard>) => Promise<void>;
  onOpenEdit: (card: KanbanCard) => void;
}

export function KanbanCardContent({
  card,
  onDelete,
  onUpdate,
  onOpenEdit,
}: KanbanCardContentProps) {
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const instagramLink = card.instagram_url?.startsWith("http")
    ? card.instagram_url
    : `https://instagram.com/${card.instagram_username}`;

  const columnDef = COLUMNS.find((c) => c.id === card.status);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const startEditValue = () => {
    setValueInput(
      card.valor_negociado != null ? formatCurrency(Number(card.valor_negociado)) : ""
    );
    setEditingValue(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveValue = () => {
    setEditingValue(false);
    const cleaned = valueInput.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    const newVal = isNaN(num) ? null : num;
    if (newVal !== card.valor_negociado) {
      onUpdate(card.id, { valor_negociado: newVal });
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveValue();
    if (e.key === "Escape") setEditingValue(false);
  };

  return (
    <div className="space-y-2.5">
      {/* Header: Avatar + Name + Actions */}
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {card.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {card.display_name}
          </p>
          <a
            href={instagramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            @{card.instagram_username}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenEdit(card)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover influenciador?</AlertDialogTitle>
                <AlertDialogDescription>
                  @{card.instagram_username} será removido permanentemente do Kanban.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(card.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Inline editable value */}
      <div>
        {editingValue ? (
          <input
            ref={inputRef}
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onBlur={saveValue}
            onKeyDown={handleValueKeyDown}
            className="w-full rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring"
            placeholder="0,00"
          />
        ) : (
          <button
            onClick={startEditValue}
            className="w-full text-left rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
          >
            {card.valor_negociado != null ? (
              <span className="font-medium text-foreground">
                R$ {formatCurrency(Number(card.valor_negociado))}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Adicionar valor</span>
            )}
          </button>
        )}
      </div>

      {/* Footer: Status badge + time */}
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className="text-[10px] font-medium border-0 px-1.5 py-0"
          style={{
            backgroundColor: columnDef ? `${columnDef.color.replace(")", " / 0.1)")}` : undefined,
            color: columnDef?.color,
          }}
        >
          {card.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(card.last_moved_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>
      </div>
    </div>
  );
}
