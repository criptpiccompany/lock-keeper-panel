import { useCommissionTier } from "@/hooks/useCommissionTier";
import { Loader2, Flame, Trophy, ArrowUp } from "lucide-react";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  resultado: number;
}

export default function CommissionThermometer({ resultado }: Props) {
  const {
    loading,
    tiers,
    currentTierOrder,
    currentPercentage,
    nextThreshold,
    amountMissing,
    progressInTier,
  } = useCommissionTier(resultado);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0) return null;

  const isMaxTier = currentTierOrder === tiers[tiers.length - 1].tier_order;
  const commissionValue = resultado > 0 ? resultado * (currentPercentage / 100) : 0;

  return (
    <div className="bg-card rounded-xl border border-border/40 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="text-sm font-semibold text-foreground">Comissão Dinâmica</h3>
        </div>
        {isMaxTier && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">
            <Trophy className="h-3 w-3" />
            Tier Máximo
          </div>
        )}
      </div>

      {/* Current percentage + value */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {currentPercentage}%
        </span>
        <span className="text-sm text-muted-foreground">
          = {formatBRL(commissionValue)}
        </span>
      </div>

      {/* Thermometer bar */}
      <div className="space-y-2">
        {/* Tier markers */}
        <div className="relative h-3 rounded-full bg-muted/60 overflow-hidden">
          {/* Overall progress across all tiers */}
          {(() => {
            const maxThreshold = tiers[tiers.length - 1].threshold_result;
            const overallPct = maxThreshold > 0
              ? Math.min(100, Math.max(0, (resultado / maxThreshold) * 100))
              : 100;
            return (
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${overallPct}%`,
                  background: "linear-gradient(90deg, hsl(var(--primary)), hsl(25 95% 53%))",
                }}
              />
            );
          })()}
        </div>

        {/* Tier labels */}
        <div className="flex justify-between">
          {tiers.map((t) => {
            const isActive = t.tier_order <= currentTierOrder;
            const isCurrent = t.tier_order === currentTierOrder;
            return (
              <div
                key={t.tier_order}
                className={`flex flex-col items-center text-center ${
                  isCurrent
                    ? "text-foreground font-semibold"
                    : isActive
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                <span className={`text-[11px] tabular-nums ${isCurrent ? "text-primary font-bold" : ""}`}>
                  {t.percentage}%
                </span>
                <span className="text-[9px] tabular-nums">
                  {t.threshold_result > 0 ? `${(t.threshold_result / 1000).toFixed(0)}k` : "0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next tier info */}
      {!isMaxTier && nextThreshold !== null && amountMissing !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Faltam <strong className="text-foreground">{formatBRL(amountMissing)}</strong> em Resultado
            para atingir <strong className="text-foreground">{tiers.find(t => t.threshold_result === nextThreshold)?.percentage ?? "?"}%</strong>
          </span>
        </div>
      )}

      {/* Base disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 leading-tight">
        Base: Resultado líquido (Faturamento − Investido − Taxa 6%). Resetado automaticamente a cada novo mês.
      </p>
    </div>
  );
}
