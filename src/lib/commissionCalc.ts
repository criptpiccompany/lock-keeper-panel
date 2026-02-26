import type { CommissionTier } from "@/hooks/useCommissionTier";

/**
 * Single source of truth for estimated commission calculation.
 * Uses tier-based percentage applied to the monthly resultado (profit).
 */
export function getEstimatedCommission(resultado: number, currentPercentage: number): number {
  return resultado > 0 ? resultado * (currentPercentage / 100) : 0;
}

/**
 * Resolves the current tier percentage for a given resultado value.
 */
export function resolveCurrentPercentage(resultado: number, tiers: CommissionTier[]): number {
  if (tiers.length === 0) return 0;
  let currentIdx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (resultado >= tiers[i].threshold_result) {
      currentIdx = i;
      break;
    }
  }
  return tiers[currentIdx].percentage;
}
