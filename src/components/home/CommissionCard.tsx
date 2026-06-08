import { useEffect, useMemo, useRef } from "react";
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
  if (v >= 1_000_000) {
    const n = v / 1_000_000;
    return `${(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toString().replace(".", ",")}M`;
  }
  if (v >= 1_000) {
    const n = v / 1_000;
    return `${(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toString().replace(".", ",")}k`;
  }
  return String(Math.round(v));
}
function shortCurrency(value: number, currency: string) {
  return `${currency} ${shortNumber(value)}`;
}


// ----------------- Pure visual card face -----------------
interface CardFaceProps {
  brand: string;
  employeeName: string;
  level: Level;
  percentage: number;
  revenue: number;
  target: number;
  currency: string;
  progressPct: number;
  showProgress: boolean;
}

function CardFace({
  brand,
  employeeName,
  level,
  percentage,
  revenue,
  target,
  currency,
  progressPct,
  showProgress,
}: CardFaceProps) {
  return (
    <div className={`cpic-card-shell ${level.toLowerCase()}`} role="img" aria-label={`Cartão ${level}`}>
      <div className="cpic-card">
        {/* Background pattern */}
        <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id={`cpicSec-${level}`} width="62" height="38" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="19" r="12" fill="none" stroke="var(--line)" strokeWidth="0.8" />
              <circle cx="15" cy="19" r="7.5" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
              <circle cx="47" cy="19" r="12" fill="none" stroke="var(--line)" strokeWidth="0.8" />
              <circle cx="47" cy="19" r="7.5" fill="none" stroke="var(--micro)" strokeWidth="0.6" />
              <path d="M0 32 C15 20 24 20 38 32 S70 44 78 30" fill="none" stroke="var(--micro)" strokeWidth="0.55" />
              <path d="M0 8 C15 -4 24 -4 38 8 S70 20 78 6" fill="none" stroke="var(--micro)" strokeWidth="0.55" />
            </pattern>
            <pattern id={`cpicWeave-${level}`} width="32" height="12" patternUnits="userSpaceOnUse">
              <path d="M0 6 C8 0 16 12 24 6 S40 0 48 6" fill="none" stroke="var(--micro)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id={`cpicVignette-${level}`} cx="50%" cy="50%" r="65%">
              <stop offset="78%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
            </radialGradient>
          </defs>
          <rect width="920" height="580" fill={`url(#cpicSec-${level})`} opacity="0.9" />
          <rect width="920" height="580" fill={`url(#cpicWeave-${level})`} opacity="0.6" />
          <g transform="translate(460 295)" fill="none" stroke="var(--micro)" strokeWidth="0.6">
            {Array.from({ length: 18 }).map((_, i) => (
              <ellipse key={i} cx="0" cy="0" rx={60 + i * 11} ry={80 + i * 13} opacity={0.35 - i * 0.013} />
            ))}
          </g>
          <rect width="920" height="580" fill={`url(#cpicVignette-${level})`} />
        </svg>

        {/* Frame */}
        <svg className="cpic-bg" viewBox="0 0 920 580" preserveAspectRatio="none" aria-hidden="true">
          <rect x="12" y="12" width="896" height="556" rx="14" fill="none" stroke="var(--deep)" strokeWidth="1.6" opacity="0.85" />
          <rect x="20" y="20" width="880" height="540" rx="11" fill="none" stroke="var(--deep)" strokeWidth="0.6" opacity="0.55" />
          <g fill="none" stroke="var(--deep)" strokeWidth="1" opacity="0.85">
            <path d="M20 70 C20 42 42 20 70 20" />
            <path d="M900 70 C900 42 878 20 850 20" />
            <path d="M20 510 C20 538 42 560 70 560" />
            <path d="M900 510 C900 538 878 560 850 560" />
          </g>
        </svg>

        {/* ZONE 1 — TOP: brand + sub */}
        <div className="cpic-brand">{brand}</div>
        <div className="cpic-brand-sub">PERFORMANCE CLUB</div>

        {showProgress && (
          <div className="cpic-progress-track">
            <div className="cpic-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        {/* ZONE 2 — CENTER: chip + medallion + numbers */}
        <div className="cpic-chip" aria-hidden="true">
          <svg viewBox="0 0 160 120" preserveAspectRatio="none">
            <g fill="none" stroke="rgba(0,0,0,0.92)" strokeWidth="2.6" strokeLinejoin="round">
              <rect x="3" y="3" width="154" height="114" rx="10" />
              <line x1="60" y1="3" x2="60" y2="44" />
              <line x1="100" y1="3" x2="100" y2="44" />
              <line x1="60" y1="76" x2="60" y2="117" />
              <line x1="100" y1="76" x2="100" y2="117" />
              <line x1="3" y1="40" x2="46" y2="40" />
              <line x1="114" y1="40" x2="157" y2="40" />
              <line x1="3" y1="80" x2="46" y2="80" />
              <line x1="114" y1="80" x2="157" y2="80" />
              <rect x="48" y="42" width="64" height="36" rx="4" />
              <line x1="48" y1="60" x2="112" y2="60" />
              <line x1="80" y1="42" x2="80" y2="78" />
            </g>
          </svg>
        </div>

        <div className="cpic-medallion" aria-hidden="true">
          <svg viewBox="0 0 200 270" preserveAspectRatio="xMidYMid meet">
            <defs>
              <clipPath id={`cpicMedalClip-${level}`}>
                <ellipse cx="100" cy="135" rx="94" ry="130" />
              </clipPath>
              <pattern id={`cpicMedalHatch-${level}`} width="2.8" height="2.8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                <line x1="0" y1="0" x2="0" y2="2.8" stroke="var(--deep)" strokeWidth="0.7" opacity="0.95" />
              </pattern>
              <radialGradient id={`cpicMedalBg-${level}`} cx="50%" cy="45%" r="62%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.78)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.1)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
              </radialGradient>
              <path id={`cpicArcTop-${level}`} d="M 18 135 A 82 115 0 0 1 182 135" />
              <path id={`cpicArcBot-${level}`} d="M 18 135 A 82 115 0 0 0 182 135" />
            </defs>

            <ellipse cx="100" cy="135" rx="94" ry="130" fill={`url(#cpicMedalBg-${level})`} />
            <ellipse cx="100" cy="135" rx="94" ry="130" fill="none" stroke="var(--deep)" strokeWidth="3" />
            <ellipse cx="100" cy="135" rx="86" ry="120" fill="none" stroke="var(--deep)" strokeWidth="1" opacity="0.7" />

            <text fontFamily="Arial" fontSize="7" fontWeight="900" letterSpacing="2.8" fill="var(--deep)" opacity="0.85">
              <textPath href={`#cpicArcTop-${level}`} startOffset="50%" textAnchor="middle">
                CRIPTPIC · PERFORMANCE
              </textPath>
            </text>
            <text fontFamily="Arial" fontSize="6" fontWeight="900" letterSpacing="3.4" fill="var(--deep)" opacity="0.7">
              <textPath href={`#cpicArcBot-${level}`} startOffset="50%" textAnchor="middle">
                EST · MMXXIV · CLUB
              </textPath>
            </text>

            <g clipPath={`url(#cpicMedalClip-${level})`}>
              <g transform="translate(100 64)" stroke="var(--deep)" strokeWidth="1.8">
                <path fill={`url(#cpicMedalHatch-${level})`} d="M-38 8 L-38 -8 L-28 6 L-22 -14 L-14 8 L-8 -22 L0 6 L8 -22 L14 8 L22 -14 L28 6 L38 -8 L38 8 Z" />
                <circle cx="-38" cy="-10" r="2.8" fill="var(--deep)" stroke="none" />
                <circle cx="-8" cy="-24" r="2.4" fill="var(--deep)" stroke="none" />
                <circle cx="8" cy="-24" r="2.4" fill="var(--deep)" stroke="none" />
                <circle cx="38" cy="-10" r="2.8" fill="var(--deep)" stroke="none" />
                <rect x="-40" y="8" width="80" height="5" rx="1" stroke="var(--deep)" fill="var(--deep)" opacity="0.85" />
              </g>

              <g transform="translate(100 152)">
                <path
                  d="M-48 -54 L48 -54 Q52 -54 52 -50 L52 -8 C52 32 24 64 0 80 C-24 64 -52 32 -52 -8 L-52 -50 Q-52 -54 -48 -54 Z"
                  fill={`url(#cpicMedalHatch-${level})`}
                  stroke="var(--deep)"
                  strokeWidth="3"
                />
                <path d="M-30 -28 L0 -10 L30 -28" fill="none" stroke="var(--deep)" strokeWidth="1.4" opacity="0.7" />
                <path
                  d="M24 -8 C24 -26 8 -38 -10 -38 C-28 -38 -38 -22 -38 -2 C-38 18 -24 32 -6 32 C10 32 22 24 26 12"
                  fill="none"
                  stroke="var(--deep)"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </g>

              <g transform="translate(100 244)">
                <path d="M-66 0 L66 0 L60 14 L-60 14 Z" fill="rgba(0,0,0,0.12)" stroke="var(--deep)" strokeWidth="1.2" />
                <text x="0" y="10" textAnchor="middle" fontFamily="Arial" fontSize="7.6" fontWeight="900" letterSpacing="2" fill="var(--deep)">
                  PERFORMANCE
                </text>
              </g>
            </g>
          </svg>
        </div>

        <div className="cpic-numbers">
          <span className="cpic-num-left">{shortCurrency(revenue, currency)}</span>
          <span className="cpic-num-mid" />
          <span className="cpic-num-right">{shortNumber(target)}</span>
        </div>


        {/* ZONE 3 — BOTTOM */}
        <div className="cpic-footer-left">
          <div className="cpic-foot-label">FATURADO</div>
          <div className="cpic-foot-value">{progressPct}%</div>
          <div className="cpic-name">{employeeName}</div>
        </div>

        <div className="cpic-footer-right">
          <div className="cpic-foot-label">COMISSÃO</div>
          <div className="cpic-foot-value">{percentage}%</div>
          <div className="cpic-tier">{level}</div>
        </div>
      </div>
    </div>
  );
}

// ----------------- Single (legacy) export -----------------
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

  return (
    <div>
      <CardFace
        brand={brand}
        employeeName={employeeName}
        level={level}
        percentage={currentPercentage}
        revenue={revenue}
        target={target}
        currency={currency}
        progressPct={progressPct}
        showProgress
      />
      <div className="cpic-caption">
        <div className="cpic-caption-main">
          {amountMissing != null && amountMissing > 0 ? (
            <span>
              Faltam <strong>R$ {brNumber(amountMissing)}</strong> para virar <strong>{nextLevel}</strong>
            </span>
          ) : (
            <span>
              <strong>Nível máximo</strong> desbloqueado
            </span>
          )}
        </div>
        <div className="cpic-caption-sub">Tier {level}</div>
      </div>
    </div>
  );
}

// ----------------- Carousel export -----------------
const LEVEL_SEQUENCE: Level[] = ["SILVER", "GOLD", "PLATINUM", "BLACK", "DIAMOND", "OBSIDIAN"];
function levelForIndex(i: number): Level {
  return LEVEL_SEQUENCE[Math.min(i, LEVEL_SEQUENCE.length - 1)];
}

export function CommissionCardCarousel({
  employeeName,
  resultado,
  revenue,
  currency = "R$",
  brand = "CRIPTPIC",
}: CommissionCardProps) {
  const { tiers, currentTierOrder, currentPercentage, nextThreshold, amountMissing, progressInTier } =
    useCommissionTier(resultado);

  // Find current tier INDEX inside tiers array (not tier_order, which may start at 0)
  const currentIdx = useMemo(() => {
    if (tiers.length === 0) return 0;
    const idx = tiers.findIndex((t) => t.tier_order === currentTierOrder);
    return idx >= 0 ? idx : 0;
  }, [tiers, currentTierOrder]);

  const currentLevel = levelForIndex(currentIdx);
  const nextLevel = levelForIndex(Math.min(currentIdx + 1, tiers.length - 1));
  const progressPct = Math.round(progressInTier * 100);

  const trackRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<number | null>(null);
  const userInteracting = useRef(false);

  const scrollToCurrent = (behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>(`[data-slide-idx="${currentIdx}"]`);
    if (!slide) return;
    const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior });
  };

  // Center current tier on mount / data change
  useEffect(() => {
    scrollToCurrent("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, tiers.length]);

  // Snap back to current card after user stops interacting
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const markInteracting = () => {
      userInteracting.current = true;
    };
    const scheduleSnap = () => {
      if (snapTimer.current) window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        userInteracting.current = false;
        scrollToCurrent("smooth");
      }, 900);
    };

    const onScroll = () => {
      if (!userInteracting.current) return;
      scheduleSnap();
    };
    const onPointerDown = () => {
      markInteracting();
      if (snapTimer.current) window.clearTimeout(snapTimer.current);
    };
    const onPointerUp = () => scheduleSnap();
    const onWheel = () => {
      markInteracting();
      scheduleSnap();
    };
    const onTouchStart = () => onPointerDown();
    const onTouchEnd = () => scheduleSnap();

    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointerup", onPointerUp);
    track.addEventListener("pointercancel", onPointerUp);
    track.addEventListener("wheel", onWheel, { passive: true });
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd);

    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointerup", onPointerUp);
      track.removeEventListener("pointercancel", onPointerUp);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchend", onTouchEnd);
      if (snapTimer.current) window.clearTimeout(snapTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, tiers.length]);

  return (
    <div className="cpic-carousel-wrap">
      <div className="cpic-carousel" ref={trackRef}>
        {tiers.map((tier, i) => {
          const lvl = levelForIndex(i);
          const isCurrent = i === currentIdx;
          const nextTier = tiers[i + 1];
          const target = isCurrent
            ? nextThreshold ?? Math.max(revenue, resultado, 1)
            : nextTier?.threshold_result ?? tier.threshold_result;
          return (
            <div key={`${lvl}-${tier.tier_order}`} className="cpic-carousel-slide" data-slide-idx={i}>
              <CardFace
                brand={brand}
                employeeName={employeeName}
                level={lvl}
                percentage={tier.percentage}
                revenue={isCurrent ? revenue : tier.threshold_result}
                target={target}
                currency={currency}
                progressPct={isCurrent ? progressPct : 0}
                showProgress={isCurrent}
              />
            </div>
          );
        })}
      </div>

      <div className="cpic-caption">
        <div className="cpic-caption-main">
          {amountMissing != null && amountMissing > 0 ? (
            <span>
              Faltam <strong>R$ {brNumber(amountMissing)}</strong> para virar <strong>{nextLevel}</strong>
            </span>
          ) : (
            <span>
              <strong>Nível máximo</strong> desbloqueado
            </span>
          )}
        </div>
        <div className="cpic-caption-sub">
          Tier atual · {currentLevel} · {currentPercentage}%
        </div>
      </div>
    </div>
  );
}

