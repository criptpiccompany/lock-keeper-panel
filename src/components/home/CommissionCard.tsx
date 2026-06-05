import { useMemo } from "react";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import "./CommissionCard.css";

/**
 * Criptpic Performance Card — premium status card driven by the existing
 * commission thermometer (`useCommissionTier`). Layout mirrors a real
 * premium credit card: dense security background, refined ornamental frame,
 * EMV chip, vertical oval medallion, embossed numbers hugging the medallion.
 *
 * The progression caption ("Faltam R$ X para …") is rendered OUTSIDE the
 * card to keep the card surface feeling like a physical object.
 */

const LEVELS = ["SILVER", "GOLD", "PLATINUM", "BLACK", "DIAMOND", "OBSIDIAN"] as const;
type Level = (typeof LEVELS)[number];

function levelFromTierOrder(order: number): Level {
  if (!order || order < 1) return "SILVER";
  return LEVELS[Math.min(order - 1, LEVELS.length - 1)];
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
  employeeName: string;
  resultado: number;
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

  const captionMain =
    amountMissing != null && amountMissing > 0 ? (
      <span>
        Faltam <strong>R$ {brNumber(amountMissing)}</strong> para virar <strong>{nextLevel}</strong>
      </span>
    ) : (
      <span>
        <strong>Nível máximo</strong> desbloqueado
      </span>
    );

  return (
    <div>
      <div className={`cpic-card-shell ${level.toLowerCase()}`} role="img" aria-label={`Cartão ${level}`}>
        <div className="cpic-card">
          {/* Fundo de segurança — alta densidade */}
          <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {/* Padrão denso de moeda — círculos + ondas + microtexto repetido */}
              <pattern id="cpicSec" width="74" height="46" patternUnits="userSpaceOnUse">
                <circle cx="18" cy="23" r="14" fill="none" stroke="var(--line)" strokeWidth="0.7" />
                <circle cx="18" cy="23" r="9" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
                <circle cx="56" cy="23" r="14" fill="none" stroke="var(--line)" strokeWidth="0.7" />
                <circle cx="56" cy="23" r="9" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
                <path d="M0 38 C18 24 28 24 46 38 S82 52 92 36" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
                <path d="M0 10 C18 -4 28 -4 46 10 S82 24 92 8" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
              </pattern>

              {/* Guilhochê fino — curvas senoidais cruzadas */}
              <pattern id="cpicWeave" width="36" height="14" patternUnits="userSpaceOnUse">
                <path d="M0 7 C9 0 18 14 27 7 S45 0 54 7" fill="none" stroke="var(--micro)" strokeWidth="0.45" />
              </pattern>
              <pattern id="cpicWeave2" width="36" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
                <path d="M0 7 C9 14 18 0 27 7 S45 14 54 7" fill="none" stroke="var(--micro)" strokeWidth="0.45" />
              </pattern>

              {/* Microtexto repetido contínuo */}
              <pattern id="cpicMicro" width="190" height="9" patternUnits="userSpaceOnUse">
                <text x="0" y="7" fontFamily="Arial" fontSize="6.4" fontWeight="900" letterSpacing="0.5" fill="var(--deep)" opacity="0.28">
                  CRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUB
                </text>
              </pattern>

              {/* Texto curvo concêntrico no entorno do medalhão */}
              <radialGradient id="cpicVignette" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="80%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
              </radialGradient>
            </defs>

            <rect width="920" height="580" fill="url(#cpicSec)" opacity="0.85" />
            <rect width="920" height="580" fill="url(#cpicWeave)" opacity="0.6" />
            <rect width="920" height="580" fill="url(#cpicWeave2)" opacity="0.45" />

            {/* faixas de microtexto repetidas */}
            <rect x="20" y="555" width="880" height="9" fill="url(#cpicMicro)" opacity="0.85" />
            <rect x="20" y="546" width="880" height="9" fill="url(#cpicMicro)" opacity="0.7" />
            <rect x="20" y="16" width="880" height="9" fill="url(#cpicMicro)" opacity="0.35" />
            <rect x="20" y="25" width="880" height="9" fill="url(#cpicMicro)" opacity="0.25" />

            {/* círculos concêntricos no centro — atrás do medalhão */}
            <g transform="translate(460 295)" fill="none" stroke="var(--micro)" strokeWidth="0.6">
              <ellipse cx="0" cy="0" rx="148" ry="200" />
              <ellipse cx="0" cy="0" rx="132" ry="178" />
              <ellipse cx="0" cy="0" rx="116" ry="158" />
              <ellipse cx="0" cy="0" rx="100" ry="138" />
            </g>

            <rect width="920" height="580" fill="url(#cpicVignette)" />
          </svg>

          {/* Moldura ornamental — fina, dupla, com cantos */}
          <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
            <rect x="14" y="14" width="892" height="552" rx="14" fill="none" stroke="var(--deep)" strokeWidth="1.3" opacity="0.7" />
            <rect x="22" y="22" width="876" height="536" rx="10" fill="none" stroke="var(--deep)" strokeWidth="0.6" opacity="0.5" />

            {/* cantos ornamentais simétricos */}
            <g fill="none" stroke="var(--deep)" strokeWidth="0.9" opacity="0.78">
              <path d="M22 60 C22 38 38 22 60 22" />
              <path d="M898 60 C898 38 882 22 860 22" />
              <path d="M22 520 C22 542 38 558 60 558" />
              <path d="M898 520 C898 542 882 558 860 558" />
              <path d="M30 70 C30 48 48 30 70 30" />
              <path d="M890 70 C890 48 872 30 850 30" />
              <path d="M30 510 C30 532 48 550 70 550" />
              <path d="M890 510 C890 532 872 550 850 550" />
            </g>

            {/* arabescos sutis no topo e base */}
            <g fill="none" stroke="var(--deep)" strokeWidth="0.55" opacity="0.55">
              <path d="M120 30 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0" />
              <path d="M120 550 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0" />
            </g>
          </svg>

          {/* Brand */}
          <div className="cpic-brand">{brand}</div>
          <div className="cpic-brand-sub">PERFORMANCE CLUB</div>

          {/* Progresso fino abaixo da brand */}
          <div className="cpic-progress-track">
            <div className="cpic-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>

          {/* Chip EMV */}
          <div className="cpic-chip" aria-hidden="true">
            <svg viewBox="0 0 160 120" preserveAspectRatio="none">
              {/* contorno do contato EMV: divide em 6 áreas com bordas arredondadas */}
              <g fill="none" stroke="rgba(0,0,0,0.85)" strokeWidth="2.2">
                <path d="M52 4 v40 q0 8 -8 8 h-40" />
                <path d="M52 116 v-40 q0 -8 -8 -8 h-40" />
                <path d="M108 4 v40 q0 8 8 8 h40" />
                <path d="M108 116 v-40 q0 -8 8 -8 h40" />
                {/* divisórias internas */}
                <line x1="80" y1="0" x2="80" y2="44" />
                <line x1="80" y1="76" x2="80" y2="120" />
                <line x1="0" y1="60" x2="44" y2="60" />
                <line x1="116" y1="60" x2="160" y2="60" />
                {/* meio: bloco central */}
                <rect x="60" y="44" width="40" height="32" rx="3" />
              </g>
            </svg>
          </div>

          {/* Medalhão — oval vertical, gravura fina */}
          <div className="cpic-medallion" aria-hidden="true">
            <svg viewBox="0 0 200 270" preserveAspectRatio="xMidYMid meet">
              <defs>
                <clipPath id="cpicMedalClip">
                  <ellipse cx="100" cy="135" rx="92" ry="128" />
                </clipPath>
                <pattern id="cpicMedalHatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
                  <line x1="0" y1="0" x2="0" y2="3.2" stroke="var(--deep)" strokeWidth="0.55" opacity="0.8" />
                </pattern>
                <pattern id="cpicMedalHatch2" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
                  <line x1="0" y1="0" x2="0" y2="2.4" stroke="var(--deep)" strokeWidth="0.35" opacity="0.55" />
                </pattern>
                <radialGradient id="cpicMedalBg" cx="50%" cy="48%" r="58%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                  <stop offset="70%" stopColor="rgba(0,0,0,0.05)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
                </radialGradient>
              </defs>

              {/* fundo */}
              <ellipse cx="100" cy="135" rx="92" ry="128" fill="url(#cpicMedalBg)" />

              {/* moldura oval dupla */}
              <ellipse cx="100" cy="135" rx="92" ry="128" fill="none" stroke="var(--deep)" strokeWidth="2.4" />
              <ellipse cx="100" cy="135" rx="86" ry="120" fill="none" stroke="var(--deep)" strokeWidth="0.9" opacity="0.6" />
              <ellipse cx="100" cy="135" rx="80" ry="113" fill="none" stroke="var(--deep)" strokeWidth="0.5" opacity="0.4" />

              <g clipPath="url(#cpicMedalClip)">
                {/* guilhochê de fundo dentro do medalhão */}
                <g fill="none" stroke="var(--deep)" strokeWidth="0.35" opacity="0.45">
                  <path d="M-20 70 C40 40 80 90 120 60 S220 30 280 60" />
                  <path d="M-20 100 C40 70 80 120 120 90 S220 60 280 90" />
                  <path d="M-20 130 C40 100 80 150 120 120 S220 90 280 120" />
                  <path d="M-20 160 C40 130 80 180 120 150 S220 120 280 150" />
                  <path d="M-20 190 C40 160 80 210 120 180 S220 150 280 180" />
                  <path d="M-20 220 C40 190 80 240 120 210 S220 180 280 210" />
                </g>

                {/* Emblema central: escudo coroado com C estilizado — vetorial, gravura */}
                {/* coroa */}
                <g transform="translate(100 70)" fill="url(#cpicMedalHatch)" stroke="var(--deep)" strokeWidth="1.6">
                  <path d="M-32 6 L-32 -10 L-20 4 L-12 -16 L-4 6 L0 -22 L4 6 L12 -16 L20 4 L32 -10 L32 6 Z" />
                  <circle cx="-32" cy="-12" r="2.6" fill="var(--deep)" stroke="none" />
                  <circle cx="0" cy="-24" r="3" fill="var(--deep)" stroke="none" />
                  <circle cx="32" cy="-12" r="2.6" fill="var(--deep)" stroke="none" />
                  <rect x="-34" y="6" width="68" height="5" rx="1" stroke="var(--deep)" />
                </g>

                {/* escudo */}
                <g transform="translate(100 150)">
                  <path
                    d="M-46 -52 L46 -52 L46 -8 C46 30 22 60 0 76 C-22 60 -46 30 -46 -8 Z"
                    fill="url(#cpicMedalHatch2)"
                    stroke="var(--deep)"
                    strokeWidth="2.6"
                  />
                  <path
                    d="M-38 -44 L38 -44 L38 -10 C38 22 18 48 0 62 C-18 48 -38 22 -38 -10 Z"
                    fill="none"
                    stroke="var(--deep)"
                    strokeWidth="0.8"
                    opacity="0.55"
                  />
                  {/* monograma "C" estilizado */}
                  <path
                    d="M22 -10 C22 -26 8 -36 -8 -36 C-26 -36 -36 -22 -36 -4 C-36 16 -22 30 -6 30 C8 30 18 22 22 12"
                    fill="none"
                    stroke="var(--deep)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* serifa do C */}
                  <path d="M22 -12 L22 0 M22 10 L22 22" stroke="var(--deep)" strokeWidth="6" strokeLinecap="round" />
                </g>

                {/* faixa "PERFORMANCE" abaixo do escudo */}
                <g transform="translate(100 232)">
                  <path d="M-58 0 L58 0 L52 12 L-52 12 Z" fill="rgba(0,0,0,0.05)" stroke="var(--deep)" strokeWidth="1" />
                  <text x="0" y="9" textAnchor="middle" fontFamily="Arial" fontSize="7.2" fontWeight="900" letterSpacing="1" fill="var(--deep)">
                    PERFORMANCE
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* Números embossados — abraçam o medalhão (esquerda: revenue, direita: target) */}
          <div className="cpic-numbers">
            <span className="cpic-num-left">
              {currency} {brNumber(revenue)}
            </span>
            <span className="cpic-num-mid">.</span>
            <span className="cpic-num-right">{shortNumber(target)}</span>
          </div>

          {/* Faturado % — equivalente a "VALID THRU" do Amex */}
          <div className="cpic-meta-left">
            Faturado
            <span className="cpic-meta-value">{progressPct}%</span>
          </div>

          {/* Comissão — equivalente a "MEMBER SINCE" */}
          <div className="cpic-since">
            <div className="cpic-ribbon">COMISSÃO</div>
            <span className="cpic-year">{currentPercentage}%</span>
          </div>

          <div className="cpic-name">{employeeName}</div>
          <div className="cpic-level">{level}</div>

          <div className="cpic-microbrand">
            CRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUB
          </div>
          <div className="cpic-copyright">© CPIC</div>
        </div>
      </div>

      {/* Caption FORA do cartão (psicologia de progressão) */}
      <div className="cpic-caption">
        <div className="cpic-caption-main">{captionMain}</div>
        <div className="cpic-caption-sub">Tier {level}</div>
      </div>
    </div>
  );
}
