import { useMemo } from "react";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import "./CommissionCard.css";

/**
 * Premium "Performance Club" card — visual representation of the existing
 * commission thermometer. Pulls tier, percentage and progress straight from
 * `useCommissionTier`, so it never duplicates business logic.
 */

const LEVELS = ["SILVER", "GOLD", "PLATINUM", "BLACK", "DIAMOND", "OBSIDIAN"] as const;
type Level = (typeof LEVELS)[number];

function levelFromTierOrder(order: number): Level {
  if (!order || order < 1) return "SILVER";
  const idx = Math.min(order - 1, LEVELS.length - 1);
  return LEVELS[idx];
}

function brNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.max(0, value));
}

function shortNumber(value: number) {
  const v = Math.max(0, value);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(".0", "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

export interface CommissionCardProps {
  /** Nome gravado na parte inferior do cartão */
  employeeName: string;
  /** "Resultado" atual do mês (mesma métrica que alimenta o termômetro) */
  resultado: number;
  /** Faturamento bruto do mês (exibido como valor principal do cartão) */
  revenue: number;
  currency?: string;
  brand?: string;
}

export function CommissionCard({
  employeeName,
  resultado,
  revenue,
  currency = "R$",
  brand = "CRIPTPIC",
}: CommissionCardProps) {
  const { currentTierOrder, currentPercentage, nextThreshold, amountMissing, progressInTier } =
    useCommissionTier(resultado);

  const level = useMemo(() => levelFromTierOrder(currentTierOrder), [currentTierOrder]);
  const nextLevel = useMemo(
    () => (currentTierOrder > 0 ? levelFromTierOrder(currentTierOrder + 1) : "GOLD"),
    [currentTierOrder]
  );

  const progressPct = Math.round(progressInTier * 100);
  const target = nextThreshold ?? Math.max(revenue, resultado, 1);

  const missingLabel =
    amountMissing != null && amountMissing > 0
      ? `Faltam R$ ${brNumber(amountMissing)} para ${nextLevel}`
      : "Nível máximo desbloqueado";

  return (
    <div className={`cpic-card-shell ${level.toLowerCase()}`} role="img" aria-label={`Cartão ${level}`}>
      <div className="cpic-card">
        {/* Fundo de segurança */}
        <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="cpicSec" width="184" height="116" patternUnits="userSpaceOnUse">
              <circle cx="46" cy="58" r="40" fill="none" stroke="var(--line)" strokeWidth="2" />
              <circle cx="46" cy="58" r="28" fill="none" stroke="var(--micro)" strokeWidth="1.4" />
              <path d="M4 76 C28 48 62 48 86 76 S144 104 180 72" fill="none" stroke="var(--line)" strokeWidth="1.8" />
              <path d="M2 29 C30 5 61 7 88 31 S144 55 184 24" fill="none" stroke="var(--line)" strokeWidth="1.6" />
              <path
                d="M95 16 h76 q10 0 10 10 v14 q0 10-10 10 h-76 q-10 0-10-10 v-14 q0-10 10-10z"
                fill="none"
                stroke="var(--micro)"
                strokeWidth="2"
              />
              <text x="91" y="38" fontFamily="Arial" fontSize="13" fontWeight="800" fill="var(--micro)">
                CRIPTPIC
              </text>
              <text x="8" y="63" fontFamily="Arial" fontSize="13" fontWeight="800" fill="var(--micro)">
                WORLD SCALE
              </text>
            </pattern>
            <pattern id="cpicLines" width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M0 18 C4 4 14 4 18 18" fill="none" stroke="var(--micro)" strokeWidth="1" />
            </pattern>
            <pattern id="cpicMicro" width="295" height="18" patternUnits="userSpaceOnUse">
              <text x="0" y="12" fontFamily="Arial" fontSize="10" fontWeight="900" fill="var(--deep)" opacity=".23">
                CRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUB
              </text>
            </pattern>
          </defs>
          <rect width="920" height="580" fill="url(#cpicSec)" opacity=".95" />
          <rect width="920" height="580" fill="url(#cpicLines)" opacity=".45" />
          <rect x="43" y="545" width="835" height="18" fill="url(#cpicMicro)" opacity=".78" />
          <rect x="43" y="22" width="835" height="18" fill="url(#cpicMicro)" opacity=".22" />
        </svg>

        {/* Moldura ornamental */}
        <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
          <rect x="34" y="32" width="852" height="516" rx="4" fill="none" stroke="var(--deep)" strokeWidth="5" />
          <rect x="48" y="47" width="824" height="486" rx="2" fill="none" stroke="var(--deep)" strokeWidth="1.5" opacity=".45" />
          <g fill="none" stroke="var(--deep)" strokeWidth="4.5" strokeLinecap="round">
            <path d="M35 36 C60 31 65 50 50 62 C80 56 82 90 48 91 C76 103 58 128 35 111" />
            <path d="M885 36 C860 31 855 50 870 62 C840 56 838 90 872 91 C844 103 862 128 885 111" />
            <path d="M35 544 C60 549 65 530 50 518 C80 524 82 490 48 489 C76 477 58 452 35 469" />
            <path d="M885 544 C860 549 855 530 870 518 C840 524 838 490 872 489 C844 477 862 452 885 469" />
          </g>
          <g fill="none" stroke="var(--deep)" strokeWidth="3" opacity=".82">
            <path d="M76 34 C124 6 169 61 224 31 C288 0 341 58 402 32 C471 2 529 57 588 32 C651 5 716 55 844 34" />
            <path d="M76 546 C124 574 169 519 224 549 C288 580 341 522 402 548 C471 578 529 523 588 548 C651 575 716 525 844 546" />
            <path d="M35 130 C62 170 34 219 54 274 C73 326 50 379 35 449" />
            <path d="M885 130 C858 170 886 219 866 274 C847 326 870 379 885 449" />
          </g>
        </svg>

        <div className="cpic-brand">{brand}</div>
        <div className="cpic-brand-sub">PERFORMANCE CLUB</div>

        <div className="cpic-chip" aria-hidden="true">
          <svg viewBox="0 0 160 124" preserveAspectRatio="none">
            <path
              d="M2 43 h48 q16 0 16-16 V2 M2 80 h48 q16 0 16 16 v26 M158 43 h-48 q-16 0-16-16 V2 M158 80 h-48 q-16 0-16 16 v26"
              fill="none"
              stroke="#111"
              strokeWidth="3"
            />
            <path d="M0 62 h55 M105 62 h55 M80 0 v38 M80 86 v38" fill="none" stroke="#111" strokeWidth="2" />
            <path d="M66 38 C72 44 88 44 94 38 M66 86 C72 80 88 80 94 86" fill="none" stroke="#111" strokeWidth="2" />
          </svg>
        </div>

        <div className="cpic-medallion" aria-hidden="true">
          <svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet">
            <defs>
              <clipPath id="cpicCoin">
                <circle cx="120" cy="120" r="118" />
              </clipPath>
              <pattern id="cpicHatchA" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="var(--deep)" strokeWidth="1.2" opacity=".75" />
              </pattern>
              <pattern id="cpicHatchB" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--deep)" strokeWidth=".85" opacity=".6" />
              </pattern>
            </defs>
            <g clipPath="url(#cpicCoin)">
              <rect width="240" height="240" fill="rgba(255,255,255,.08)" />
              <circle cx="120" cy="120" r="108" fill="none" stroke="var(--deep)" strokeWidth="4" />
              <circle cx="120" cy="120" r="94" fill="none" stroke="var(--deep)" strokeWidth="1.4" opacity=".55" />
              <path
                d="M65 191 C55 151 54 99 76 63 C96 29 139 22 169 48 C136 45 112 54 97 78 C118 69 150 75 172 94 C138 88 109 101 95 127 C120 119 151 126 174 150 C139 143 112 151 91 180 C84 190 76 195 65 191Z"
                fill="url(#cpicHatchA)"
                stroke="var(--deep)"
                strokeWidth="4"
              />
              <path
                d="M76 64 C65 54 50 60 42 80 C58 75 72 81 82 95"
                fill="url(#cpicHatchB)"
                stroke="var(--deep)"
                strokeWidth="4"
              />
              <path d="M96 78 C119 50 145 45 169 48" fill="none" stroke="var(--deep)" strokeWidth="6" />
              <path d="M95 127 C116 104 146 109 174 150" fill="none" stroke="var(--deep)" strokeWidth="5" />
              <path d="M84 190 L57 234 M101 188 L91 238 M119 180 L132 236" stroke="var(--deep)" strokeWidth="7" opacity=".95" />
            </g>
          </svg>
        </div>

        <div className="cpic-numbers">
          <span>{currency}</span>
          <span>{brNumber(revenue)}</span>
          <span>{shortNumber(target)}</span>
        </div>

        <div className="cpic-valid">
          Faturado
          <span className="cpic-date">{progressPct}%</span>
        </div>

        <div className="cpic-since">
          <div className="cpic-ribbon">COMISSÃO</div>
          <span className="cpic-year">{currentPercentage}%</span>
        </div>

        <div className="cpic-name">{employeeName}</div>
        <div className="cpic-missing">{missingLabel}</div>
        <div className="cpic-level">{level}</div>

        <div className="cpic-microbrand">
          CRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUB
        </div>
        <div className="cpic-copyright">© CPIC</div>

        <div className="cpic-progress-track">
          <div className="cpic-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  );
}
