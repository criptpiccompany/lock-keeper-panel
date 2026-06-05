import { useMemo } from "react";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import "./CommissionCard.css";

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
      <span><strong>Nível máximo</strong> desbloqueado</span>
    );

  return (
    <div>
      <div className={`cpic-card-shell ${level.toLowerCase()}`} role="img" aria-label={`Cartão ${level}`}>
        <div className="cpic-card">
          {/* ===== Fundo de segurança — papel-moeda ===== */}
          <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="cpicSec" width="62" height="38" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="19" r="12" fill="none" stroke="var(--line)" strokeWidth="0.8" />
                <circle cx="15" cy="19" r="7.5" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
                <circle cx="15" cy="19" r="3.5" fill="none" stroke="var(--micro)" strokeWidth="0.5" />
                <circle cx="47" cy="19" r="12" fill="none" stroke="var(--line)" strokeWidth="0.8" />
                <circle cx="47" cy="19" r="7.5" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
                <path d="M0 32 C15 20 24 20 38 32 S70 44 78 30" fill="none" stroke="var(--micro)" strokeWidth="0.55" />
                <path d="M0 8 C15 -4 24 -4 38 8 S70 20 78 6" fill="none" stroke="var(--micro)" strokeWidth="0.55" />
              </pattern>
              <pattern id="cpicWeave" width="32" height="12" patternUnits="userSpaceOnUse">
                <path d="M0 6 C8 0 16 12 24 6 S40 0 48 6" fill="none" stroke="var(--micro)" strokeWidth="0.5" />
              </pattern>
              <pattern id="cpicWeave2" width="32" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(10)">
                <path d="M0 6 C8 12 16 0 24 6 S40 12 48 6" fill="none" stroke="var(--micro)" strokeWidth="0.5" />
              </pattern>
              <pattern id="cpicMicro" width="180" height="9" patternUnits="userSpaceOnUse">
                <text x="0" y="7" fontFamily="Arial" fontSize="6.2" fontWeight="900" letterSpacing="0.6" fill="var(--deep)" opacity="0.5">
                  CRIPTPICPERFORMANCECLUBCRIPTPICPERFORMANCECLUB
                </text>
              </pattern>
              <radialGradient id="cpicRosette" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
                <stop offset="60%" stopColor="rgba(0,0,0,0.04)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id="cpicVignette" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="78%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
              </radialGradient>
            </defs>

            <rect width="920" height="580" fill="url(#cpicSec)" opacity="0.95" />
            <rect width="920" height="580" fill="url(#cpicWeave)" opacity="0.7" />
            <rect width="920" height="580" fill="url(#cpicWeave2)" opacity="0.55" />

            {/* roseta concêntrica central */}
            <g transform="translate(460 295)" fill="none" stroke="var(--micro)" strokeWidth="0.7">
              {Array.from({ length: 24 }).map((_, i) => (
                <ellipse key={i} cx="0" cy="0" rx={60 + i * 9} ry={80 + i * 11} opacity={0.4 - i * 0.012} />
              ))}
            </g>

            {/* raios finos saindo do centro */}
            <g transform="translate(460 295)" stroke="var(--micro)" strokeWidth="0.4" opacity="0.5">
              {Array.from({ length: 36 }).map((_, i) => {
                const a = (i * Math.PI) / 18;
                return <line key={i} x1={Math.cos(a) * 60} y1={Math.sin(a) * 80} x2={Math.cos(a) * 360} y2={Math.sin(a) * 360} />;
              })}
            </g>

            {/* faixas de microtexto */}
            <rect x="20" y="555" width="880" height="9" fill="url(#cpicMicro)" opacity="0.9" />
            <rect x="20" y="546" width="880" height="9" fill="url(#cpicMicro)" opacity="0.75" />
            <rect x="20" y="16" width="880" height="9" fill="url(#cpicMicro)" opacity="0.45" />
            <rect x="20" y="25" width="880" height="9" fill="url(#cpicMicro)" opacity="0.32" />

            <rect width="920" height="580" fill="url(#cpicRosette)" />
            <rect width="920" height="580" fill="url(#cpicVignette)" />
          </svg>

          {/* ===== Moldura ornamental refinada ===== */}
          <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
            <rect x="12" y="12" width="896" height="556" rx="14" fill="none" stroke="var(--deep)" strokeWidth="1.8" opacity="0.85" />
            <rect x="20" y="20" width="880" height="540" rx="11" fill="none" stroke="var(--deep)" strokeWidth="0.7" opacity="0.6" />
            <rect x="26" y="26" width="868" height="528" rx="9" fill="none" stroke="var(--micro)" strokeWidth="0.5" opacity="0.7" />

            {/* arabescos de canto */}
            <g fill="none" stroke="var(--deep)" strokeWidth="1.05" opacity="0.9">
              {/* top-left */}
              <path d="M20 70 C20 42 42 20 70 20" />
              <path d="M28 78 C28 50 50 28 78 28" />
              <path d="M44 36 q10 -8 22 -2 M36 44 q-8 10 -2 22" />
              <circle cx="32" cy="32" r="2.2" fill="var(--deep)" />
              {/* top-right */}
              <path d="M900 70 C900 42 878 20 850 20" />
              <path d="M892 78 C892 50 870 28 842 28" />
              <path d="M876 36 q-10 -8 -22 -2 M884 44 q8 10 2 22" />
              <circle cx="888" cy="32" r="2.2" fill="var(--deep)" />
              {/* bottom-left */}
              <path d="M20 510 C20 538 42 560 70 560" />
              <path d="M28 502 C28 530 50 552 78 552" />
              <circle cx="32" cy="548" r="2.2" fill="var(--deep)" />
              {/* bottom-right */}
              <path d="M900 510 C900 538 878 560 850 560" />
              <path d="M892 502 C892 530 870 552 842 552" />
              <circle cx="888" cy="548" r="2.2" fill="var(--deep)" />
            </g>

            {/* arabescos finos no topo e base */}
            <g fill="none" stroke="var(--deep)" strokeWidth="0.55" opacity="0.6">
              <path d="M110 28 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0" />
              <path d="M110 552 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0 q14 -8 28 0" />
            </g>
          </svg>

          {/* ===== Brand ===== */}
          <div className="cpic-brand">{brand}</div>
          <div className="cpic-brand-sub">PERFORMANCE CLUB</div>

          <div className="cpic-progress-track">
            <div className="cpic-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>

          {/* ===== Chip EMV — geometria bancária real ===== */}
          <div className="cpic-chip" aria-hidden="true">
            <svg viewBox="0 0 160 120" preserveAspectRatio="none">
              <g fill="none" stroke="rgba(0,0,0,0.92)" strokeWidth="2.6" strokeLinejoin="round">
                {/* contorno externo */}
                <rect x="3" y="3" width="154" height="114" rx="10" />
                {/* 8 contatos EMV */}
                <line x1="60" y1="3" x2="60" y2="44" />
                <line x1="100" y1="3" x2="100" y2="44" />
                <line x1="60" y1="76" x2="60" y2="117" />
                <line x1="100" y1="76" x2="100" y2="117" />
                <line x1="3" y1="40" x2="46" y2="40" />
                <line x1="114" y1="40" x2="157" y2="40" />
                <line x1="3" y1="80" x2="46" y2="80" />
                <line x1="114" y1="80" x2="157" y2="80" />
                {/* zona central (processador) */}
                <rect x="48" y="42" width="64" height="36" rx="4" />
                <line x1="48" y1="60" x2="112" y2="60" />
                <line x1="80" y1="42" x2="80" y2="78" />
                {/* cantos arredondados dos contatos */}
                <path d="M46 28 q-6 0 -6 -6" />
                <path d="M114 28 q6 0 6 -6" />
                <path d="M46 92 q-6 0 -6 6" />
                <path d="M114 92 q6 0 6 6" />
              </g>
            </svg>
          </div>

          {/* ===== Medalhão — maior, mais profundo, brasão rico ===== */}
          <div className="cpic-medallion" aria-hidden="true">
            <svg viewBox="0 0 200 270" preserveAspectRatio="xMidYMid meet">
              <defs>
                <clipPath id="cpicMedalClip">
                  <ellipse cx="100" cy="135" rx="94" ry="130" />
                </clipPath>
                <pattern id="cpicMedalHatch" width="2.8" height="2.8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                  <line x1="0" y1="0" x2="0" y2="2.8" stroke="var(--deep)" strokeWidth="0.7" opacity="0.95" />
                </pattern>
                <pattern id="cpicMedalHatch2" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
                  <line x1="0" y1="0" x2="0" y2="2.2" stroke="var(--deep)" strokeWidth="0.4" opacity="0.7" />
                </pattern>
                <radialGradient id="cpicMedalBg" cx="50%" cy="45%" r="62%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
                  <stop offset="55%" stopColor="rgba(255,255,255,0.1)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
                </radialGradient>
                <radialGradient id="cpicMedalRim" cx="50%" cy="50%" r="60%">
                  <stop offset="92%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
                </radialGradient>
              </defs>

              {/* fundo cunhado */}
              <ellipse cx="100" cy="135" rx="94" ry="130" fill="url(#cpicMedalBg)" />

              {/* moldura externa engrossada — sensação de relevo metálico */}
              <ellipse cx="100" cy="135" rx="94" ry="130" fill="none" stroke="var(--deep)" strokeWidth="3.4" />
              <ellipse cx="100" cy="135" rx="90" ry="125" fill="none" stroke="var(--emboss-hi)" strokeWidth="0.8" opacity="0.7" />
              <ellipse cx="100" cy="135" rx="86" ry="120" fill="none" stroke="var(--deep)" strokeWidth="1.2" opacity="0.7" />
              <ellipse cx="100" cy="135" rx="82" ry="115" fill="none" stroke="var(--deep)" strokeWidth="0.45" opacity="0.5" />
              <ellipse cx="100" cy="135" rx="94" ry="130" fill="url(#cpicMedalRim)" />

              {/* texto curvo em volta */}
              <defs>
                <path id="cpicArcTop" d="M 18 135 A 82 115 0 0 1 182 135" />
                <path id="cpicArcBot" d="M 18 135 A 82 115 0 0 0 182 135" />
              </defs>
              <text fontFamily="Arial" fontSize="7.2" fontWeight="900" letterSpacing="2.8" fill="var(--deep)" opacity="0.85">
                <textPath href="#cpicArcTop" startOffset="50%" textAnchor="middle">CRIPTPIC · PERFORMANCE</textPath>
              </text>
              <text fontFamily="Arial" fontSize="6.4" fontWeight="900" letterSpacing="3.6" fill="var(--deep)" opacity="0.7">
                <textPath href="#cpicArcBot" startOffset="50%" textAnchor="middle">EST · MMXXIV · CLUB</textPath>
              </text>

              <g clipPath="url(#cpicMedalClip)">
                {/* guilhochê de fundo */}
                <g fill="none" stroke="var(--deep)" strokeWidth="0.35" opacity="0.55">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <path key={i} d={`M-20 ${60 + i * 20} C40 ${40 + i * 20} 80 ${80 + i * 20} 120 ${50 + i * 20} S220 ${30 + i * 20} 280 ${60 + i * 20}`} />
                  ))}
                </g>

                {/* estrelas decorativas */}
                <g fill="var(--deep)" opacity="0.85">
                  <path d="M40 130 l1.4 4 4 .4 -3.2 2.6 1 4 -3.2 -2.4 -3.2 2.4 1 -4 -3.2 -2.6 4 -.4 z" />
                  <path d="M160 130 l1.4 4 4 .4 -3.2 2.6 1 4 -3.2 -2.4 -3.2 2.4 1 -4 -3.2 -2.6 4 -.4 z" />
                </g>

                {/* coroa rica */}
                <g transform="translate(100 64)" stroke="var(--deep)" strokeWidth="1.8">
                  <path fill="url(#cpicMedalHatch)" d="M-38 8 L-38 -8 L-28 6 L-22 -14 L-14 8 L-8 -22 L0 6 L8 -22 L14 8 L22 -14 L28 6 L38 -8 L38 8 Z" />
                  <circle cx="-38" cy="-10" r="2.8" fill="var(--deep)" stroke="none" />
                  <circle cx="-8" cy="-24" r="2.4" fill="var(--deep)" stroke="none" />
                  <circle cx="8" cy="-24" r="2.4" fill="var(--deep)" stroke="none" />
                  <circle cx="38" cy="-10" r="2.8" fill="var(--deep)" stroke="none" />
                  <rect x="-40" y="8" width="80" height="5" rx="1" stroke="var(--deep)" fill="var(--deep)" opacity="0.85" />
                  <rect x="-40" y="14" width="80" height="2" rx="1" stroke="none" fill="var(--deep)" opacity="0.6" />
                </g>

                {/* louros */}
                <g fill="none" stroke="var(--deep)" strokeWidth="1.2" opacity="0.85">
                  <path d="M50 160 q-8 -22 4 -52" />
                  <path d="M150 160 q8 -22 -4 -52" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <g key={i}>
                      <ellipse cx={48 - i} cy={150 - i * 8} rx="5" ry="2.6" transform={`rotate(${-40 - i * 4} ${48 - i} ${150 - i * 8})`} fill="var(--deep)" opacity="0.6" />
                      <ellipse cx={152 + i} cy={150 - i * 8} rx="5" ry="2.6" transform={`rotate(${40 + i * 4} ${152 + i} ${150 - i * 8})`} fill="var(--deep)" opacity="0.6" />
                    </g>
                  ))}
                </g>

                {/* escudo elaborado */}
                <g transform="translate(100 152)">
                  <path
                    d="M-48 -54 L48 -54 Q52 -54 52 -50 L52 -8 C52 32 24 64 0 80 C-24 64 -52 32 -52 -8 L-52 -50 Q-52 -54 -48 -54 Z"
                    fill="url(#cpicMedalHatch2)"
                    stroke="var(--deep)"
                    strokeWidth="3"
                  />
                  <path
                    d="M-40 -46 L40 -46 L40 -10 C40 24 18 50 0 64 C-18 50 -40 24 -40 -10 Z"
                    fill="none"
                    stroke="var(--deep)"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                  {/* chevron interno */}
                  <path d="M-30 -28 L0 -10 L30 -28" fill="none" stroke="var(--deep)" strokeWidth="1.4" opacity="0.7" />
                  <path d="M-30 -18 L0 0 L30 -18" fill="none" stroke="var(--deep)" strokeWidth="1" opacity="0.5" />
                  {/* monograma C robusto */}
                  <path
                    d="M24 -8 C24 -26 8 -38 -10 -38 C-28 -38 -38 -22 -38 -2 C-38 18 -24 32 -6 32 C10 32 22 24 26 12"
                    fill="none"
                    stroke="var(--deep)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path d="M24 -10 L24 2 M24 12 L24 24" stroke="var(--deep)" strokeWidth="7" strokeLinecap="round" />
                  {/* destaque do C */}
                  <path
                    d="M24 -8 C24 -26 8 -38 -10 -38"
                    fill="none"
                    stroke="var(--emboss-hi)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </g>

                {/* faixa PERFORMANCE refinada */}
                <g transform="translate(100 244)">
                  <path d="M-66 0 L66 0 L60 14 L-60 14 Z" fill="rgba(0,0,0,0.12)" stroke="var(--deep)" strokeWidth="1.2" />
                  <path d="M-66 0 L-72 6 L-66 12" fill="rgba(0,0,0,0.18)" stroke="var(--deep)" strokeWidth="1" />
                  <path d="M66 0 L72 6 L66 12" fill="rgba(0,0,0,0.18)" stroke="var(--deep)" strokeWidth="1" />
                  <text x="0" y="10" textAnchor="middle" fontFamily="Arial" fontSize="7.6" fontWeight="900" letterSpacing="2" fill="var(--deep)">
                    PERFORMANCE
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* ===== Números embossados ===== */}
          <div className="cpic-numbers">
            <span className="cpic-num-left">
              {currency} {brNumber(revenue)}
            </span>
            <span className="cpic-num-mid">.</span>
            <span className="cpic-num-right">{shortNumber(target)}</span>
          </div>

          <div className="cpic-meta-left">
            Faturado
            <span className="cpic-meta-value">{progressPct}%</span>
          </div>

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

      <div className="cpic-caption">
        <div className="cpic-caption-main">{captionMain}</div>
        <div className="cpic-caption-sub">Tier {level}</div>
      </div>
    </div>
  );
}
