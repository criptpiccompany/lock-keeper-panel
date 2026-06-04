import { useState, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Pencil, Archive, X, Plus, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { COLUMNS, CLASSIFICACAO_OPTIONS, type KanbanCard } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const [addingApoio, setAddingApoio] = useState(false);
  const [apoioInput, setApoioInput] = useState("");
  const [editingApoioIdx, setEditingApoioIdx] = useState<number | null>(null);
  const [editApoioInput, setEditApoioInput] = useState("");
  const apoioRef = useRef<HTMLInputElement>(null);
  const editApoioRef = useRef<HTMLInputElement>(null);

  const apoios = card.apoios ?? [];

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
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-[#f3f3ef] text-xs font-medium text-[#6e6e73]">
            {card.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#1f1f1f]">
            {card.display_name}
          </p>
          <a
            href={instagramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#7b7b78] transition-colors hover:text-[#1f1f1f]"
          >
            @{card.instagram_username}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-[#8b8b87] hover:bg-[#f5f5f2] hover:text-[#1f1f1f]"
            onClick={() => onOpenEdit(card)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-[#8b8b87] hover:bg-[#f5f5f2] hover:text-[#1f1f1f]"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar este influenciador?</AlertDialogTitle>
                <AlertDialogDescription>
                  @{card.instagram_username} será arquivado e removido do Kanban. Você pode restaurá-lo depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(card.id)}
                >
                  Arquivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div>
        <Select
          value={card.classificacao ?? ""}
          onValueChange={(val) => onUpdate(card.id, { classificacao: val || null })}
        >
          <SelectTrigger className="h-7 w-full rounded-full border-0 bg-[#f7f7f4] px-2 py-0 text-[11px] shadow-none hover:bg-[#f1f1ed] focus:ring-0 focus:ring-offset-0">
            {card.classificacao ? (
              (() => {
                const opt = CLASSIFICACAO_OPTIONS.find((o) => o.value === card.classificacao);
                return (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: opt?.bg, color: opt?.text }}
                  >
                    {card.classificacao}
                  </span>
                );
              })()
            ) : (
              <span className="text-[10px] italic text-[#8b8b87]">Classificar</span>
            )}
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICACAO_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: opt.bg, color: opt.text }}
                  >
                  {opt.value}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        {editingValue ? (
          <input
            ref={inputRef}
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onBlur={saveValue}
            onKeyDown={handleValueKeyDown}
            className="w-full rounded-[14px] border border-[#ececeb] bg-white px-3 py-2 text-[12px] font-medium text-[#1f1f1f] outline-none focus:ring-1 focus:ring-black/5"
            placeholder="0,00"
          />
        ) : (
          <button
            onClick={startEditValue}
            className="w-full rounded-[14px] bg-[#fbfbf8] px-3 py-2 text-left text-[12px] transition-colors hover:bg-[#f4f4f0]"
          >
            {card.valor_negociado != null ? (
              <span className="font-medium text-[#1f1f1f]">
                R$ {formatCurrency(Number(card.valor_negociado))}
              </span>
            ) : (
              <span className="italic text-[#8b8b87]">Adicionar valor</span>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {apoios.map((name, idx) => (
          editingApoioIdx === idx ? (
            <input
              key={idx}
              ref={editApoioRef}
              value={editApoioInput}
              onChange={(e) => setEditApoioInput(e.target.value)}
              onBlur={() => {
                const trimmed = editApoioInput.trim();
                if (trimmed && trimmed !== apoios[idx]) {
                  const next = [...apoios];
                  next[idx] = trimmed;
                  onUpdate(card.id, { apoios: next });
                }
                setEditingApoioIdx(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingApoioIdx(null);
              }}
              className="h-6 w-20 rounded-full border border-[#ececeb] bg-white px-2 text-[10px] outline-none focus:ring-1 focus:ring-black/5"
              autoFocus
            />
          ) : (
            <span
              key={idx}
              className="inline-flex cursor-pointer items-center gap-0.5 rounded-full bg-[#f3f3ef] px-2 py-1 text-[10px] font-medium text-[#6e6e73] transition-colors hover:bg-[#ecece7]"
              onClick={() => {
                setEditingApoioIdx(idx);
                setEditApoioInput(apoios[idx]);
                setTimeout(() => editApoioRef.current?.focus(), 0);
              }}
            >
              {name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = apoios.filter((_, i) => i !== idx);
                  onUpdate(card.id, { apoios: next });
                }}
                  className="ml-0.5 rounded-full hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )
        ))}
        {addingApoio ? (
          <input
            ref={apoioRef}
            value={apoioInput}
            onChange={(e) => setApoioInput(e.target.value)}
            onBlur={() => {
              const trimmed = apoioInput.trim();
              if (trimmed) {
                onUpdate(card.id, { apoios: [...apoios, trimmed] });
              }
              setApoioInput("");
              setAddingApoio(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setApoioInput(""); setAddingApoio(false); }
            }}
            className="h-5 w-20 rounded border bg-background px-1.5 text-[10px] outline-none focus:ring-1 focus:ring-ring"
            placeholder="Nome"
            autoFocus
          />
        ) : apoios.length < 3 ? (
          <button
            onClick={() => setAddingApoio(true)}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] text-[#8b8b87] transition-colors hover:bg-[#f5f5f2]"
          >
            <Plus className="h-2.5 w-2.5" />
            Agente/Indicação
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className="rounded-full border-0 px-2 py-1 text-[10px] font-medium"
          style={{
            backgroundColor: columnDef ? `${columnDef.accent}18` : undefined,
            color: columnDef?.accent,
          }}
        >
          {card.status}
        </Badge>
        <span className="text-[10px] text-[#8b8b87]">
          {formatDistanceToNow(new Date(card.last_moved_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>
      </div>
    </div>
  );
}
