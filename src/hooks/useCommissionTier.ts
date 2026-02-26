import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CommissionTier {
  tier_order: number;
  percentage: number;
  threshold_result: number;
}

export interface CommissionResult {
  loading: boolean;
  tiers: CommissionTier[];
  currentTierOrder: number;
  currentPercentage: number;
  nextThreshold: number | null;
  amountMissing: number | null;
  progressInTier: number; // 0-1 progress within current tier band
}

/**
 * Given the monthly "Resultado" (revenue - invested - 6% fee),
 * determines the current commission tier and progress toward the next one.
 */
export function useCommissionTier(resultado: number): CommissionResult {
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("commission_tiers")
        .select("tier_order, percentage, threshold_result")
        .eq("team_id", "default")
        .order("tier_order", { ascending: true });

      setTiers(
        (data as any as CommissionTier[]) || []
      );
      setLoading(false);
    };
    fetch();
  }, []);

  return useMemo(() => {
    if (tiers.length === 0) {
      return {
        loading,
        tiers,
        currentTierOrder: 0,
        currentPercentage: 0,
        nextThreshold: null,
        amountMissing: null,
        progressInTier: 0,
      };
    }

    // Find the highest tier the resultado qualifies for
    let currentIdx = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (resultado >= tiers[i].threshold_result) {
        currentIdx = i;
        break;
      }
    }

    const current = tiers[currentIdx];
    const next = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

    const nextThreshold = next ? next.threshold_result : null;
    const amountMissing = nextThreshold !== null ? Math.max(0, nextThreshold - resultado) : null;

    // Progress within current tier band (0 to 1)
    let progressInTier = 1;
    if (next) {
      const bandStart = current.threshold_result;
      const bandEnd = next.threshold_result;
      const bandSize = bandEnd - bandStart;
      progressInTier = bandSize > 0 ? Math.min(1, Math.max(0, (resultado - bandStart) / bandSize)) : 0;
    }

    return {
      loading,
      tiers,
      currentTierOrder: current.tier_order,
      currentPercentage: current.percentage,
      nextThreshold,
      amountMissing,
      progressInTier,
    };
  }, [tiers, resultado, loading]);
}
