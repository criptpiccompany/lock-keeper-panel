import { useState, useEffect } from "react";
import { formatCountdown } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface CountdownChipProps {
  lockedUntil: Date | null;
  daysRemaining?: number | null;
  variant?: "default" | "compact";
  className?: string;
}

export function CountdownChip({ lockedUntil, daysRemaining, variant = "default", className }: CountdownChipProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!lockedUntil) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const remaining = lockedUntil.getTime() - new Date().getTime();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  if (!lockedUntil || timeRemaining === null || timeRemaining <= 0) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>—</span>
    );
  }

  const isExpiringSoon = daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 2;

  if (variant === "compact") {
    return (
      <span className={cn(
        "text-sm tabular-nums",
        isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground",
        className
      )}>
        {daysRemaining}d
      </span>
    );
  }

  return (
    <span className={cn(
      "text-sm tabular-nums",
      isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground",
      className
    )}>
      {formatCountdown(timeRemaining)}
    </span>
  );
}
