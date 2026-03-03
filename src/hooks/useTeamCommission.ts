import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";

export interface TeamMemberCommission {
  userId: string;
  nome: string;
  initials: string;
  resultado: number | null;
  currentTierOrder: number;
  currentPercentage: number | null;
  nextThreshold: number | null;
  amountMissing: number | null;
}

interface CommissionTier {
  tier_order: number;
  percentage: number;
  threshold_result: number;
}

/**
 * Fetches team members' commission tiers for the month.
 * Now uses per-team fee rates.
 */
export function useTeamCommission(month: string, viewerId?: string, viewerIsAdmin?: boolean) {
  const [members, setMembers] = useState<TeamMemberCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [tierRes, closersRes, profilesRes, teamsRes] = await Promise.all([
        supabase
          .from("commission_tiers")
          .select("tier_order, percentage, threshold_result")
          .eq("team_id", "default")
          .order("tier_order", { ascending: true }),
        supabase.rpc("get_approved_closers"),
        supabase.from("profiles").select("id, team_id"),
        supabase.from("teams").select("id, taxa_operacional"),
      ]);

      const fetchedTiers = (tierRes.data as any as CommissionTier[]) || [];
      setTiers(fetchedTiers);

      const closers = closersRes.data || [];
      if (closers.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Build maps
      const userTeamMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => { if (p.team_id) userTeamMap.set(p.id, p.team_id); });
      
      const teamFeeMap = new Map<string, number>();
      (teamsRes.data || []).forEach((t: any) => teamFeeMap.set(t.id, Number(t.taxa_operacional) ?? PLATFORM_FEE_RATE));

      const [year, mo] = month.split("-");
      const startDate = `${year}-${mo}-01`;
      const endDate = new Date(Number(year), Number(mo), 0);
      const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;

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
        const teamId = userTeamMap.get(c.id);
        const rate = teamId ? teamFeeMap.get(teamId) ?? PLATFORM_FEE_RATE : PLATFORM_FEE_RATE;
        const fee = agg.revenue * rate;
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
