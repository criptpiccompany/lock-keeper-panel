import { Badge } from "@/components/ui/badge";
import { InfluencerStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Lock, Unlock, Archive } from "lucide-react";

interface StatusBadgeProps {
  status: InfluencerStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  TRAVADO: {
    label: "TRAVADO",
    icon: Lock,
    className: "bg-status-locked/20 text-status-locked border-status-locked/50",
  },
  LIBERADO: {
    label: "LIBERADO",
    icon: Unlock,
    className: "bg-status-released/20 text-status-released border-status-released/50",
  },
  ARQUIVADO: {
    label: "ARQUIVADO",
    icon: Archive,
    className: "bg-status-archived/20 text-status-archived border-status-archived/50",
  },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-xs font-semibold uppercase tracking-wider",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
