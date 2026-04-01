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
  teamId: string | null;
}

/**
 * Get thermometer snapshots for ALL approved closers for a given month.
 * Accepts an optional feeRateOverride; otherwise fetches each closer's team rate.
 */
export async function getTeamThermometerSnapshots(
  month: string,
  tiers: CommissionTier[],
  feeRateOverride?: number
): Promise<ThermometerSnapshot[]> {
  const [year, mo] = month.split("-");
  const startDate = `${year}-${mo}-01`;
  const endDate = new Date(Number(year), Number(mo), 0);
  const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;

  const [closersRes, recordsRes, rolesRes, profilesRes, teamsRes] = await Promise.all([
    supabase.rpc("get_approved_closers"),
    supabase
      .from("daily_influencer_records")
      .select("closer_id, valor_pago, faturamento")
      .gte("date", startDate)
      .lte("date", endDateStr)
      .is("deleted_at", null),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("profiles").select("id, team_id"),
    supabase.from("teams").select("id, taxa_operacional"),
  ]);

  const closers = closersRes.data || [];
  const records = recordsRes.data || [];
  const roles = rolesRes.data || [];
  const profiles = profilesRes.data || [];
  const teams = teamsRes.data || [];

  const roleMap = new Map<string, string>();
  roles.forEach((r: any) => roleMap.set(r.user_id, r.role));

  // Build team fee rate map
  const teamFeeMap = new Map<string, number>();
  teams.forEach((t: any) => teamFeeMap.set(t.id, Number(t.taxa_operacional) ?? PLATFORM_FEE_RATE));

  // Build user → team map
  const userTeamMap = new Map<string, string>();
  profiles.forEach((p: any) => { if (p.team_id) userTeamMap.set(p.id, p.team_id); });

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
    const userTeamId = userTeamMap.get(c.id);
    const rate = feeRateOverride ?? (userTeamId ? teamFeeMap.get(userTeamId) ?? PLATFORM_FEE_RATE : PLATFORM_FEE_RATE);
    const fee = agg.revenue * rate;
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
      teamId: userTeamMap.get(c.id) ?? null,
    };
  });
}
