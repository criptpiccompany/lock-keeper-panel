import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Handshake } from "lucide-react";

export interface SharedPartner {
  id: string;
  partner_user_id: string;
  partner_nome: string | null;
  share_type: string | null;
  share_amount: number | null;
}

interface SharedPartnersPopoverProps {
  partners: SharedPartner[];
  sharedNote?: string | null;
  compact?: boolean;
}

function formatShare(p: SharedPartner): string {
  if (!p.share_type || p.share_amount == null) return "";
  if (p.share_type === "percent") return `${p.share_amount}%`;
  return p.share_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SharedPartnersPopover({
  partners,
  sharedNote,
  compact = false,
}: SharedPartnersPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center">
          <Badge
            variant="outline"
            className={`gap-1 cursor-pointer border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors ${compact ? "text-[10px] px-1.5 py-0" : "text-xs"}`}
          >
            <Handshake className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            DIVIDIDO
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2 text-sm" align="start">
        <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Parceiros
        </p>
        {partners.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum parceiro informado</p>
        ) : (
          <ul className="space-y-1">
            {partners.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span className="font-medium">{p.partner_nome || "Desconhecido"}</span>
                {p.share_type && p.share_amount != null && (
                  <span className="text-muted-foreground text-xs">{formatShare(p)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {sharedNote && (
          <div className="pt-1 border-t border-border/40">
            <p className="text-xs text-muted-foreground italic">"{sharedNote}"</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
