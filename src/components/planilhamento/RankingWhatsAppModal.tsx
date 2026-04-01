import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface RankingEntry {
  nome: string;
  lucro: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  ranking: RankingEntry[];
  weekLabel: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MEDALS = ["🥇", "🥈", "🥉"];
const LABELS = ["1º LUGAR", "2º LUGAR", "3º LUGAR"];
const PRIZES = ["R$ 1.000 no Pix 💸", "R$ 500 no Pix 💸", "R$ 250 no Pix 💸"];

function capitalizeName(name: string): string {
  if (!name) return "";
  // If it looks like an email, take the part before @
  const clean = name.includes("@") ? name.split("@")[0] : name;
  return clean
    .split(/[\s_.-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractDateRange(weekLabel: string): string {
  // Extract date range like "23/03 — 29/03" from label
  const match = weekLabel.match(/(\d{2}\/\d{2})\s*[—–-]\s*(\d{2}\/\d{2})/);
  return match ? `${match[1]} - ${match[2]}` : weekLabel;
}

function buildWhatsAppText(ranking: RankingEntry[], weekLabel: string): string {
  const top = ranking.slice(0, 3);
  const period = extractDateRange(weekLabel);

  let text = `🏆 Ranking Oficial da Semana (${period}) 🏆\n`;

  top.forEach((entry, idx) => {
    text += `\n${MEDALS[idx]} ${LABELS[idx]}\n`;
    text += `${capitalizeName(entry.nome)} — ${formatBRL(entry.lucro)}\n`;
  });

  text += `\n🎁 Premiação:\n`;
  top.forEach((_, idx) => {
    text += `• ${idx + 1}º lugar → ${PRIZES[idx]}\n`;
  });
  text += `\n📌 Obs: Enviar a chave Pix no privado.`;

  return text;
}

export default function RankingWhatsAppModal({ open, onClose, ranking, weekLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const text = buildWhatsAppText(ranking, weekLabel);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Texto copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Ranking da Semana — WhatsApp</DialogTitle>
          <p className="text-xs text-muted-foreground">{weekLabel}</p>
        </DialogHeader>

        <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4 border border-border/40 max-h-[400px] overflow-y-auto font-sans leading-relaxed">
          {text}
        </pre>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
          <Button size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
