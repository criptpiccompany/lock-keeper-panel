import { useEffect, useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { KanbanCard } from "./types";

interface KanbanEditPanelProps {
  card: KanbanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, fields: Partial<KanbanCard>) => Promise<void>;
}

export function KanbanEditPanel({
  card,
  open,
  onOpenChange,
  onUpdate,
}: KanbanEditPanelProps) {
  const [displayName, setDisplayName] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync form when card changes
  useEffect(() => {
    if (card) {
      setDisplayName(card.display_name);
      setInstagramUrl(card.instagram_url ?? "");
      setValor(
        card.valor_negociado != null
          ? Number(card.valor_negociado).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : ""
      );
      setObservacao(card.observacao ?? "");
    }
  }, [card]);

  const autoSave = (fields: Partial<KanbanCard>) => {
    if (!card) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(card.id, fields);
    }, 600);
  };

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    autoSave({ display_name: v });
  };

  const handleUrlChange = (v: string) => {
    setInstagramUrl(v);
    // Also extract username
    let username = v.trim();
    const match = username.match(
      /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/
    );
    if (match) username = match[1];
    username = username.replace(/^@/, "");
    autoSave({ instagram_url: v, instagram_username: username || card?.instagram_username });
  };

  const handleValorChange = (v: string) => {
    setValor(v);
    const cleaned = v.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    autoSave({ valor_negociado: isNaN(num) ? null : num });
  };

  const handleObsChange = (v: string) => {
    setObservacao(v);
    autoSave({ observacao: v || null });
  };

  if (!card) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
                {card.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <SheetTitle className="text-base">{card.display_name}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nome do influenciador"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Instagram URL</Label>
            <Input
              value={instagramUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://instagram.com/username"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor negociado (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => handleValorChange(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => handleObsChange(e.target.value)}
              placeholder="Notas sobre este influenciador..."
              rows={3}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
