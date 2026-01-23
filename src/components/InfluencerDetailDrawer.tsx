import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { CountdownChip } from "./CountdownChip";
import { BotaoRegistrarFechamento } from "./BotaoRegistrarFechamento";
import { useStore } from "@/store/useStore";
import { InfluencerWithStatus, CloseEvent } from "@/types";
import { formatDateTime, formatDate } from "@/lib/helpers";
import { User, Calendar, Clock, FileText, History } from "lucide-react";

interface InfluencerDetailDrawerProps {
  influencer: InfluencerWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  FECHAMENTO: { label: "Fechamento", color: "bg-primary/20 text-primary" },
  OVERRIDE_ADMIN: { label: "Override Admin", color: "bg-warning/20 text-warning" },
  ARQUIVAR: { label: "Arquivar/Desarquivar", color: "bg-muted text-muted-foreground" },
};

export function InfluencerDetailDrawer({
  influencer,
  open,
  onOpenChange,
}: InfluencerDetailDrawerProps) {
  const { getEventsByInfluencer } = useStore();

  if (!influencer) return null;

  const events = getEventsByInfluencer(influencer.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="handle-text text-xl">{influencer.handle}</span>
            <StatusBadge status={influencer.status} />
          </SheetTitle>
          <SheetDescription>
            Detalhes e histórico do influenciador
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-6 py-6">
            {/* Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Informações
              </h3>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Dono atual:</span>
                  <span className="font-medium">
                    {influencer.ownerNome || "Nenhum"}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Último fechamento:</span>
                  <span className="font-medium font-mono">
                    {formatDateTime(influencer.lastClosedAt)}
                  </span>
                </div>
                
                {influencer.status === "TRAVADO" && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Libera em:</span>
                    <CountdownChip lockedUntil={influencer.lockedUntil} />
                  </div>
                )}
                
                {influencer.notas && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">Notas:</span>
                    <span className="text-sm">{influencer.notas}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Action Section */}
            {influencer.status !== "ARQUIVADO" && (
              <>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Ação
                  </h3>
                  <BotaoRegistrarFechamento
                    influencer={influencer}
                    onSuccess={() => onOpenChange(false)}
                  />
                </div>
                <Separator />
              </>
            )}

            {/* History Section */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-4 w-4" />
                Histórico de Eventos
              </h3>
              
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function EventCard({ event }: { event: CloseEvent }) {
  const config = actionLabels[event.acao] || actionLabels.FECHAMENTO;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge className={config.color} variant="secondary">
          {config.label}
        </Badge>
        <span className="text-xs text-muted-foreground font-mono">
          {formatDateTime(event.feitoEm)}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Por:</span>{" "}
        <span className="font-medium">{event.feitoPorNome}</span>
      </div>
      {event.motivo && (
        <div className="text-sm">
          <span className="text-muted-foreground">Motivo:</span>{" "}
          <span className="italic">{event.motivo}</span>
        </div>
      )}
    </div>
  );
}
