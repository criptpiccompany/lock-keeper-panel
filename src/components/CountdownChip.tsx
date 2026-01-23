import { useState, useEffect } from "react";
import { formatCountdown } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

interface CountdownChipProps {
  lockedUntil: Date | null;
  className?: string;
}

export function CountdownChip({ lockedUntil, className }: CountdownChipProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!lockedUntil) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const remaining = lockedUntil.getTime() - Date.now();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  if (!lockedUntil || timeRemaining === null) {
    return (
      <span className={cn("text-muted-foreground font-mono text-sm", className)}>
        —
      </span>
    );
  }

  const isExpiringSoon = timeRemaining > 0 && timeRemaining < 2 * 24 * 60 * 60 * 1000; // 2 days
  const isExpired = timeRemaining <= 0;

  return (
    <div
      className={cn(
        "countdown-display inline-flex items-center gap-2",
        isExpired && "text-status-released glow-green",
        isExpiringSoon && !isExpired && "text-status-locked glow-amber pulse-warning",
        !isExpiringSoon && !isExpired && "text-foreground",
        className
      )}
    >
      {isExpiringSoon && !isExpired && <AlertTriangle className="h-4 w-4" />}
      {!isExpiringSoon && !isExpired && <Clock className="h-4 w-4 opacity-50" />}
      <span className="tabular-nums">
        {isExpired ? "EXPIRADO" : formatCountdown(timeRemaining)}
      </span>
    </div>
  );
}
