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
import { KanbanCardContent } from "./KanbanCardContent";
import { KanbanEditPanel } from "./KanbanEditPanel";
import { COLUMNS, CLASSIFICACAO_ORDER, type KanbanCard } from "./types";

export function KanbanBoard() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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

    const now = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === draggableId ? { ...c, status: newStatus, last_moved_at: now } : c
      )
    );

    const { error } = await supabase
      .from("kanban_influencers")
      .update({ status: newStatus, last_moved_at: now })
      .eq("id", draggableId);

    if (error) {
      toast.error("Erro ao mover card");
      fetchCards();
    }
  };

  const handleAddCard = async (instagramUrl: string) => {
    if (!user) return;

    let username = instagramUrl.trim();
    const match = username.match(
      /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/
    );
    if (match) username = match[1];
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

  const handleUpdateCard = async (cardId: string, fields: Partial<KanbanCard>) => {
    const now = new Date().toISOString();
    const updateFields = { ...fields, last_moved_at: now };

    // Optimistic
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updateFields } : c))
    );
    // Also update editCard if it's the same
    setEditCard((prev) =>
      prev && prev.id === cardId ? { ...prev, ...updateFields } : prev
    );

    const { error } = await supabase
      .from("kanban_influencers")
      .update(updateFields)
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao salvar");
      fetchCards();
    }
  };

  const handleOpenEdit = (card: KanbanCard) => {
    setEditCard(card);
    setEditOpen(true);
  };

  const cardsByColumn = COLUMNS.map((col) => ({
    ...col,
    cards: cards
      .filter((c) => c.status === col.id)
      .sort((a, b) => {
        const orderA = a.classificacao ? (CLASSIFICACAO_ORDER[a.classificacao] ?? 99) : 99;
        const orderB = b.classificacao ? (CLASSIFICACAO_ORDER[b.classificacao] ?? 99) : 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.last_moved_at).getTime() - new Date(a.last_moved_at).getTime();
      }),
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
                  bg={col.bg}
                  accent={col.accent}
                  count={col.cards.length}
                  provided={provided}
                  isDraggingOver={snapshot.isDraggingOver}
                >
                  {col.cards.map((card, index) => (
                    <Draggable key={card.id} draggableId={card.id} index={index}>
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
                            onUpdate={handleUpdateCard}
                            onOpenEdit={handleOpenEdit}
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

      <KanbanEditPanel
        card={editCard}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={handleUpdateCard}
      />
    </div>
  );
}
