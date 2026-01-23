import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import { InfluencerWithStatus } from "@/types";
import { canRegisterFechamento, formatDate } from "@/lib/helpers";
import { toast } from "sonner";
import { CheckCircle, Lock } from "lucide-react";

interface BotaoRegistrarFechamentoProps {
  influencer: InfluencerWithStatus;
  variant?: "default" | "small" | "icon";
  onSuccess?: () => void;
}

export function BotaoRegistrarFechamento({
  influencer,
  variant = "default",
  onSuccess,
}: BotaoRegistrarFechamentoProps) {
  const { currentUser, registerFechamento } = useStore();
  const canRegister = canRegisterFechamento(influencer, currentUser);

  const handleClick = () => {
    if (!canRegister) return;
    
    registerFechamento(influencer.id);
    toast.success(`Fechamento registrado para ${influencer.handle}`, {
      description: "O influenciador agora está travado para você por 10 dias.",
    });
    onSuccess?.();
  };

  const getTooltipMessage = () => {
    if (influencer.status === "ARQUIVADO") {
      return "Influenciador arquivado";
    }
    if (influencer.status === "TRAVADO" && influencer.ownerId !== currentUser.id) {
      return `Travado por ${influencer.ownerNome} até ${formatDate(influencer.lockedUntil?.toISOString() ?? null)}`;
    }
    if (canRegister) {
      return "Clique para registrar fechamento";
    }
    return "Ação não permitida";
  };

  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={canRegister ? "default" : "ghost"}
            disabled={!canRegister}
            onClick={handleClick}
            className={canRegister ? "bg-primary hover:bg-primary/90" : ""}
          >
            {canRegister ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getTooltipMessage()}</TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "small") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={canRegister ? "default" : "outline"}
            disabled={!canRegister}
            onClick={handleClick}
            className={canRegister ? "bg-primary hover:bg-primary/90" : "cursor-not-allowed opacity-50"}
          >
            {canRegister ? (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Fechar
              </>
            ) : (
              <>
                <Lock className="mr-1 h-3 w-3" />
                Travado
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getTooltipMessage()}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={canRegister ? "default" : "outline"}
          disabled={!canRegister}
          onClick={handleClick}
          className={canRegister ? "bg-primary hover:bg-primary/90" : "cursor-not-allowed opacity-50"}
        >
          {canRegister ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Registrar Fechamento
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Travado
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{getTooltipMessage()}</TooltipContent>
    </Tooltip>
  );
}
