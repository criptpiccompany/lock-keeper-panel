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
import { KanbanArchivePanel } from "./KanbanArchivePanel";
import { COLUMNS, CLASSIFICACAO_ORDER, type KanbanCard } from "./types";

const HIDDEN_COLUMNS = new Set(["Fechar", "Negociando"]);
const VISIBLE_COLUMNS = COLUMNS.filter((column) => !HIDDEN_COLUMNS.has(column.id));

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

  const handleAddCards = async (usernames: string[]) => {
    if (!user || usernames.length === 0) return;

    // Check for existing usernames to avoid duplicates
    const existingUsernames = new Set(
      cards.map((c) => c.instagram_username.toLowerCase())
    );

    const toInsert = usernames.filter(
      (u) => !existingUsernames.has(u.toLowerCase())
    );
    const skipped = usernames.length - toInsert.length;

    if (toInsert.length === 0) {
      toast.warning(
        skipped > 0
          ? `${skipped} já existem no kanban`
          : "Nenhum username válido"
      );
      return;
    }

    let added = 0;
    let errors = 0;
    const newCards: KanbanCard[] = [];

    for (const username of toInsert) {
      try {
        const { data, error } = await supabase
          .from("kanban_influencers")
          .insert({
            closer_id: user.id,
            instagram_url: `https://instagram.com/${username}`,
            instagram_username: username,
            display_name: username,
            status: "Positivo",
          })
          .select()
          .single();

        if (error) {
          console.error(`Erro ao inserir @${username}:`, error);
          errors++;
        } else if (data) {
          newCards.push(data);
          added++;
        }
      } catch (err) {
        console.error(`Erro inesperado ao inserir @${username}:`, err);
        errors++;
      }
    }

    if (newCards.length > 0) {
      setCards((prev) => [...prev, ...newCards]);
    }

    // Summary toast
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} adicionado(s)`);
    if (skipped > 0) parts.push(`${skipped} duplicado(s)`);
    if (errors > 0) parts.push(`${errors} erro(s)`);

    if (errors > 0 && added === 0) {
      toast.error(parts.join(" · "));
    } else if (errors > 0) {
      toast.warning(parts.join(" · "));
    } else {
      toast.success(parts.join(" · "));
    }
  };

  const handleArchiveCard = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const now = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, archived: true, archived_at: now, archived_from_status: c.status }
          : c
      )
    );

    const { error } = await supabase
      .from("kanban_influencers")
      .update({ archived: true, archived_at: now, archived_from_status: card.status })
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao arquivar card");
      fetchCards();
    }
  };

  const handleRestoreCard = async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const restoredStatus = card.archived_from_status || "Fechar";
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, archived: false, archived_at: null, archived_from_status: null, status: restoredStatus }
          : c
      )
    );

    const { error } = await supabase
      .from("kanban_influencers")
      .update({ archived: false, archived_at: null, archived_from_status: null, status: restoredStatus })
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao restaurar card");
      fetchCards();
    } else {
      toast.success("Card restaurado");
    }
  };

  const handleDeletePermanently = async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    const { error } = await supabase
      .from("kanban_influencers")
      .delete()
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao excluir card");
      fetchCards();
    } else {
      toast.success("Card excluído permanentemente");
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

  const cardsByColumn = VISIBLE_COLUMNS.map((col) => ({
    ...col,
    cards: cards
      .filter((c) => c.status === col.id && !c.archived)
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

  const archivedCards = cards.filter((c) => c.archived);
  const activeCardsCount = cards.filter((c) => !c.archived).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[32px] font-medium tracking-[-0.06em] text-[#1f1f1f] sm:text-[38px]">
              Gestão de Influenciadores
            </div>
            <p className="mt-2 text-[14px] text-[#6e6e73]">
              Adicione perfis por lista ou url e mova cada influenciador conforme a evolução do resultado
            </p>
          </div>

          <div className="flex items-center gap-3">
            <KanbanArchivePanel
              archivedCards={archivedCards}
              onRestore={handleRestoreCard}
              onDeletePermanently={handleDeletePermanently}
            />
            <div className="rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
              {activeCardsCount} cards
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="min-w-0 flex-1">
            <KanbanAddCard onAdd={handleAddCards} />
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 xl:grid xl:grid-cols-5 xl:gap-3 xl:overflow-visible">
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
                          className={`rounded-[22px] border border-black/12 bg-white p-3.5 shadow-[0_18px_34px_-20px_rgba(15,23,42,0.26),0_1px_0_rgba(255,255,255,0.98)_inset,0_0_0_1px_rgba(255,255,255,0.65)] ring-1 ring-black/[0.03] transition-shadow ${
                            dragSnapshot.isDragging
                              ? "shadow-[0_26px_44px_-20px_rgba(15,23,42,0.34)] ring-2 ring-black/10"
                              : ""
                          }`}
                        >
                          <KanbanCardContent
                            card={card}
                            onDelete={handleArchiveCard}
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
