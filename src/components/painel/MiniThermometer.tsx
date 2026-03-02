import type { CommissionTier } from "@/hooks/useCommissionTier";

interface Props {
  result: number;
  percentage: number;
  tiers: CommissionTier[];
}

export default function MiniThermometer({ result, percentage, tiers }: Props) {
  if (tiers.length === 0) return null;

  const maxThreshold = tiers[tiers.length - 1].threshold_result;
  const fillPct = maxThreshold > 0
    ? Math.min(100, Math.max(2, (Math.max(0, result) / maxThreshold) * 100))
    : 2;

  // Tier-based color mapping
  const tierColorMap: Record<number, string> = {
    15: "hsl(0 72% 48%)",
    20: "hsl(25 95% 48%)",
    25: "hsl(45 93% 42%)",
    30: "hsl(142 71% 40%)",
    33: "hsl(150 80% 28%)",
    35: "hsl(45 85% 42%)",
  };

  let tierIdx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (result >= tiers[i].threshold_result) {
      tierIdx = i;
      break;
    }
  }
  const tierColor = tierColorMap[tiers[tierIdx]?.percentage] || "hsl(0 72% 48%)";

  return (
    <div className="flex items-end gap-1.5">
      {/* Mini tube */}
      <div className="relative w-3 h-20 rounded-full border border-border/50 bg-muted/30 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500"
          style={{
            height: `${fillPct}%`,
            background: `linear-gradient(to top, ${tierColor}, ${tierColor}dd)`,
          }}
        />
        {/* Tier markers */}
        {tiers.slice(1).map((t) => {
          const pct = maxThreshold > 0 ? (t.threshold_result / maxThreshold) * 100 : 0;
          return (
            <div
              key={t.tier_order}
              className="absolute left-0 right-0 h-px bg-border/40"
              style={{ bottom: `${pct}%` }}
            />
          );
        })}
      </div>
      {/* Label */}
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
        {percentage}%
      </span>
    </div>
  );
}
