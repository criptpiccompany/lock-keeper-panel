import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { COLUMNS, type KanbanCard } from "./types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

interface KanbanArchivePanelProps {
  archivedCards: KanbanCard[];
  onRestore: (cardId: string) => Promise<void>;
  onDeletePermanently: (cardId: string) => Promise<void>;
}

export function KanbanArchivePanel({
  archivedCards,
  onRestore,
  onDeletePermanently,
}: KanbanArchivePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 gap-2 rounded-full border-[#ececeb] bg-white px-4 text-[13px] font-medium text-[#6e6e73] shadow-none">
          <Archive className="h-4 w-4" />
          Arquivados
          {archivedCards.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full bg-[#f3f3ef] px-1.5 text-[10px] text-[#6e6e73]">
              {archivedCards.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Cards Arquivados
          </SheetTitle>
        </SheetHeader>

        {archivedCards.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Nenhum card arquivado.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {archivedCards.map((card) => {
              const columnDef = COLUMNS.find((c) => c.id === card.archived_from_status);
              return (
                <div
                  key={card.id}
                  className="space-y-2 rounded-[20px] border border-black/[0.04] bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)]"
                >
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
                      <p className="text-xs text-muted-foreground">
                        @{card.instagram_username}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {card.archived_from_status && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-0 px-2 py-1 text-[10px] font-medium"
                        style={{
                          backgroundColor: columnDef ? `${columnDef.accent}18` : undefined,
                          color: columnDef?.accent,
                        }}
                      >
                        {card.archived_from_status}
                      </Badge>
                    )}
                    {card.archived_at && (
                      <span>
                        Arquivado em{" "}
                        {format(new Date(card.archived_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 rounded-full border-[#ececeb] bg-white px-3 text-xs"
                      onClick={() => onRestore(card.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            @{card.instagram_username} será removido permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeletePermanently(card.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
