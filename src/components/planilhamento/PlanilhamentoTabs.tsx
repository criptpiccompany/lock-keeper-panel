import { useState, useEffect, useMemo } from "react";
import { FileText, BarChart3, ListChecks, Trophy, User, Radar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PlanilhamentoDiario from "./PlanilhamentoDiario";
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

export default function PlanilhamentoTabs() {
  const { user, isAdmin } = useAuth();

  // CLOSER view
  const [closerTab, setCloserTab] = useState<SubTabId>("diario");

  // ADMIN view
  const [adminTab, setAdminTab] = useState<string>("ranking");
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
        <div className="border-b">
          <div className="container px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Planilhamento</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestão financeira diária dos influenciadores
            </p>
          </div>
        </div>

        <div className="border-b bg-card">
          <div className="container px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1 overflow-x-auto scrollbar-none">
              {subTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = closerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCloserTab(tab.id)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 py-6">
          {closerTab === "diario" && <PlanilhamentoDiario />}
          {closerTab === "balanco" && <Balanco />}
          {closerTab === "lista-mes" && <ListaDoMes />}
        </div>
      </div>
    );
  }

  // ── ADMIN view ──
    return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Planilhamento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão financeira da equipe
          </p>
        </div>
      </div>

      {/* Level 1 tabs */}
      <div className="border-b bg-card">
        <div className="container px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleAdminTabClick("ranking")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                adminTab === "ranking" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Ranking Semanal</span>
              <span className="sm:hidden">Ranking</span>
              {adminTab === "ranking" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
            <button
              onClick={() => handleAdminTabClick("conflitos")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                adminTab === "conflitos" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              <Radar className="h-4 w-4" />
              Conflitos
              {adminTab === "conflitos" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
            {closers.map((closer) => {
              const isActive = adminTab === closer.id;
              const unseen = hasUnseen(closer.id, closer.lastActivity);
              return (
                <button
                  key={closer.id}
                  onClick={() => handleAdminTabClick(closer.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
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
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Level 2 sub-tabs */}
      {adminTab !== "ranking" && adminTab !== "conflitos" && (
        <div className="border-b bg-muted/20">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
              <span className="text-xs text-muted-foreground font-medium py-2 whitespace-nowrap">
                {selectedCloserName}:
              </span>
              <nav className="flex gap-1">
                {subTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = subTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSubTab(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
                        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container px-4 sm:px-6 lg:px-8 py-6">
        {adminTab === "ranking" && <RankingSemanal />}
        {adminTab === "conflitos" && <ConflictRadar />}
        {adminTab !== "ranking" && adminTab !== "conflitos" && subTab === "diario" && (
          <PlanilhamentoDiario closerId={adminTab} />
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
