import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock3, ListOrdered, Radio } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAILY_GOAL_CENTS = 3_000_000;
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

interface AffiliateSnapshot {
  id: string;
  handle: string;
  email: string;
  closer: string;
  referredCount: number;
  referredGrowth: number;
  activeCount: number;
  activeGrowth: number;
  depositedCents: number;
  depositedGrowthCents: number;
  registeredAt: string;
}

// Fonte temporária: o scraper substituirá somente este conjunto de snapshots.
const MOCK_AFFILIATES: AffiliateSnapshot[] = [
  { id: "317791292", handle: "@jenny_demo", email: "jenny@onlinemoney.com", closer: "VA", referredCount: 1670, referredGrowth: 18, activeCount: 372, activeGrowth: 7, depositedCents: 428_950, depositedGrowthCents: 38_000, registeredAt: "30/06/2026 13:08" },
  { id: "212713387", handle: "@vitoria_demo", email: "vitoria@onlinemoney.com", closer: "VA", referredCount: 1089, referredGrowth: 12, activeCount: 286, activeGrowth: 5, depositedCents: 346_780, depositedGrowthCents: 21_500, registeredAt: "25/06/2026 15:18" },
  { id: "250086198", handle: "@maozinha_demo", email: "maozinha@gmail.com", closer: "AN", referredCount: 963, referredGrowth: 9, activeCount: 164, activeGrowth: 4, depositedCents: 294_200, depositedGrowthCents: 19_900, registeredAt: "03/07/2026 15:02" },
  { id: "229446538", handle: "@keifany_demo", email: "keifany@onlinemoney.com", closer: "VA", referredCount: 716, referredGrowth: 7, activeCount: 157, activeGrowth: 3, depositedCents: 263_470, depositedGrowthCents: 12_000, registeredAt: "03/07/2026 18:26" },
  { id: "238401705", handle: "@clmari_demo", email: "clmari@gmail.com", closer: "BC", referredCount: 641, referredGrowth: 6, activeCount: 142, activeGrowth: 3, depositedCents: 218_900, depositedGrowthCents: 8_500, registeredAt: "04/07/2026 10:41" },
  { id: "220187654", handle: "@oficial_demo", email: "oficial@onlinemoney.com", closer: "AN", referredCount: 518, referredGrowth: 5, activeCount: 121, activeGrowth: 2, depositedCents: 176_650, depositedGrowthCents: 7_000, registeredAt: "06/07/2026 09:20" },
  { id: "201765932", handle: "@pedri_demo", email: "pedri@gmail.com", closer: "VA", referredCount: 432, referredGrowth: 4, activeCount: 98, activeGrowth: 2, depositedCents: 148_300, depositedGrowthCents: 5_900, registeredAt: "07/07/2026 14:05" },
  { id: "219004821", handle: "@fagundes_demo", email: "fagundes@onlinemoney.com", closer: "BC", referredCount: 367, referredGrowth: 3, activeCount: 84, activeGrowth: 1, depositedCents: 121_890, depositedGrowthCents: 3_500, registeredAt: "08/07/2026 12:31" },
  { id: "245398120", handle: "@lima_demo", email: "lima@gmail.com", closer: "AN", referredCount: 289, referredGrowth: 2, activeCount: 63, activeGrowth: 1, depositedCents: 98_500, depositedGrowthCents: 2_200, registeredAt: "09/07/2026 16:48" },
  { id: "230775419", handle: "@nkosta_demo", email: "nkosta@onlinemoney.com", closer: "VA", referredCount: 204, referredGrowth: 0, activeCount: 41, activeGrowth: 0, depositedCents: 72_600, depositedGrowthCents: 0, registeredAt: "10/07/2026 11:12" },
];

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getOperationalWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);

  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function TeamDailyGoalCard(_props: { teamId?: string | null; isAdmin?: boolean } = {}) {
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [selectedWindowOffset, setSelectedWindowOffset] = useState("0");

  useEffect(() => {
    const interval = window.setInterval(() => setLastUpdatedAt(new Date()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const currentRanking = useMemo(
    () => [...MOCK_AFFILIATES].sort((a, b) => b.depositedCents - a.depositedCents),
    [],
  );
  const revenueCents = useMemo(
    () => currentRanking.reduce((total, affiliate) => total + affiliate.depositedCents, 0),
    [currentRanking],
  );
  const progress = Math.min(100, (revenueCents / DAILY_GOAL_CENTS) * 100);
  const { start, end } = getOperationalWindow(lastUpdatedAt);
  const windowLabel = `${format(start, "dd MMM, HH'h'", { locale: ptBR })} → ${format(end, "dd MMM, HH'h'", { locale: ptBR })}`;
  const windowOptions = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const reference = new Date(lastUpdatedAt);
    reference.setDate(reference.getDate() - offset);
    const bounds = getOperationalWindow(reference);
    return {
      value: String(offset),
      label: offset === 0
        ? `Janela atual · ${format(bounds.start, "dd/MM", { locale: ptBR })} → ${format(bounds.end, "dd/MM", { locale: ptBR })}`
        : `${format(bounds.start, "dd MMM, 12'h'", { locale: ptBR })} → ${format(bounds.end, "dd MMM, 12'h'", { locale: ptBR })}`,
      ...bounds,
    };
  }), [lastUpdatedAt]);
  const selectedOption = windowOptions[Number(selectedWindowOffset)] ?? windowOptions[0];
  const selectedWindowLabel = `${format(selectedOption.start, "dd MMM, HH'h'", { locale: ptBR })} → ${format(selectedOption.end, "dd MMM, HH'h'", { locale: ptBR })}`;
  const ranking = useMemo(() => {
    const offset = Number(selectedWindowOffset);
    const multiplier = Math.max(0.45, 1 - offset * 0.075);
    return currentRanking
      .map((affiliate, index) => ({
        ...affiliate,
        depositedCents: Math.round(affiliate.depositedCents * multiplier * (1 - (index % 3) * 0.025)),
        depositedGrowthCents: offset === 0 ? affiliate.depositedGrowthCents : 0,
        referredCount: Math.max(0, affiliate.referredCount - offset * (affiliate.referredGrowth + 3)),
        activeCount: Math.max(0, affiliate.activeCount - offset * Math.max(1, affiliate.activeGrowth)),
        referredGrowth: offset === 0 ? affiliate.referredGrowth : Math.max(0, affiliate.referredGrowth - (offset % 3)),
        activeGrowth: offset === 0 ? affiliate.activeGrowth : Math.max(0, affiliate.activeGrowth - (offset % 2)),
      }))
      .sort((a, b) => b.depositedCents - a.depositedCents);
  }, [currentRanking, selectedWindowOffset]);
  const selectedRevenueCents = useMemo(
    () => ranking.reduce((total, affiliate) => total + affiliate.depositedCents, 0),
    [ranking],
  );

  return (
    <div className="rounded-[18px] bg-card px-7 py-6 shadow-[0_8px_24px_hsl(var(--foreground)/0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Progresso</div>
          <div className="mt-2 text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
            Meta diária do time
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3 w-3" />
              Janela {windowLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Radio className="h-3 w-3" />
              Atualização automática · 3 min
            </span>
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-[12px] font-medium text-muted-foreground transition hover:bg-muted"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Ver ranking
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[86vh] w-[calc(100vw-24px)] max-w-[1040px] gap-0 overflow-hidden rounded-[24px] border-border p-0">
            <DialogHeader className="border-b border-border px-6 py-5 pr-12">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                Monitoramento dos afiliados
              </div>
              <DialogTitle className="mt-1 text-[26px] tracking-[-0.03em]">Ranking da janela atual</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <span>{selectedWindowLabel}</span>
                <span>·</span>
                <span>Atualizado às {format(lastUpdatedAt, "HH:mm")}</span>
              </DialogDescription>
              <Select value={selectedWindowOffset} onValueChange={setSelectedWindowOffset}>
                <SelectTrigger className="mt-3 h-10 w-full max-w-[310px] rounded-full bg-background px-4 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {windowOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogHeader>

            <div className="grid grid-cols-[40px_minmax(150px,1fr)_minmax(170px,1.15fr)_72px_82px_72px_132px_128px] border-b border-border bg-muted/60 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground max-md:grid-cols-[36px_minmax(0,1fr)_120px]">
              <span>#</span>
              <span>Afiliado</span>
              <span className="max-md:hidden">E-mail</span>
              <span className="max-md:hidden">Closer</span>
              <span className="text-center max-md:hidden">Indicados</span>
              <span className="text-center max-md:hidden">Ativos</span>
              <span className="text-right">Depositado</span>
              <span className="text-right max-md:hidden">Cadastro</span>
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              {ranking.map((affiliate, index) => (
                <div
                  key={affiliate.id}
                  className={`grid grid-cols-[40px_minmax(150px,1fr)_minmax(170px,1.15fr)_72px_82px_72px_132px_128px] items-center px-5 py-3.5 max-md:grid-cols-[36px_minmax(0,1fr)_120px] ${index % 2 === 0 ? "bg-background" : "bg-muted/45"}`}
                >
                  <span className="text-[12px] font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-foreground">{affiliate.handle}</div>
                    <div className="truncate text-[10px] text-muted-foreground">ID: {affiliate.id}</div>
                  </div>
                  <span className="truncate pr-3 text-[11px] text-muted-foreground max-md:hidden">{affiliate.email}</span>
                  <span className="w-fit rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground max-md:hidden">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    {affiliate.closer}
                  </span>
                  <div className="text-center max-md:hidden">
                    <div className="text-[13px] font-medium text-foreground">{affiliate.referredCount.toLocaleString("pt-BR")}</div>
                    <div className="text-[9px] font-medium text-primary">+{affiliate.referredGrowth} em 3 min</div>
                  </div>
                  <div className="text-center max-md:hidden">
                    <div className="text-[13px] font-medium text-foreground">{affiliate.activeCount.toLocaleString("pt-BR")}</div>
                    <div className="text-[9px] font-medium text-primary">+{affiliate.activeGrowth} em 3 min</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-foreground">{formatCurrency(affiliate.depositedCents)}</div>
                    <div className="inline-flex items-center justify-end gap-0.5 text-[9px] font-medium text-primary">
                      {affiliate.depositedGrowthCents > 0 && <ArrowUpRight className="h-2.5 w-2.5" />}
                      {affiliate.depositedGrowthCents > 0 ? `+${formatCurrency(affiliate.depositedGrowthCents)} em 3 min` : "Sem alteração"}
                    </div>
                  </div>
                  <span className="text-right text-[10px] leading-tight text-muted-foreground max-md:hidden">{affiliate.registeredAt}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total depositado na janela</span>
              <span className="text-[18px] font-semibold text-foreground">{formatCurrency(selectedRevenueCents)}</span>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="my-4 h-[11px] overflow-hidden rounded-full bg-[repeating-linear-gradient(90deg,hsl(var(--muted))_0px,hsl(var(--muted))_3px,hsl(var(--background))_3px,hsl(var(--background))_6px)]">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{formatCurrency(revenueCents)}</span> de
        </span>
        <span className="font-medium text-foreground/70">{formatCurrency(DAILY_GOAL_CENTS)}</span>
      </div>
    </div>
  );
}
