import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";

export interface TeamMemberCommission {
  userId: string;
  nome: string;
  initials: string;
  /** Only populated for the current user or when viewer is ADMIN */
  resultado: number | null;
  currentTierOrder: number;
  /** Only populated for the current user or when viewer is ADMIN */
  currentPercentage: number | null;
  /** Only populated for ADMIN viewers */
  nextThreshold: number | null;
  /** Only populated for ADMIN viewers */
  amountMissing: number | null;
}

interface CommissionTier {
  tier_order: number;
  percentage: number;
  threshold_result: number;
}

/**
 * Fetches team members' commission tiers for the month.
 * - ADMIN: sees full financial data for all members
 * - CLOSER: sees only name + percentage (no financial values for others)
 *   Backend RLS already blocks access to other closers' records.
 */
export function useTeamCommission(month: string, viewerId?: string, viewerIsAdmin?: boolean) {
  const [members, setMembers] = useState<TeamMemberCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const { data: tierData } = await supabase
        .from("commission_tiers")
        .select("tier_order, percentage, threshold_result")
        .eq("team_id", "default")
        .order("tier_order", { ascending: true });

      const fetchedTiers = (tierData as any as CommissionTier[]) || [];
      setTiers(fetchedTiers);

      const { data: closers } = await supabase.rpc("get_approved_closers");
      if (!closers || closers.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const [year, mo] = month.split("-");
      const startDate = `${year}-${mo}-01`;
      const endDate = new Date(Number(year), Number(mo), 0);
      const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;

      // RLS ensures closers only get their own records
      const { data: records } = await supabase
        .from("daily_influencer_records")
        .select("closer_id, valor_pago, faturamento")
        .gte("date", startDate)
        .lte("date", endDateStr)
        .is("deleted_at", null);

      const closerMap = new Map<string, { invested: number; revenue: number }>();
      (records || []).forEach((r: any) => {
        const existing = closerMap.get(r.closer_id) || { invested: 0, revenue: 0 };
        existing.invested += Number(r.valor_pago) || 0;
        existing.revenue += Number(r.faturamento) || 0;
        closerMap.set(r.closer_id, existing);
      });

      const result: TeamMemberCommission[] = closers.map((c: any) => {
        const agg = closerMap.get(c.id) || { invested: 0, revenue: 0 };
        const fee = agg.revenue * PLATFORM_FEE_RATE;
        const resultado = agg.revenue - agg.invested - fee;

        let currentIdx = 0;
        for (let i = fetchedTiers.length - 1; i >= 0; i--) {
          if (resultado >= fetchedTiers[i].threshold_result) {
            currentIdx = i;
            break;
          }
        }
        const current = fetchedTiers[currentIdx] || { tier_order: 0, percentage: 10, threshold_result: 0 };
        const next = currentIdx < fetchedTiers.length - 1 ? fetchedTiers[currentIdx + 1] : null;

        const words = (c.nome || "").trim().split(/\s+/);
        const initials = words.length >= 2
          ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
          : (c.nome || "?").substring(0, 2).toUpperCase();

        const isSelf = c.id === viewerId;
        const canSeeFinancials = viewerIsAdmin || isSelf;

        return {
          userId: c.id,
          nome: c.nome,
          initials,
          resultado: canSeeFinancials ? resultado : null,
          currentTierOrder: current.tier_order,
          currentPercentage: canSeeFinancials ? current.percentage : null,
          nextThreshold: canSeeFinancials && next ? next.threshold_result : null,
          amountMissing: canSeeFinancials && next ? Math.max(0, next.threshold_result - resultado) : null,
        };
      });

      setMembers(result);
      setLoading(false);
    };

    fetchAll();
  }, [month, viewerId, viewerIsAdmin]);

  return { members, loading, tiers };
}
