import { useCommissionTier } from "@/hooks/useCommissionTier";
import { Loader2 } from "lucide-react";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  resultado: number;
  compact?: boolean;
}

export default function ThermometerWidget({ resultado, compact = false }: Props) {
  const {
    loading,
    tiers,
    currentTierOrder,
    currentPercentage,
    nextThreshold,
    amountMissing,
  } = useCommissionTier(resultado);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0) return null;

  const maxThreshold = tiers[tiers.length - 1].threshold_result;
  const fillPct = maxThreshold > 0
    ? Math.min(100, Math.max(2, (resultado / maxThreshold) * 100))
    : (resultado > 0 ? 100 : 2);

  const commissionValue = resultado > 0 ? resultado * (currentPercentage / 100) : 0;
  const isMax = currentTierOrder === tiers[tiers.length - 1].tier_order;
  const height = compact ? "h-[200px]" : "h-[280px]";

  return (
    <div className="flex gap-6 items-stretch">
      {/* Thermometer */}
      <div className={`relative ${height} w-14 flex-shrink-0`}>
        {/* Glass body */}
        <div className="absolute inset-0 rounded-full border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 backdrop-blur-sm overflow-hidden">
          {/* Mercury fill */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000 ease-out"
            style={{
              height: `${fillPct}%`,
              background: `linear-gradient(to top, hsl(0 72% 51%), hsl(25 95% 53%), hsl(45 93% 47%))`,
            }}
          />
        </div>

        {/* Tier markers */}
        {tiers.map((t) => {
          const pct = maxThreshold > 0 ? (t.threshold_result / maxThreshold) * 100 : 0;
          const isCurrent = t.tier_order === currentTierOrder;
          return (
            <div
              key={t.tier_order}
              className="absolute left-full ml-1.5 flex items-center gap-1"
              style={{ bottom: `${pct}%`, transform: "translateY(50%)" }}
            >
              <div className={`w-2 h-px ${isCurrent ? "bg-foreground" : "bg-border"}`} />
              <span
                className={`text-[10px] tabular-nums whitespace-nowrap ${
                  isCurrent ? "text-foreground font-bold" : "text-muted-foreground/60"
                }`}
              >
                {t.percentage}%
              </span>
            </div>
          );
        })}

        {/* Bulb at bottom */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 overflow-hidden">
          <div
            className="absolute inset-0 rounded-full transition-all duration-1000 ease-out"
            style={{
              background: fillPct > 5 ? "hsl(0 72% 51%)" : "hsl(var(--muted))",
            }}
          />
        </div>
      </div>

      {/* Info panel */}
      <div className="flex flex-col justify-center gap-3 min-w-0">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Sua % do mês</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{currentPercentage}%</p>
        </div>

        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Resultado do mês</p>
          <p className={`text-base font-semibold tabular-nums ${resultado >= 0 ? "text-foreground" : "text-destructive"}`}>
            {formatBRL(resultado)}
          </p>
        </div>

        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Comissão estimada</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {formatBRL(commissionValue)}
          </p>
        </div>

        {!isMax && nextThreshold !== null && amountMissing !== null && (
          <div className="bg-muted/40 rounded-lg px-3 py-2 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              Faltam <span className="text-foreground font-semibold">{formatBRL(amountMissing)}</span> para {tiers.find(t => t.threshold_result === nextThreshold)?.percentage ?? "?"}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              Próxima meta: <span className="text-foreground font-semibold">{formatBRL(nextThreshold)}</span>
            </p>
          </div>
        )}

        {isMax && (
          <div className="bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-800">🏆 Tier máximo atingido!</p>
          </div>
        )}
      </div>
    </div>
  );
}
