import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { AddInfluencerUnifiedModal } from "@/components/AddInfluencerUnifiedModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enrichInfluencer, LockInfo } from "@/lib/helpers";
import { InfluencerWithStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  UserPlus, 
  Users, 
  Loader2,
  Link,
  Copy,
} from "lucide-react";

export default function MeuPainel() {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [locksMap, setLocksMap] = useState<Map<string, { locked_until: string }>>(new Map());

  const fetchMyInfluencers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('influencers')
      .select('*')
      .eq('owner_id', user.id)
      .eq('ativo', true);

    if (error) {
      console.error('Error fetching influencers:', error);
      toast.error('Erro ao carregar influenciadores');
      return;
    }

    // Fetch locks for this user's influencers by influencer_id
    const ids = (data || []).map(inf => inf.id);
    let locksMap = new Map<string, LockInfo>();
    if (ids.length > 0) {
      const { data: locksData } = await supabase
        .from("influencer_locks")
        .select("influencer_id, handle_normalized, locked_until")
        .gt("locked_until", new Date().toISOString());
      
      const handleMap = new Map<string, { locked_until: string }>();
      for (const l of (locksData || []) as any[]) {
        if (l.influencer_id) locksMap.set(l.influencer_id, { locked_until: l.locked_until });
        handleMap.set(l.handle_normalized, { locked_until: l.locked_until });
      }
      setLocksMap(handleMap);
    } else {
      setLocksMap(new Map());
    }

    const enriched = (data || []).map(inf => enrichInfluencer({
      id: inf.id,
      handle: inf.handle,
      ownerId: inf.owner_id,
      ownerNome: inf.owner_nome,
      lastClosedAt: inf.last_closed_at,
      ativo: inf.ativo,
      notas: inf.notas || undefined
    }, locksMap.get(inf.id) || null));

    // Sort by days remaining (soonest first)
    enriched.sort((a, b) => {
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    setInfluencers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyInfluencers();
  }, [user]);

  // Filter by search
  const filteredInfluencers = influencers.filter(inf =>
    inf.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeLocksCount = influencers.filter((inf) => inf.daysRemaining !== null).length;
  const expiringLocksCount = influencers.filter((inf) => inf.daysRemaining !== null && inf.daysRemaining <= 2).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] bg-white py-20 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#fafaf8_100%)] p-5 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f3f3ef] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#676767]">
              <Users className="h-3.5 w-3.5" />
              My List
            </div>
            <div>
              <h2 className="text-[34px] font-medium tracking-[-0.06em] text-foreground sm:text-[42px]">
                Minha Lista
              </h2>
              <p className="mt-2 text-[14px] text-[#6e6e73]">
                Gerencie sua carteira de influenciadores, acompanhe travamentos e encontre rápido quem está perto de liberar.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                Ativos: <span className="ml-1 text-[#1f1f1f]">{influencers.length}</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#6e6e73] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
                Travados: <span className="ml-1 text-[#1f1f1f]">{activeLocksCount}</span>
              </div>
              {expiringLocksCount > 0 && (
                <div className="inline-flex items-center rounded-full bg-[#fff8eb] px-4 py-2 text-[12px] font-medium text-[#9a6a16] shadow-[0_10px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-[#f0dfb4]">
                  Liberando em breve: <span className="ml-1 text-[#7c5712]">{expiringLocksCount}</span>
                </div>
              )}
              <Button
                className="h-11 rounded-full bg-[#1f1f1f] px-5 text-[13px] font-medium text-white hover:bg-[#111111]"
                onClick={() => setAddModalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar influenciador
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div>
        {influencers.length === 0 ? (
          <div className="rounded-[28px] bg-white py-20 text-center text-muted-foreground shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03]">
            <Users className="mx-auto mb-4 h-10 w-10 opacity-30" />
            <h3 className="text-[18px] font-medium text-[#1f1f1f]">Nenhum influenciador ainda</h3>
            <p className="mx-auto mt-2 mb-5 max-w-md text-sm text-[#6e6e73]">
              Adicione influenciadores ou registre fechamentos para começar.
            </p>
            <div className="flex justify-center gap-2">
              <Button className="h-11 rounded-full bg-[#1f1f1f] px-5 text-white hover:bg-[#111111]" onClick={() => setAddModalOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar influenciador
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.03] sm:p-5">
            <div className="mb-4 flex flex-col gap-4 px-2 pt-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-[#999999]">Carteira operacional</div>
                <div className="mt-1 text-[24px] font-medium tracking-[-0.04em] text-[#1f1f1f]">Influenciadores sob sua gestão</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-full max-w-md lg:w-80">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a96]" />
                  <Input
                    placeholder="Buscar por @handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 rounded-full border-[#ececeb] bg-white pl-11 pr-4 text-[14px] shadow-none"
                  />
                </div>
                <div className="shrink-0 rounded-full bg-[#f3f3ef] px-3 py-2 text-[12px] font-medium text-[#676767]">
                  {filteredInfluencers.length} resultados
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-11 shrink-0 rounded-full border-[#ececeb] bg-white px-4 text-[13px] font-medium text-[#1f1f1f] hover:bg-[#f6f4f0]"
                    onClick={() => {
                      const text = filteredInfluencers
                        .map((inf, i) => `${i + 1}. ${inf.handle}`)
                        .join("\n");
                      navigator.clipboard.writeText(text).then(
                        () => toast.success("Lista copiada para a área de transferência"),
                        () => toast.error("Não foi possível copiar a lista")
                      );
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar lista
                  </Button>
                )}
              </div>
            </div>
            {filteredInfluencers.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 opacity-30" />
                <h3 className="text-[18px] font-medium text-[#1f1f1f]">Nenhum resultado</h3>
                <p className="mt-2 text-sm text-[#6e6e73]">
                  Nenhum influenciador encontrado com "{searchQuery}"
                </p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Influenciador</th>
                    <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Dias Restantes</th>
                    <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Status</th>
                    <th className="px-4 py-5 text-left text-[12px] font-medium text-[#6e6e6e]">Notas</th>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-5">
                      <div className="border-b border-dashed border-[#e6ddb0]" />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {filteredInfluencers.map((inf) => {
                    const handleNorm = inf.handle.trim().toLowerCase().replace(/^@/, "");
                    const lock = locksMap.get(handleNorm);
                    const daysLeft = lock
                      ? Math.max(0, Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                      : null;
                    const isExpiring = daysLeft !== null && daysLeft <= 2;

                    return (
                      <tr key={inf.id} className="odd:bg-white even:bg-[#fbfbf8]">
                        <td className="px-5 py-4">
                          <span className="text-[13px] font-medium text-[#1f1f1f]">{inf.handle}</span>
                        </td>
                        <td className="px-4 py-4">
                          {daysLeft !== null ? (
                            <Badge
                              variant="outline"
                              className={
                                isExpiring
                                  ? "rounded-full border-amber-200/60 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700"
                                  : "rounded-full border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                              }
                            >
                              {daysLeft}d
                            </Badge>
                          ) : (
                            <span className="text-[13px] text-[#9a9a96]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={inf.status} size="sm" />
                        </td>
                        <td className="px-4 py-4 text-[13px] text-[#6e6e73]">
                          {inf.notas || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </div>

      <AddInfluencerUnifiedModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={fetchMyInfluencers}
      />
    </div>
  );
}
