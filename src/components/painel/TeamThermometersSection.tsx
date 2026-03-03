import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Thermometer, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, User } from "lucide-react";
import MiniThermometer from "./MiniThermometer";
import ThermometerDrawerContent from "./ThermometerDrawerContent";
import type { CommissionTier } from "@/hooks/useCommissionTier";
import { getTeamThermometerSnapshots, type ThermometerSnapshot } from "@/lib/thermometerSnapshot";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

type SortMode = "percentage" | "result" | "commission" | "az";

export default function TeamThermometersSection() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [snapshots, setSnapshots] = useState<ThermometerSnapshot[]>([]);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("result");
  const [selectedUser, setSelectedUser] = useState<ThermometerSnapshot | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch tiers
      const { data: tierData } = await supabase
        .from("commission_tiers")
        .select("tier_order, percentage, threshold_result")
        .eq("team_id", "default")
        .order("tier_order", { ascending: true });

      const fetchedTiers = (tierData as any as CommissionTier[]) || [];
      setTiers(fetchedTiers);

      const snaps = await getTeamThermometerSnapshots(month, fetchedTiers);
      setSnapshots(snaps);
      setLoading(false);
    };
    fetchData();
  }, [month]);

  const filtered = useMemo(() => {
    let list = snapshots;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.nome.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case "percentage":
          return b.percentage - a.percentage || b.result - a.result;
        case "result":
          return b.result - a.result;
        case "commission":
          return b.estimatedCommission - a.estimatedCommission;
        case "az":
          return a.nome.localeCompare(b.nome);
        default:
          return 0;
      }
    });

    return list;
  }, [snapshots, search, sortMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Thermometer className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Termômetros do Time</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-[190px] h-9 text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="result">Maior resultado</SelectItem>
            <SelectItem value="percentage">Maior % do mês</SelectItem>
            <SelectItem value="commission">Maior comissão</SelectItem>
            <SelectItem value="az">A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum membro encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((snap) => (
            <button
              key={snap.userId}
              onClick={() => setSelectedUser(snap)}
              className="text-left rounded-xl border border-border/40 bg-card p-4 hover:border-border hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left content */}
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Name + role badge */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{snap.nome}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground"
                    >
                      {snap.role}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">% atual</span>
                      <span className="font-semibold text-foreground">{snap.percentage}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Resultado</span>
                      <span className={`font-semibold tabular-nums ${snap.result >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {formatBRL(snap.result)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Comissão est.</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatBRL(snap.estimatedCommission)}
                      </span>
                    </div>
                  </div>

                  {/* Next tier */}
                  {snap.missingToNextTier !== null && snap.nextTierTarget !== null && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Faltam {formatBRL(snap.missingToNextTier)} para {
                        tiers.find((t) => t.threshold_result === snap.nextTierTarget)?.percentage ?? "?"
                      }%
                    </p>
                  )}
                </div>

                {/* Right: mini thermometer */}
                <div className="flex-shrink-0 pt-1">
                  <MiniThermometer
                    result={snap.result}
                    percentage={snap.percentage}
                    tiers={tiers}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-[520px] p-0 flex flex-col overflow-hidden">
          {/* Sticky Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">{selectedUser?.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  Termômetro e Lista do Mês — {monthOptions.find((o) => o.value === month)?.label}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedUser(null)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {selectedUser && (
              <div className="p-5 min-w-0">
                <ThermometerDrawerContent closerId={selectedUser.userId} initialMonth={month} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

