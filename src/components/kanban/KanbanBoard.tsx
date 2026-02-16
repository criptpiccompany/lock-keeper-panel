import { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanAddCard } from "./KanbanAddCard";
import type { KanbanCard } from "./types";

const COLUMNS = [
  { id: "Fechar", color: "hsl(220 12% 15%)" },
  { id: "Negociando", color: "hsl(35 80% 50%)" },
  { id: "Positivo", color: "hsl(150 50% 40%)" },
  { id: "Empatando / Negociar", color: "hsl(25 70% 50%)" },
  { id: "Pausado", color: "hsl(220 10% 55%)" },
  { id: "Com a equipe", color: "hsl(200 60% 45%)" },
  { id: "Não posta mais", color: "hsl(0 65% 55%)" },
] as const;

export function KanbanBoard() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("kanban_influencers")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar cards");
      console.error(error);
    } else {
      setCards(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newStatus = destination.droppableId;
    const card = cards.find((c) => c.id === draggableId);
    if (!card || card.status === newStatus) return;

    // Optimistic update
    setCards((prev) =>
      prev.map((c) =>
        c.id === draggableId
          ? { ...c, status: newStatus, last_moved_at: new Date().toISOString() }
          : c
      )
    );

    const { error } = await supabase
      .from("kanban_influencers")
      .update({ status: newStatus, last_moved_at: new Date().toISOString() })
      .eq("id", draggableId);

    if (error) {
      toast.error("Erro ao mover card");
      fetchCards();
    }
  };

  const handleAddCard = async (instagramUrl: string) => {
    if (!user) return;

    // Extract username from URL or use as-is
    let username = instagramUrl.trim();
    const match = username.match(
      /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/
    );
    if (match) {
      username = match[1];
    }
    // Remove @ if present
    username = username.replace(/^@/, "");

    if (!username) {
      toast.error("Username inválido");
      return;
    }

    const { data, error } = await supabase
      .from("kanban_influencers")
      .insert({
        closer_id: user.id,
        instagram_url: instagramUrl.trim(),
        instagram_username: username,
        display_name: username,
        status: "Fechar",
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar card");
      console.error(error);
      return;
    }

    setCards((prev) => [...prev, data]);
    toast.success(`@${username} adicionado`);
  };

  const handleDeleteCard = async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));

    const { error } = await supabase
      .from("kanban_influencers")
      .delete()
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao remover card");
      fetchCards();
    }
  };

  const cardsByColumn = COLUMNS.map((col) => ({
    ...col,
    cards: cards.filter((c) => c.status === col.id),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KanbanAddCard onAdd={handleAddCard} />

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {cardsByColumn.map((col) => (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided, snapshot) => (
                <KanbanColumn
                  title={col.id}
                  color={col.color}
                  count={col.cards.length}
                  provided={provided}
                  isDraggingOver={snapshot.isDraggingOver}
                >
                  {col.cards.map((card, index) => (
                    <Draggable
                      key={card.id}
                      draggableId={card.id}
                      index={index}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
                            dragSnapshot.isDragging
                              ? "shadow-lg ring-2 ring-primary/20"
                              : ""
                          }`}
                        >
                          <KanbanCardContent
                            card={card}
                            onDelete={handleDeleteCard}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </KanbanColumn>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

// Inline card content to avoid circular deps
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

function KanbanCardContent({
  card,
  onDelete,
}: {
  card: KanbanCard;
  onDelete: (id: string) => void;
}) {
  const instagramLink = card.instagram_url?.startsWith("http")
    ? card.instagram_url
    : `https://instagram.com/${card.instagram_username}`;

  return (
    <div className="space-y-2">
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(card.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {card.valor_negociado != null && (
        <p className="text-xs font-medium text-foreground">
          R${" "}
          {Number(card.valor_negociado).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        {formatDistanceToNow(new Date(card.last_moved_at), {
          addSuffix: true,
          locale: ptBR,
        })}
      </p>
    </div>
  );
}
