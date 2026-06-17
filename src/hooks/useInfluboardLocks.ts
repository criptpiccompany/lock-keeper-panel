import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InfluboardLock {
  handle: string;
  handle_normalized: string;
  instagram_url: string | null;
  lock_expires_at: string | null;
  closer_name: string | null;
  team_name: string | null;
  lock_count?: number;
  first_locked_at?: string | null;
}

export interface InfluboardSyncMeta {
  last_run_at: string | null;
  last_count: number | null;
  last_status: string | null;
  last_error: string | null;
}

function normalize(h: string): string {
  return h.trim().replace(/^@/, "").toLowerCase();
}

export function useInfluboardLocks() {
  return useQuery({
    queryKey: ["influboard-locks"],
    queryFn: async () => {
      const sb = supabase as any;
      const [{ data: locks }, { data: meta }, { data: history }] = await Promise.all([
        sb.from("influboard_locked_cache").select("*").order("handle_normalized"),
        sb.from("influboard_sync_meta").select("*").eq("id", 1).maybeSingle(),
        sb.from("influboard_lock_history").select("handle_normalized, lock_count, first_locked_at"),
      ]);
      const histMap = new Map<string, { lock_count: number; first_locked_at: string | null }>();
      (history ?? []).forEach((h: any) =>
        histMap.set(h.handle_normalized, { lock_count: h.lock_count, first_locked_at: h.first_locked_at })
      );
      const merged: InfluboardLock[] = (locks ?? []).map((l: any) => {
        const h = histMap.get(l.handle_normalized);
        return { ...l, lock_count: h?.lock_count ?? 1, first_locked_at: h?.first_locked_at ?? null };
      });
      const map = new Map<string, InfluboardLock>();
      merged.forEach((l) => map.set(l.handle_normalized, l));
      return {
        list: merged,
        byHandle: map,
        meta: (meta ?? null) as InfluboardSyncMeta | null,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useIsInfluboardLocked(handle: string) {
  const { data } = useInfluboardLocks();
  if (!handle) return null;
  return data?.byHandle.get(normalize(handle)) ?? null;
}
