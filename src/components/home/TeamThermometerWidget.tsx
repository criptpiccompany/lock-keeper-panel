import { useTeamCommission, TeamMemberCommission } from "@/hooks/useTeamCommission";
import { Loader2 } from "lucide-react";
import { useState } from "react";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  month: string;
  compact?: boolean;
}

export default function TeamThermometerWidget({ month, compact = false }: Props) {
  const { members, loading, tiers } = useTeamCommission(month);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tiers.length === 0 || members.length === 0) return null;

  const maxThreshold = tiers[tiers.length - 1].threshold_result;
  const height = compact ? "h-[200px]" : "h-[280px]";

  // Color palette for bubbles
  const bubbleColors = [
    "hsl(220 70% 55%)",
    "hsl(150 50% 45%)",
    "hsl(25 80% 55%)",
    "hsl(280 60% 55%)",
    "hsl(350 65% 55%)",
    "hsl(180 50% 45%)",
    "hsl(45 80% 50%)",
    "hsl(310 55% 50%)",
  ];

  return (
    <div className="flex gap-6 items-stretch">
      {/* Team thermometer */}
      <div className={`relative ${height} w-16 flex-shrink-0`}>
        {/* Glass body */}
        <div className="absolute inset-0 rounded-full border border-border/60 bg-gradient-to-b from-muted/20 to-muted/5 backdrop-blur-sm" />

        {/* Tier markers on the left */}
        {tiers.map((t) => {
          const pct = maxThreshold > 0 ? (t.threshold_result / maxThreshold) * 100 : 0;
          return (
            <div
              key={t.tier_order}
              className="absolute right-full mr-1.5 flex items-center gap-1"
              style={{ bottom: `${pct}%`, transform: "translateY(50%)" }}
            >
              <span className="text-[9px] tabular-nums text-muted-foreground/50">{t.percentage}%</span>
              <div className="w-2 h-px bg-border" />
            </div>
          );
        })}

        {/* Member bubbles */}
        {members.map((m, idx) => {
          const pct = maxThreshold > 0
            ? Math.min(95, Math.max(5, (Math.max(0, m.resultado) / maxThreshold) * 100))
            : 5;
          const color = bubbleColors[idx % bubbleColors.length];
          const isHovered = hoveredId === m.userId;

          return (
            <div
              key={m.userId}
              className="absolute left-1/2 -translate-x-1/2 z-10 cursor-pointer"
              style={{
                bottom: `${pct}%`,
                transform: `translateX(-50%) translateY(50%)`,
                animation: `teamBubbleFloat${idx % 3} 3s ease-in-out infinite`,
                animationDelay: `${idx * 0.4}s`,
              }}
              onMouseEnter={() => setHoveredId(m.userId)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className="flex items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm transition-transform duration-200"
                style={{
                  width: isHovered ? 32 : 26,
                  height: isHovered ? 32 : 26,
                  backgroundColor: color,
                }}
              >
                {m.initials}
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute left-full ml-3 bottom-1/2 translate-y-1/2 z-50 bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[180px] animate-fade-in">
                  <p className="text-xs font-semibold text-foreground">{m.nome}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">
                      % atual: <span className="text-foreground font-medium">{m.currentPercentage}%</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Resultado: <span className="text-foreground font-medium">{formatBRL(m.resultado)}</span>
                    </p>
                    {m.amountMissing !== null && (
                      <p className="text-[10px] text-muted-foreground">
                        Faltam: <span className="text-foreground font-medium">{formatBRL(m.amountMissing)}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bulb */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-border/60 bg-muted/20" />
      </div>

      {/* Legend */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Equipe</p>
        {members.map((m, idx) => (
          <div
            key={m.userId}
            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
            onMouseEnter={() => setHoveredId(m.userId)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: bubbleColors[idx % bubbleColors.length] }}
            />
            <span className="text-foreground font-medium truncate">{m.nome}</span>
            <span className="text-muted-foreground tabular-nums ml-auto">{m.currentPercentage}%</span>
          </div>
        ))}
      </div>

      {/* Bubble float animations */}
      <style>{`
        @keyframes teamBubbleFloat0 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-50%) translateY(calc(50% - 3px)); }
        }
        @keyframes teamBubbleFloat1 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-50%) translateY(calc(50% + 2px)); }
        }
        @keyframes teamBubbleFloat2 {
          0%, 100% { transform: translateX(-50%) translateY(50%); }
          50% { transform: translateX(-45%) translateY(calc(50% - 2px)); }
        }
      `}</style>
    </div>
  );
}
