import { Badge } from "@/components/ui/badge";
import { InfluencerStatus } from "@/types";
import { Lock, Unlock, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: InfluencerStatus;
  showIcon?: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function StatusBadge({ status, showIcon = true, size = "default", className }: StatusBadgeProps) {
  const config: Record<InfluencerStatus, { label: string; icon: any; className: string }> = {
    TRAVADO: {
      label: "Travado",
      icon: Lock,
      className: "bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-50",
    },
    LIBERADO: {
      label: "Liberado",
      icon: Unlock,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50",
    },
    ARQUIVADO: {
      label: "Arquivado",
      icon: Archive,
      className: "bg-slate-100 text-slate-500 border-slate-200/50 hover:bg-slate-100",
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium",
        size === "sm" && "text-xs px-1.5 py-0",
        statusClassName,
        className
      )}
    >
      {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      {label}
    </Badge>
  );
}
