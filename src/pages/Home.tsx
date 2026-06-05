import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  DollarSign,
  FileText,
  LayoutGrid,
  Lock,
  Search,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

import { TAX_TOTAL } from "@/components/financeiro/financeiroHelpers";
import { CloserSharedBoard } from "@/components/home/CloserSharedBoard";
import { getEstimatedCommission } from "@/lib/commissionCalc";
import { getTeamThermometerSnapshots, type ThermometerSnapshot } from "@/lib/thermometerSnapshot";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCommissionTier } from "@/hooks/useCommissionTier";
import { useTeamFeeRate } from "@/hooks/useTeamFeeRate";
import { supabase } from "@/integrations/supabase/client";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
  const [year, mo] = month.split("-");
  const startDate = `${year}-${mo}-01`;
  const endDate = new Date(Number(year), Number(mo), 0);
  const endDateStr = `${year}-${mo}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { startDate, endDateStr };
}

function getLastSevenDays() {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getMonthLabel(month: string) {
  const [year, mo] = month.split("-").map(Number);
  return new Date(year, mo - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getTierPercentage(result: number, tiers: Array<{ percentage: number; threshold_result: number }>) {
  return tiers.reduce((current, tier) => {
    if (result >= Number(tier.threshold_result || 0)) {
      return Number(tier.percentage || current);
    }
    return current;
  }, 10);
}

type RecentRecord = {
  id: string;
  date: string;
  valor_pago: number;
  faturamento: number;
  handle: string;
  closerName?: string;
};

type CloserHomeData = {
  revenue: number;
  invested: number;
  fee: number;
  result: number;
  estimatedCommission: number;
  teamRank: number | null;
  activeLocks: number;
  managedInfluencers: number;
  todayEntries: number;
  recentRecords: RecentRecord[];
  weekSeries: { date: string; value: number }[];
};

type AdminHomeData = {
  revenue: number;
  invested: number;
  result: number;
  adminFee: number;
  activeClosers: number;
  activeLocks: number;
  teamsCount: number;
  recentRecords: RecentRecord[];
  topClosers: ThermometerSnapshot[];
  teamsSummary: Array<{
    id: string;
    name: string;
    closers: number;
    revenue: number;
    result: number;
  }>;
  weekSeries: { date: string; revenue: number; invested: number }[];
};

function ShellCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[30px] bg-white/74 p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03] backdrop-blur-sm lg:p-7",
        className
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
          {subtitle ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500/90">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SourceTopAction({
  to,
  label,
  primary,
  icon: Icon,
}: {
  to: string;
  label: string;
  primary?: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium tracking-[-0.02em]",
        primary ? "bg-[linear-gradient(180deg,#c7ff57_0%,#a7f437_100%)] text-[#1f1f1f]" : "bg-[#f3f3f2] text-[#484848]"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
function SourceMiniCard({
  title,
  value,
  note,
  status,
}: {
  title: string;
  value: string;
  note: string;
  status: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#ececeb] bg-white px-3 py-3 shadow-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="truncate text-[12px] font-medium text-[#1f1f1f]">{title}</div>
        <span className="text-[#999999]">•••</span>
      </div>
      <div className="text-[13px] font-semibold tracking-[-0.02em] text-[#1f1f1f]">{value}</div>
      <div className="mt-1 text-[10px] leading-[1.35] text-[#999999]">{note}</div>
      <div className="mt-1.5 text-[10px] font-medium text-[#6ea93d]">{status}</div>
    </div>
  );
}

function SourceTopBalanceCard({
  heading,
  value,
  delta,
  deltaNote,
  topPill,
  miniCards,
}: {
  heading: string;
  value: string;
  delta: string;
  deltaNote: string;
  topPill?: string;
  miniCards: Array<{ title: string; value: string; note: string; status: string }>;
}) {
  return (
    <div className="h-fit self-start rounded-[18px] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-[#676767]">{heading}</div>
          <div className="mt-2 text-[25px] font-semibold tracking-[-0.05em] text-[#1f1f1f]">{value}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px]">
            <span className="font-medium text-[#7dbd34]">{delta}</span>
            <span className="text-[#999999]">{deltaNote}</span>
          </div>
        </div>

        {topPill ? (
          <div className="inline-flex items-center rounded-full border border-[#ececeb] bg-white px-4 py-3 text-[13px] font-medium text-[#676767]">
            {topPill}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-[#ececeb] pt-4">
        <div className="mb-3 text-[12px] font-medium text-[#676767]">Resumo | Total {miniCards.length} blocos</div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {miniCards.map((card) => (
            <SourceMiniCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SourceStatCard({
  label,
  value,
  delta,
  note,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  delta: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-[132px] rounded-[18px] px-5 py-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.04)]",
        highlight ? "bg-[linear-gradient(180deg,#77cd31_0%,#0d5d4a_100%)] text-white" : "bg-white text-[#1f1f1f]"
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className={cn("text-[13px] font-medium", highlight ? "text-white/80" : "text-[#676767]")}>{label}</div>
        <div className={cn("grid h-6 w-6 place-items-center rounded-full", highlight ? "bg-white/15 text-white" : "bg-[#f4f4f3] text-[#676767]")}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mb-3 text-[26px] font-semibold leading-none tracking-[-0.05em]">{value}</div>
      <div className="flex items-center gap-1.5 text-[12px]">
        <span className={cn("font-medium", highlight ? "text-white/82" : "text-[#7dbd34]")}>{delta}</span>
        <span className={cn(highlight ? "text-white/72" : "text-[#999999]")}>{note}</span>
      </div>
    </div>
  );
}

function SourceTrackCard({
  title,
  current,
  target,
}: {
  title: string;
  current: number;
  target: number;
}) {
  const progress = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;

  return (
    <div className="rounded-[18px] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="text-[14px] font-medium text-[#1f1f1f]">{title}</div>
      <div className="my-4 h-[11px] overflow-hidden rounded-full bg-[repeating-linear-gradient(90deg,#f0f0ef_0px,#f0f0ef_3px,#f7f7f6_3px,#f7f7f6_6px)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#20724f_0%,#0f5b42_100%)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px] text-[#676767]">
        <span>
          <span className="font-medium text-[#1f1f1f]">{formatCurrency(current)}</span> de
        </span>
        <span>{formatCurrency(target)}</span>
      </div>
    </div>
  );
}

function SourceDualPanel({
  title,
  actionLabel,
  children,
}: {
  title: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-[18px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[16px] font-medium text-[#1f1f1f]">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#f4f4f3] text-[#676767]">
            <LayoutGrid className="h-4 w-4" />
          </span>
          {title}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ececeb] bg-white px-4 py-2 text-[12px] font-medium text-[#676767]">
          {actionLabel}
        </div>
      </div>
      {children}
    </div>
  );
}

function SourceSplitCards({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return <div className="grid gap-[14px] md:grid-cols-[1.2fr_0.86fr]">{left}{right}</div>;
}

function WeekChart({
  values,
  expenses,
}: {
  values: { date: string; value: number }[];
  expenses?: { date: string; value: number }[];
}) {
  const maxValue = Math.max(
    1,
    ...values.map((item) => item.value),
    ...(expenses ? expenses.map((item) => item.value) : [0])
  );

  return (
    <div className="rounded-[26px] bg-[#f6f6f3] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-950">Leitura semanal</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">últimos 7 dias</div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-lime-400" />
            Receita
          </span>
          {expenses ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
              Gasto
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid h-[214px] grid-cols-7 items-end gap-3">
        {values.map((item, index) => {
          const revenueHeight = Math.max(10, (item.value / maxValue) * 134);
          const expenseValue = expenses?.[index]?.value ?? 0;
          const expenseHeight = Math.max(10, (expenseValue / maxValue) * 134);

          return (
            <div key={item.date} className="flex flex-col items-center gap-3">
              <div className="flex h-[152px] items-end gap-1.5">
                <div className="w-3 rounded-full bg-lime-400" style={{ height: `${revenueHeight}px` }} />
                {expenses ? <div className="w-3 rounded-full bg-slate-900" style={{ height: `${expenseHeight}px` }} /> : null}
              </div>
              <span className="text-xs font-medium text-slate-400">{formatShortDate(item.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceActivityCard({
  rows,
  subtitle,
}: {
  rows: RecentRecord[];
  subtitle: string;
}) {
  return (
    <div className="rounded-[18px] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-[18px] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[18px] font-medium tracking-[-0.03em] text-[#1f1f1f]">Recent Activities</div>
          <div className="mt-1 text-[12px] font-normal text-[#676767]">{subtitle}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ececeb] bg-white px-[14px] text-[13px] font-medium text-[#676767]">
            <Search className="h-[15px] w-[15px]" />
            Buscar
          </div>
          <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ececeb] bg-white px-4 text-[13px] font-medium text-[#676767]">
            {rows.length} itens
          </div>
        </div>
      </div>

      <ActivityList rows={rows} />
    </div>
  );
}

function SourceChartCard({
  title,
  subtitle,
  values,
  expenses,
}: {
  title: string;
  subtitle: string;
  values: { date: string; value: number }[];
  expenses?: { date: string; value: number }[];
}) {
  return (
    <div className="rounded-[18px] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-1 text-[14px] font-medium text-[#1f1f1f]">{title}</div>
      <div className="mb-4 text-[12px] font-normal text-[#676767]">{subtitle}</div>
      <WeekChart values={values} expenses={expenses} />
    </div>
  );
}

function ActivityList({ rows }: { rows: RecentRecord[] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#ececeb] bg-white">
      <table className="w-full min-w-[620px] border-collapse">
        <thead>
          <tr className="bg-[#fafaf9]">
            <th className="w-[42px] border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]" />
            <th className="border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]">Data</th>
            <th className="border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]">Atividade</th>
            <th className="border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]">Valor</th>
            <th className="border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]">Status</th>
            <th className="border-b border-[#ececeb] px-4 py-3 text-left text-[12px] font-medium text-[#999999]">Closer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const net = row.faturamento - row.valor_pago;
            const positive = net >= 0;

            return (
              <tr key={row.id}>
                <td className="border-b border-[#ececeb] px-4 py-3 align-middle">
                  <span className="inline-grid h-4 w-4 place-items-center rounded-[4px] border border-[#d9d9d8] bg-white" />
                </td>
                <td className="border-b border-[#ececeb] px-4 py-3 text-[13px] font-medium text-[#676767]">
                  {formatShortDate(row.date)}
                </td>
                <td className="border-b border-[#ececeb] px-4 py-3">
                  <div className="flex items-center gap-3 text-[13px] font-medium text-[#1f1f1f]">
                    <span className="inline-grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-[#f2f2f1] text-[9px] text-[#676767]">
                      {row.handle.replace("@", "").slice(0, 2).toUpperCase()}
                    </span>
                    {row.handle}
                  </div>
                </td>
                <td className={cn("border-b border-[#ececeb] px-4 py-3 text-[13px] font-medium", positive ? "text-emerald-700" : "text-red-700")}>
                  {positive ? "+" : "-"}
                  {formatCurrency(Math.abs(net))}
                </td>
                <td className="border-b border-[#ececeb] px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium",
                      positive ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    <span className="h-[6px] w-[6px] rounded-full bg-current" />
                    {positive ? "Receita" : "Despesa"}
                  </span>
                </td>
                <td className="border-b border-[#ececeb] px-4 py-3 text-[13px] text-[#999999]">
                  {row.closerName || "Operação"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const isManagementView = isAdmin || isSubAdmin;
  const month = useMemo(() => getCurrentMonth(), []);
  const greeting = getGreeting();
  const monthLabel = getMonthLabel(month);

  const [resultado, setResultado] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closerData, setCloserData] = useState<CloserHomeData | null>(null);
  const [adminData, setAdminData] = useState<AdminHomeData | null>(null);

  const { feeRate } = useTeamFeeRate(user?.teamId);
  const { currentPercentage, nextThreshold, amountMissing } = useCommissionTier(resultado);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      const { startDate, endDateStr } = getMonthRange(month);
      const lastSevenDays = getLastSevenDays();

      if (!isManagementView) {
        const [recordsRes, locksRes, influencersRes, tiersRes] = await Promise.all([
          supabase
            .from("daily_influencer_records")
            .select("id, date, valor_pago, faturamento, created_at, influencers!inner(handle)")
            .eq("closer_id", user.id)
            .gte("date", startDate)
            .lte("date", endDateStr)
            .is("deleted_at", null)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("influencer_locks")
            .select("id")
            .eq("locked_by_user_id", user.id)
            .gt("locked_until", new Date().toISOString()),
          supabase.from("influencers").select("id").eq("owner_id", user.id).eq("ativo", true),
          supabase
            .from("commission_tiers")
            .select("tier_order, percentage, threshold_result")
            .eq("team_id", "default")
            .order("tier_order", { ascending: true }),
        ]);

        const records = (recordsRes.data || []) as any[];
        const tiers = (tiersRes.data || []) as any[];

        let invested = 0;
        let revenue = 0;
        const perDay = new Map<string, number>();

        records.forEach((record) => {
          const cost = Number(record.valor_pago) || 0;
          const gross = Number(record.faturamento) || 0;
          invested += cost;
          revenue += gross;
          perDay.set(record.date, (perDay.get(record.date) || 0) + (gross - cost));
        });

        const fee = revenue * feeRate;
        const result = revenue - invested - fee;
        const fallbackPercentage = getTierPercentage(result, tiers);

        const snapshots = await getTeamThermometerSnapshots(month, tiers);
        const teamSnapshots = snapshots
          .filter((snapshot) => snapshot.teamId === user.teamId)
          .sort((a, b) => b.result - a.result);
        const mySnapshot = teamSnapshots.find((snapshot) => snapshot.userId === user.id);

        setResultado(result);
        setCloserData({
          revenue,
          invested,
          fee,
          result,
          estimatedCommission: getEstimatedCommission(result, mySnapshot?.percentage ?? fallbackPercentage),
          teamRank:
            teamSnapshots.findIndex((snapshot) => snapshot.userId === user.id) >= 0
              ? teamSnapshots.findIndex((snapshot) => snapshot.userId === user.id) + 1
              : null,
          activeLocks: (locksRes.data || []).length,
          managedInfluencers: (influencersRes.data || []).length,
          todayEntries: records.filter((record) => record.date === lastSevenDays[lastSevenDays.length - 1]).length,
          recentRecords: records.slice(0, 5).map((record) => ({
            id: record.id,
            date: record.date,
            valor_pago: Number(record.valor_pago) || 0,
            faturamento: Number(record.faturamento) || 0,
            handle: record.influencers?.handle || "@influenciador",
          })),
          weekSeries: lastSevenDays.map((date) => ({ date, value: perDay.get(date) || 0 })),
        });
        setAdminData(null);
      } else {
        const [tiersRes, recordsRes, profilesRes, teamsRes, locksRes] = await Promise.all([
          supabase
            .from("commission_tiers")
            .select("tier_order, percentage, threshold_result")
            .eq("team_id", "default")
            .order("tier_order", { ascending: true }),
          supabase
            .from("daily_influencer_records")
            .select("id, date, valor_pago, faturamento, closer_id, team_id, created_at, influencers!inner(handle)")
            .gte("date", startDate)
            .lte("date", endDateStr)
            .is("deleted_at", null)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("id, nome, team_id"),
          supabase.from("teams").select("id, name"),
          supabase.from("influencer_locks").select("id, team_id, locked_until"),
        ]);

        const tiers = (tiersRes.data || []) as any[];
        const profileMap = new Map<string, string>();
        ((profilesRes.data || []) as any[]).forEach((profile) => profileMap.set(profile.id, profile.nome));

        const snapshots = await getTeamThermometerSnapshots(month, tiers);
        const allowedSnapshots = isAdmin ? snapshots : snapshots.filter((snapshot) => snapshot.teamId === user.teamId);
        const allowedTeamIds = new Set(allowedSnapshots.map((snapshot) => snapshot.teamId).filter(Boolean) as string[]);
        const allRecords = ((recordsRes.data || []) as any[]).filter((record) => (isAdmin ? true : record.team_id === user.teamId));
        const allTeams = (teamsRes.data || []) as any[];

        const revenue = allowedSnapshots.reduce((sum, snapshot) => sum + snapshot.revenue, 0);
        const invested = allowedSnapshots.reduce((sum, snapshot) => sum + snapshot.invested, 0);
        const result = allowedSnapshots.reduce((sum, snapshot) => sum + snapshot.result, 0);

        const perDay = new Map<string, { revenue: number; invested: number }>();
        allRecords.forEach((record) => {
          const entry = perDay.get(record.date) || { revenue: 0, invested: 0 };
          entry.revenue += Number(record.faturamento) || 0;
          entry.invested += Number(record.valor_pago) || 0;
          perDay.set(record.date, entry);
        });

        const teamSummaryMap = new Map<string, { revenue: number; result: number; closers: number }>();
        allowedSnapshots.forEach((snapshot) => {
          const key = snapshot.teamId || "sem-time";
          const existing = teamSummaryMap.get(key) || { revenue: 0, result: 0, closers: 0 };
          existing.revenue += snapshot.revenue;
          existing.result += snapshot.result;
          existing.closers += 1;
          teamSummaryMap.set(key, existing);
        });

        setResultado(result);
        setAdminData({
          revenue,
          invested,
          result,
          adminFee: revenue * TAX_TOTAL,
          activeClosers: allowedSnapshots.length,
          activeLocks: ((locksRes.data || []) as any[]).filter(
            (lock) => new Date(lock.locked_until).getTime() > Date.now() && (isAdmin || allowedTeamIds.has(lock.team_id))
          ).length,
          teamsCount: isAdmin ? allowedTeamIds.size : 1,
          recentRecords: allRecords.slice(0, 6).map((record) => ({
            id: record.id,
            date: record.date,
            valor_pago: Number(record.valor_pago) || 0,
            faturamento: Number(record.faturamento) || 0,
            handle: record.influencers?.handle || "@influenciador",
            closerName: profileMap.get(record.closer_id) || "Closer",
          })),
          topClosers: [...allowedSnapshots].sort((a, b) => b.result - a.result).slice(0, 5),
          teamsSummary: Array.from(teamSummaryMap.entries())
            .map(([teamId, value]) => ({
              id: teamId,
              name: allTeams.find((team) => team.id === teamId)?.name || "Sem time",
              closers: value.closers,
              revenue: value.revenue,
              result: value.result,
            }))
            .sort((a, b) => b.result - a.result),
          weekSeries: lastSevenDays.map((date) => ({
            date,
            revenue: perDay.get(date)?.revenue || 0,
            invested: perDay.get(date)?.invested || 0,
          })),
        });
        setCloserData(null);
      }

      setLoading(false);
    };

    fetchData();
  }, [user, month, feeRate, isManagementView, isAdmin]);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];
  const progressTarget = nextThreshold ?? Math.max(resultado, 1);

  return (
    <>
      <div className="mb-2">
            <div className="max-w-[62rem]">
              <h1 className="max-w-4xl text-[42px] font-medium leading-[1.05] tracking-[-0.06em] text-slate-950 sm:text-[50px]">
                {greeting}, {firstName}
              </h1>
              <p className="mt-[10px] whitespace-nowrap text-[14px] font-normal leading-7 text-slate-500/90">
                {isManagementView
                  ? "Acompanhe a saúde financeira da operação, o ritmo da equipe e os movimentos do mês em uma visão executiva."
                  : "Acompanhe sua comissão, seu ritmo operacional e os movimentos do mês em uma leitura mais clara."}
              </p>
            </div>
          </div>

      {loading ? (
        <div className="mt-12">
          <ShellCard
            title="Carregando a operação"
            subtitle="Estamos montando a nova home com os dados mais recentes do período."
          >
            <div className="py-12 text-sm text-slate-500">Aguarde um instante...</div>
          </ShellCard>
        </div>
      ) : null}

      {!loading && closerData ? (
        <div className="mt-1 space-y-3">
          <div className="grid gap-6 xl:grid-cols-[560px_minmax(0,1fr)]">
            <div className="grid w-full gap-[18px]">
              <SourceTopBalanceCard
                heading="Patrimônio Total"
                value={formatCurrency(closerData.result)}
                delta={closerData.result >= 0 ? "↑ ritmo positivo" : "↓ atenção"}
                deltaNote="no mês atual"
                topPill={monthLabel}
                miniCards={[
                  { title: "Receita", value: formatCompactCurrency(closerData.revenue), note: "Faturamento acumulado", status: "Active" },
                  { title: "Gasto", value: formatCompactCurrency(closerData.invested), note: "Investimento no período", status: "Active" },
                  { title: "Comissão", value: formatCompactCurrency(closerData.estimatedCommission), note: "Estimativa atual", status: "Projected" },
                ]}
              />

              <SourceTrackCard title="Meta diária do time" current={resultado} target={progressTarget} />

              <SourceDualPanel title="Meu Espaço" actionLabel="Fluxo ativo">
                <SourceSplitCards
                  left={
                    <div className="rounded-[16px] bg-[linear-gradient(180deg,#1e1b17_0%,#26211b_100%)] p-4 text-white">
                      <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium">Closer</div>
                      <div className="mt-10 text-[13px] text-white/60">Meta atual</div>
                      <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">{currentPercentage}% de comissão</div>
                      <div className="mt-5 grid grid-cols-3 gap-3 text-[10px]">
                        <div>
                          <div className="text-white/55">Ranking</div>
                          <div className="mt-1 text-[13px] font-medium text-white">{closerData.teamRank ? `#${closerData.teamRank}` : "--"}</div>
                        </div>
                        <div>
                          <div className="text-white/55">Hoje</div>
                          <div className="mt-1 text-[13px] font-medium text-white">{closerData.todayEntries}</div>
                        </div>
                        <div>
                          <div className="text-white/55">Influs</div>
                          <div className="mt-1 text-[13px] font-medium text-white">{closerData.managedInfluencers}</div>
                        </div>
                      </div>
                    </div>
                  }
                  right={
                    <div className="rounded-[16px] bg-[linear-gradient(180deg,#305c35_0%,#133c30_100%)] p-4 text-white">
                      <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium">Ativo</div>
                      <div className="mt-10 text-[13px] text-white/60">Travamentos</div>
                      <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">{closerData.activeLocks}</div>
                    </div>
                  }
                />
              </SourceDualPanel>
            </div>

            <CloserSharedBoard />
          </div>
        </div>
      ) : null}

      {!loading && adminData ? (
        <div className="mt-1 space-y-3">
          <div className="flex justify-end">
            <div className="inline-flex items-center rounded-full border border-[#ececeb] bg-white px-4 py-3 text-[13px] font-medium text-[#676767]">
              {monthLabel}
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.12fr_0.98fr_1fr]">
                <SourceTopBalanceCard
                  heading={isAdmin ? "Visão Global" : "Visão do Time"}
                  value={formatCurrency(adminData.revenue)}
                  delta={adminData.result >= 0 ? "↑ margem positiva" : "↓ margem sob pressão"}
                  deltaNote="na operação"
                  topPill={isAdmin ? "Admin" : "SubAdmin"}
                  miniCards={[
                    { title: "Receita", value: formatCompactCurrency(adminData.revenue), note: "Receita total do período", status: "Active" },
                    { title: "Gasto", value: formatCompactCurrency(adminData.invested), note: "Investimento consolidado", status: "Active" },
                    { title: "Taxa Admin", value: formatCompactCurrency(adminData.adminFee), note: "Incidência operacional", status: "Projected" },
                  ]}
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                  <SourceStatCard label="Closers Ativos" value={String(adminData.activeClosers)} delta="↑ equipe" note={isAdmin ? `${adminData.teamsCount} times` : "time atual"} icon={Users} highlight />
                  <SourceStatCard label="Travamentos" value={String(adminData.activeLocks)} delta="• janela ativa" note="10 dias" icon={Shield} />
                  <SourceStatCard label="Resultado" value={formatCompactCurrency(adminData.result)} delta={adminData.result >= 0 ? "↑ margem" : "↓ margem"} note="operacional" icon={DollarSign} />
                  <SourceStatCard label="Times" value={String(adminData.teamsCount)} delta="• leitura" note="escopo atual" icon={LayoutGrid} />
                </div>

                <SourceChartCard
                  title="Total Income"
                  subtitle="View your income in a certain period of time"
                  values={adminData.weekSeries.map((item) => ({ date: item.date, value: item.revenue }))}
                  expenses={adminData.weekSeries.map((item) => ({ date: item.date, value: item.invested }))}
                />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.96fr_1.52fr]">
            <div className="grid gap-[18px]">
                  <SourceTrackCard title="Progressão da Operação" current={adminData.result} target={Math.max(adminData.revenue, 1)} />

                  <SourceDualPanel title="Leitura Executiva" actionLabel="Ao vivo">
                    <SourceSplitCards
                      left={
                        <div className="rounded-[16px] bg-[linear-gradient(180deg,#1e1b17_0%,#26211b_100%)] p-4 text-white">
                          <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium">Top closer</div>
                          <div className="mt-10 text-[13px] text-white/60">Destaque</div>
                          <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">
                            {adminData.topClosers[0]?.nome || "Sem dados"}
                          </div>
                          <div className="mt-5 grid grid-cols-2 gap-3 text-[10px]">
                            <div>
                              <div className="text-white/55">Resultado</div>
                              <div className="mt-1 text-[13px] font-medium text-white">{adminData.topClosers[0] ? formatCompactCurrency(adminData.topClosers[0].result) : "--"}</div>
                            </div>
                            <div>
                              <div className="text-white/55">Comissão</div>
                              <div className="mt-1 text-[13px] font-medium text-white">{adminData.topClosers[0] ? `${adminData.topClosers[0].percentage}%` : "--"}</div>
                            </div>
                          </div>
                        </div>
                      }
                      right={
                        <div className="rounded-[16px] bg-[linear-gradient(180deg,#305c35_0%,#133c30_100%)] p-4 text-white">
                          <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium">Escopo</div>
                          <div className="mt-10 text-[13px] text-white/60">Times ativos</div>
                          <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">{adminData.teamsCount}</div>
                        </div>
                      }
                    />
                  </SourceDualPanel>
            </div>
            <SourceActivityCard rows={adminData.recentRecords} subtitle="Movimentos mais recentes do período." />
          </div>
        </div>
      ) : null}
    </>
  );
}
