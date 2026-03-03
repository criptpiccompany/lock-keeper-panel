import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";

/**
 * Fetches the taxa_operacional for a given team.
 * Falls back to the default PLATFORM_FEE_RATE (0.06) if not found.
 * 
 * Can also accept a teamId directly (for admin views switching between teams).
 */
export function useTeamFeeRate(teamId?: string | null) {
  const [feeRate, setFeeRate] = useState(PLATFORM_FEE_RATE);
  const [loading, setLoading] = useState(!!teamId);

  useEffect(() => {
    if (!teamId) {
      setFeeRate(PLATFORM_FEE_RATE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("teams")
      .select("taxa_operacional")
      .eq("id", teamId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data && (data as any).taxa_operacional != null) {
          setFeeRate(Number((data as any).taxa_operacional));
        } else {
          setFeeRate(PLATFORM_FEE_RATE);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [teamId]);

  return { feeRate, feeLabel: getFeeLabel(feeRate), loading };
}

/**
 * Fetches fee rates for ALL teams at once (for admin/export).
 */
export async function fetchAllTeamFeeRates(): Promise<Map<string, number>> {
  const { data } = await supabase.from("teams").select("id, taxa_operacional");
  const map = new Map<string, number>();
  (data || []).forEach((t: any) => {
    map.set(t.id, Number(t.taxa_operacional) ?? PLATFORM_FEE_RATE);
  });
  return map;
}

/**
 * Generates a dynamic fee label like "Taxa (6%)" or "Taxa (9%)"
 */
export function getFeeLabel(rate: number): string {
  const pct = (rate * 100).toFixed(0);
  return `Taxa (${pct}%)`;
}
