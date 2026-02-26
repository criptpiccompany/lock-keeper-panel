import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";
import type { CommissionTier } from "@/hooks/useCommissionTier";

export interface ThermometerSnapshot {
  userId: string;
  nome: string;
  role: string;
  percentage: number;
  result: number;
  estimatedCommission: number;
  nextTierTarget: number | null;
  missingToNextTier: number | null;
  currentTierOrder: number;
  invested: number;
  revenue: number;
  fee: number;
}

/**
 * Get thermometer snapshots for ALL approved closers for a given month.
 * This is the single source of truth for commission tier data displayed
 * in the "Termômetros do Time" admin section.
 */
export async function getTeamThermometerSnapshots(
  month: string,
  tiers: CommissionTier[]
): Promise<ThermometerSnapshot[]> {
  const [year, mo] = month.split("-");
  const startDate = `${year}-${mo}-01`;
  const endDate = new Date(Number(year), Number(mo), 0);
  const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;

  const [closersRes, recordsRes, rolesRes] = await Promise.all([
    supabase.rpc("get_approved_closers"),
    supabase
      .from("daily_influencer_records")
      .select("closer_id, valor_pago, faturamento")
      .gte("date", startDate)
      .lte("date", endDateStr)
      .is("deleted_at", null),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const closers = closersRes.data || [];
  const records = recordsRes.data || [];
  const roles = rolesRes.data || [];

  const roleMap = new Map<string, string>();
  roles.forEach((r: any) => roleMap.set(r.user_id, r.role));

  // Aggregate per closer
  const closerAgg = new Map<string, { invested: number; revenue: number }>();
  records.forEach((r: any) => {
    const existing = closerAgg.get(r.closer_id) || { invested: 0, revenue: 0 };
    existing.invested += Number(r.valor_pago) || 0;
    existing.revenue += Number(r.faturamento) || 0;
    closerAgg.set(r.closer_id, existing);
  });

  return closers.map((c: any) => {
    const agg = closerAgg.get(c.id) || { invested: 0, revenue: 0 };
    const fee = agg.revenue * PLATFORM_FEE_RATE;
    const result = agg.revenue - agg.invested - fee;

    // Resolve tier
    let currentIdx = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (result >= tiers[i].threshold_result) {
        currentIdx = i;
        break;
      }
    }
    const current = tiers[currentIdx] || { tier_order: 0, percentage: 10, threshold_result: 0 };
    const next = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

    const estimatedCommission = result > 0 ? result * (current.percentage / 100) : 0;

    return {
      userId: c.id,
      nome: c.nome,
      role: roleMap.get(c.id) || "CLOSER",
      percentage: current.percentage,
      result,
      estimatedCommission,
      nextTierTarget: next ? next.threshold_result : null,
      missingToNextTier: next ? Math.max(0, next.threshold_result - result) : null,
      currentTierOrder: current.tier_order,
      invested: agg.invested,
      revenue: agg.revenue,
      fee,
    };
  });
}
