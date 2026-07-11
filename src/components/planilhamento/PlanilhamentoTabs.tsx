import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, BarChart3, ListChecks, Trophy, User, Radar, UserCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PlanilhamentoCalendarWorkspace from "./PlanilhamentoCalendarWorkspace";
import Balanco from "./Balanco";
import ListaDoMes from "./ListaDoMes";
import RankingSemanal from "./RankingSemanal";
import ConflictRadar from "./ConflictRadar";

const subTabs = [
  { id: "diario", label: "Planilhamento Diário", icon: FileText },
  { id: "balanco", label: "Balanço", icon: BarChart3 },
  { id: "lista-mes", label: "Lista do Mês", icon: ListChecks },
] as const;

type SubTabId = (typeof subTabs)[number]["id"];

interface CloserInfo {
  id: string;
  nome: string;
  lastActivity: string;
}

const STORAGE_KEY = "planilhamento_tab_last_viewed";

function PillTabGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-[6px] rounded-[22px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export default function PlanilhamentoTabs() {
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();

  // CLOSER view
  const [closerTab, setCloserTab] = useState<SubTabId>("diario");

  // ADMIN view — default to "ranking" if ?tab=ranking
  const initialAdminTab = searchParams.get("tab") === "ranking" ? "ranking" : "ranking";
  const [adminTab, setAdminTab] = useState<string>(initialAdminTab);
  const [subTab, setSubTab] = useState<SubTabId>("diario");
  const [closers, setClosers] = useState<CloserInfo[]>([]);
  const [lastViewed, setLastViewed] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });

  // Fetch closers with latest activity for admin
  useEffect(() => {
    if (!isAdmin) return;
    const fetchClosers = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .order("nome");

      if (!profiles) return;

      // Get latest record per closer
      const { data: latestRecords } = await supabase
        .from("daily_influencer_records")
        .select("closer_id, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      const latestMap = new Map<string, string>();
      (latestRecords || []).forEach((r: any) => {
        if (!latestMap.has(r.closer_id)) {
          latestMap.set(r.closer_id, r.updated_at);
        }
      });

      const closerList: CloserInfo[] = profiles.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        lastActivity: latestMap.get(p.id) || "",
      }));

      // Sort by most recent activity (users with activity first, then alphabetically)
      closerList.sort((a, b) => {
        if (!a.lastActivity && !b.lastActivity) return a.nome.localeCompare(b.nome);
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return b.lastActivity.localeCompare(a.lastActivity);
      });

      setClosers(closerList);
    };
    fetchClosers();
  }, [isAdmin]);

  const hasUnseen = (closerId: string, lastActivity: string): boolean => {
    if (!lastActivity) return false;
    const viewed = lastViewed[closerId];
    return !viewed || lastActivity > viewed;
  };

  const handleAdminTabClick = (tabId: string) => {
    setAdminTab(tabId);
    if (tabId !== "ranking") {
      const now = new Date().toISOString();
      const updated = { ...lastViewed, [tabId]: now };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setLastViewed(updated);
      setSubTab("diario");
    }
  };

  const selectedCloserName = closers.find((c) => c.id === adminTab)?.nome;

  // ── CLOSER view ──
  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <div className="container px-4 pt-3 sm:px-6 lg:px-8">
          <PillTabGroup className="max-w-full overflow-x-auto scrollbar-none">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = closerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCloserTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
                    isActive ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </PillTabGroup>
        </div>

        <div className="container px-4 py-5 sm:px-6 lg:px-8">
          {closerTab === "diario" && <PlanilhamentoCalendarWorkspace />}
          {closerTab === "balanco" && <Balanco />}
          {closerTab === "lista-mes" && <ListaDoMes />}
        </div>
      </div>
    );
  }

  // ── ADMIN view ──
    return (
    <div className="min-h-screen">
      {/* Level 1 tabs */}
      <div className="container px-4 pt-3 sm:px-6 lg:px-8">
        <PillTabGroup className="max-w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleAdminTabClick("ranking")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
              adminTab === "ranking" ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking Semanal</span>
            <span className="sm:hidden">Ranking</span>
          </button>
          <button
            onClick={() => handleAdminTabClick("conflitos")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
              adminTab === "conflitos" ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Radar className="h-4 w-4" />
            Conflitos
          </button>
          {closers.map((closer) => {
            const isActive = adminTab === closer.id;
            const unseen = hasUnseen(closer.id, closer.lastActivity);
            return (
              <button
                key={closer.id}
                onClick={() => handleAdminTabClick(closer.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
                  isActive ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <User className="h-4 w-4" />
                {closer.nome}
                {unseen && !isActive && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                  </span>
                )}
              </button>
            );
          })}
        </PillTabGroup>
      </div>

      {/* Level 2 sub-tabs */}
      {adminTab !== "ranking" && adminTab !== "conflitos" && (
        <div className="container px-4 pt-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-medium tracking-[0.08em] text-[#8a8a8a] uppercase whitespace-nowrap">
              {selectedCloserName}
            </span>
            <PillTabGroup className="max-w-full overflow-x-auto scrollbar-none">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors whitespace-nowrap ${
                      isActive ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </PillTabGroup>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container px-4 py-5 sm:px-6 lg:px-8">
        {adminTab === "ranking" && <RankingSemanal />}
        {adminTab === "conflitos" && <ConflictRadar />}
        {adminTab !== "ranking" && adminTab !== "conflitos" && subTab === "diario" && (
          <PlanilhamentoCalendarWorkspace closerId={adminTab} />
        )}
        {adminTab !== "ranking" && adminTab !== "conflitos" && subTab === "balanco" && (
          <Balanco closerId={adminTab} />
        )}
        {adminTab !== "ranking" && adminTab !== "conflitos" && subTab === "lista-mes" && (
          <ListaDoMes closerId={adminTab} />
        )}
      </div>
    </div>
  );
}
