import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("brand-chip", compact && "brand-chip-compact", className)}>
      <div className="brand-mark">
        <span>IB</span>
      </div>
      <div className="min-w-0">
        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground">
          InfluBoard
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          Lock Keeper Panel
        </p>
      </div>
    </div>
  );
}
