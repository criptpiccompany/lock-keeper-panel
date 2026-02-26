import { useState } from "react";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { useTeamCommission } from "@/hooks/useTeamCommission";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Rocket } from "lucide-react";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const BUBBLE_COLORS = [
  "hsl(220 65% 55%)",
  "hsl(150 45% 45%)",
  "hsl(25 75% 55%)",
  "hsl(280 55% 55%)",
  "hsl(350 60% 55%)",
  "hsl(180 45% 45%)",
  "hsl(45 75% 50%)",
  "hsl(310 50% 50%)",
];

interface Props {
  resultado: number;
  month: string;
  compact?: boolean;
}

export default function UnifiedThermometerWidget({ resultado, month, compact = false }: Props) {
  const { user, isAdmin } = useAuth();
  const {
    loading: tierLoading,
    tiers,
    currentTierOrder,
    currentPercentage,
    nextThreshold,
    amountMissing,
  } = useCommissionTier(resultado);
  const { members, loading: teamLoading } = useTeamCommission(month, user?.id, isAdmin);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showFinancials, setShowFinancials] = useState(true);

  const loading = tierLoading || teamLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0) return null;

  const maxThreshold = tiers[tiers.length - 1].threshold_result;
  const fillPct = maxThreshold > 0
    ? Math.min(100, Math.max(2, (resultado / maxThreshold) * 100))
    : (resultado > 0 ? 100 : 2);

  const commissionValue = getEstimatedCommission(resultado, currentPercentage);
  const isMax = currentTierOrder === tiers[tiers.length - 1].tier_order;
  const tubeHeight = compact ? 220 : 320;

  const otherMembers = members.filter((m) => m.userId !== user?.id);
  const currentUserMember = members.find((m) => m.userId === user?.id);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Main layout */}
      <div className="flex items-stretch gap-10 w-full max-w-lg mx-auto">
        {/* Thermometer tube */}
        <div className="relative flex-shrink-0" style={{ width: 56, height: tubeHeight }}>
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              border: "1.5px solid hsl(var(--border) / 0.5)",
              background: "linear-gradient(135deg, hsl(var(--muted) / 0.15), hsl(var(--muted) / 0.05))",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-full"
              style={{
                height: `${fillPct}%`,
                background: "linear-gradient(to top, hsl(0 72% 51%), hsl(20 90% 55%), hsl(40 90% 52%))",
                transition: "height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </div>

          {/* Tier tick marks */}
          {tiers.map((t) => {
            const pct = maxThreshold > 0 ? (t.threshold_result / maxThreshold) * 100 : 0;
            const isCurrent = t.tier_order === currentTierOrder;
            return (
              <div
                key={t.tier_order}
                className="absolute right-full mr-2 flex items-center gap-1"
                style={{ bottom: `${pct}%`, transform: "translateY(50%)" }}
              >
                <span
                  className={`text-[10px] tabular-nums ${
                    isCurrent ? "text-foreground font-bold" : "text-muted-foreground/40"
                  }`}
                >
                  {t.percentage}%
                </span>
                <div className={`h-px ${isCurrent ? "w-3 bg-foreground/60" : "w-2 bg-border/60"}`} />
              </div>
            );
          })}

          {/* Current user bubble */}
          {currentUserMember && (
            <div
              className="absolute left-1/2 z-20"
              style={{
                bottom: `${Math.min(93, Math.max(5, fillPct))}%`,
                transform: "translateX(-50%) translateY(50%)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full text-[10px] font-bold shadow-md ring-2 ring-background"
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  animation: "bubbleFloat0 4s ease-in-out infinite",
                }}
              >
                {currentUserMember.initials}
              </div>
            </div>
          )}

          {/* Team member bubbles */}
          {otherMembers.map((m, idx) => {
            // For non-admins, position by tier order (no exact financial position)
            // For admins, use actual resultado position
            const memberPct = (() => {
              if (m.resultado !== null && maxThreshold > 0) {
                return Math.min(93, Math.max(5, (Math.max(0, m.resultado) / maxThreshold) * 100));
              }
              // Position by tier order for non-admins
              const tierForMember = tiers.find((t) => t.tier_order === m.currentTierOrder);
              if (tierForMember && maxThreshold > 0) {
                return Math.min(93, Math.max(5, (tierForMember.threshold_result / maxThreshold) * 100 + 3));
              }
              return 5;
            })();

            const color = BUBBLE_COLORS[idx % BUBBLE_COLORS.length];
            const isHovered = hoveredId === m.userId;
            const xOffset = idx % 2 === 0 ? -6 : 6;

            return (
              <div
                key={m.userId}
                className="absolute z-10 cursor-pointer"
                style={{
                  left: `calc(50% + ${xOffset}px)`,
                  bottom: `${memberPct}%`,
                  transform: "translateX(-50%) translateY(50%)",
                  animation: `bubbleFloat${idx % 3} ${3 + idx * 0.3}s ease-in-out infinite`,
                  animationDelay: `${idx * 0.5}s`,
                }}
                onMouseEnter={() => setHoveredId(m.userId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  className="flex items-center justify-center rounded-full text-[8px] font-bold text-white/90 shadow-sm transition-all duration-200"
                  style={{
                    width: isHovered ? 28 : 22,
                    height: isHovered ? 28 : 22,
                    backgroundColor: color,
                    opacity: isHovered ? 1 : 0.75,
                  }}
                >
                  {m.initials}
                </div>

                {/* Tooltip - respects role permissions */}
                {isHovered && (
                  <div className="absolute left-full ml-3 bottom-1/2 translate-y-1/2 z-50 bg-card border border-border rounded-lg shadow-lg px-3 py-2.5 min-w-[160px] animate-fade-in pointer-events-none">
                    <p className="text-xs font-semibold text-foreground">{m.nome}</p>
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        % atual: <span className="text-foreground font-medium">{m.currentPercentage}%</span>
                      </p>
                      {/* Financial data only visible to ADMIN with toggle on */}
                      {isAdmin && showFinancials && m.resultado !== null && (
                        <>
                          <p className="text-[10px] text-muted-foreground">
                            Resultado: <span className="text-foreground font-medium">{formatBRL(m.resultado)}</span>
                          </p>
                          {m.amountMissing !== null && (
                            <p className="text-[10px] text-muted-foreground">
                              Faltam: <span className="text-foreground font-medium">{formatBRL(m.amountMissing)}</span>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bulb */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full overflow-hidden"
            style={{ border: "1.5px solid hsl(var(--border) / 0.5)" }}
          >
            <div
              className="absolute inset-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                background: fillPct > 3 ? "hsl(0 72% 51%)" : "hsl(var(--muted) / 0.3)",
              }}
            />
          </div>
        </div>

        {/* Info panel - own data only */}
        <div className="flex flex-col justify-center gap-5 min-w-0 py-4">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Sua % do mês</p>
            <p className="text-4xl font-bold tabular-nums text-foreground mt-1">{currentPercentage}%</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Resultado</p>
              <p className={`text-lg font-semibold tabular-nums mt-0.5 ${resultado >= 0 ? "text-foreground" : "text-destructive"}`}>
                {formatBRL(resultado)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Comissão estimada</p>
              <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">
                {formatBRL(commissionValue)}
              </p>
            </div>
          </div>

          {!isMax && nextThreshold !== null && amountMissing !== null && (() => {
            const pctRemaining = nextThreshold > 0 ? (amountMissing / nextThreshold) * 100 : 100;
            const isClose = pctRemaining < 15;
            const isAlmostThere = pctRemaining < 5;
            return (
              <div className={`rounded-lg px-3.5 py-2.5 flex items-center gap-2 ${isClose ? "ring-1 ring-success/30" : ""}`}
                style={{ background: "hsl(142 71% 45% / 0.08)" }}
              >
                <Rocket
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: "hsl(142 71% 45%)", animation: "rocketPulse 2s ease-in-out infinite" }}
                />
                {isAlmostThere ? (
                  <p className="text-[11px] font-semibold leading-relaxed" style={{ color: "hsl(142 71% 45%)" }}>
                    Você está quase lá 🚀
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed" style={{ color: "hsl(142 71% 45%)" }}>
                    Faltam{" "}
                    <span className="font-bold">{formatBRL(amountMissing)}</span> para{" "}
                    <span className="font-semibold">
                      {tiers.find((t) => t.threshold_result === nextThreshold)?.percentage ?? "?"}%
                    </span>
                  </p>
                )}
              </div>
            );
          })()}

          {isMax && (
            <div className="rounded-lg px-3.5 py-2.5" style={{ background: "hsl(45 93% 47% / 0.1)", border: "1px solid hsl(45 93% 47% / 0.2)" }}>
              <p className="text-[11px] font-semibold" style={{ color: "hsl(45 80% 35%)" }}>🏆 Tier máximo atingido</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && members.length > 0 && (
        <div className="w-full max-w-lg mx-auto space-y-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowRanking(!showRanking)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium uppercase tracking-wider"
            >
              {showRanking ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Ver detalhamento completo
            </button>

            <button
              onClick={() => setShowFinancials(!showFinancials)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium ml-auto"
              title={showFinancials ? "Ocultar valores financeiros" : "Mostrar valores financeiros"}
            >
              {showFinancials ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="uppercase tracking-wider">{showFinancials ? "Valores" : "Oculto"}</span>
            </button>
          </div>

          {showRanking && (
            <div className="bg-card rounded-xl border border-border/40 overflow-hidden animate-fade-in">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Membro</th>
                    <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">%</th>
                    {showFinancials && (
                      <>
                        <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resultado</th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Falta</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...members]
                    .sort((a, b) => (b.resultado ?? 0) - (a.resultado ?? 0))
                    .map((m, idx) => (
                      <tr key={m.userId} className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-2 px-4 text-xs text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="py-2 px-4 text-xs font-medium text-foreground">{m.nome}</td>
                        <td className="py-2 px-4 text-xs text-right tabular-nums font-semibold">{m.currentPercentage}%</td>
                        {showFinancials && (
                          <>
                            <td className="py-2 px-4 text-xs text-right tabular-nums">
                              {m.resultado !== null ? formatBRL(m.resultado) : "—"}
                            </td>
                            <td className="py-2 px-4 text-xs text-right tabular-nums text-muted-foreground">
                              {m.amountMissing !== null ? formatBRL(m.amountMissing) : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bubble animations */}
      <style>{`
        @keyframes bubbleFloat0 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-50%) translateY(calc(50% - 3px)); }
        }
        @keyframes bubbleFloat1 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-50%) translateY(calc(50% + 2px)); }
        }
        @keyframes bubbleFloat2 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-48%) translateY(calc(50% - 2px)); }
        }
        @keyframes rocketPulse {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-2px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
