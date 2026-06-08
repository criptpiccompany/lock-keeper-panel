import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, AtSign, ChevronDown, ChevronRight, Clock3, ExternalLink, FileText, Link as LinkIcon, MoreHorizontal, Plus, Search, SlidersHorizontal, Tag, Wallet, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLASSIFICACAO_OPTIONS, type KanbanCard } from "@/components/kanban/types";

type TeamBoardCard = KanbanCard & {
  closerName: string;
  assigned_to?: string | null;
  assignedName?: string | null;
};

type TeamMember = { id: string; nome: string };

type SortField = "status" | "display_name" | "classificacao" | "closerName" | "valor_negociado" | "last_moved_at";
type SortDir = "asc" | "desc";
type ColumnKey =
  | "check"
  | "status"
  | "display_name"
  | "classificacao"
  | "sites"
  | "closerName"
  | "apoios"
  | "valor_negociado"
  | "last_moved_at";

const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  Fechar: { bg: "#f3e8ff", text: "#7c3aed", dot: "#7c3aed" },
  Abordado: { bg: "#ffedd5", text: "#c2410c", dot: "#c2410c" },
  Negociando: { bg: "#f3f4f6", text: "#4b5563", dot: "#4b5563" },
  Positivo: { bg: "#eefbf3", text: "#1e9d55", dot: "#1e9d55" },
  "Empatando / Negociar": { bg: "#fff4db", text: "#c87712", dot: "#c87712" },
  Pausado: { bg: "#fee7e6", text: "#db3a34", dot: "#db3a34" },
  "Com a equipe": { bg: "#e8f8ec", text: "#23a455", dot: "#23a455" },
  "Não posta mais": { bg: "#edf0f3", text: "#617184", dot: "#617184" },
  Golpe: { bg: "#ffe1df", text: "#dc2626", dot: "#dc2626" },
};

const STATUS_ORDER: Record<string, number> = {
  Positivo: 0,
  "Empatando / Negociar": 1,
  Pausado: 2,
  "Com a equipe": 3,
  "Não posta mais": 4,
  Negociando: 5,
  Abordado: 6,
  Fechar: 7,
  Golpe: 99,
};

const COLUMN_DEFS: Array<{ key: ColumnKey; label: string; width: string; sortable?: boolean }> = [
  { key: "classificacao", label: "Engaj.", width: "48px", sortable: true },
  { key: "status", label: "Status", width: "minmax(110px,0.9fr)", sortable: true },
  { key: "display_name", label: "Influenciador", width: "minmax(160px,2.2fr)", sortable: true },
  { key: "apoios", label: "Ponte", width: "minmax(80px,1fr)" },
  { key: "valor_negociado", label: "Valor", width: "minmax(90px,1fr)", sortable: true },
  { key: "last_moved_at", label: "Att", width: "minmax(70px,0.7fr)", sortable: true },
];

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: "status", label: "Status" },
  { value: "display_name", label: "Influenciador" },
  { value: "classificacao", label: "Engajamento" },
  { value: "closerName", label: "Agente / SDR" },
  { value: "valor_negociado", label: "Valor" },
  { value: "last_moved_at", label: "Last Att" },
];

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatRelative(date: string) {
  const movedAt = new Date(date).getTime();
  const diff = Date.now() - movedAt;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes || 0}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const ENGAGEMENT_META: Record<string, { color: string; percent: number }> = {
  Fraca: { color: "#dc2626", percent: 33 },
  Média: { color: "#eab308", percent: 66 },
  Forte: { color: "#16a34a", percent: 100 },
  Prioridade: { color: "#f97316", percent: 100 },
};

function EngagementDot({ value }: { value: string | null }) {
  if (value === "Prioridade") {
    return (
      <span className="text-[14px] leading-none" title="Prioridade">🔥</span>
    );
  }
  const meta = value ? ENGAGEMENT_META[value] : null;
  if (!meta) {
    return (
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-[#e0e0dc]"
        title="Sem engajamento"
      />
    );
  }

  const angle = (meta.percent / 100) * 360;
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full"
      style={{
        background: `conic-gradient(${meta.color} ${angle}deg, #ececea ${angle}deg 360deg)`,
        WebkitMask: "radial-gradient(circle, transparent 38%, #000 40%)",
        mask: "radial-gradient(circle, transparent 38%, #000 40%)",
      }}
      title={value!}
    />
  );
}


function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.Fechar;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.dot }} />
      {status}
    </span>
  );
}

function InlineCell({
  children,
  content,
  align = "start",
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-w-0 rounded-md text-left transition-colors hover:bg-[#f7f7f5]",
            align === "center" && "flex items-center justify-center",
            className
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto min-w-[180px] rounded-[12px] border-[#e7e7e3] p-1.5 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.22)]">
        {content}
      </PopoverContent>
    </Popover>
  );
}

function TableRow({
  card,
  visibleColumns,
  gridTemplateColumns,
  onUpdate,
}: {
  card: TeamBoardCard;
  visibleColumns: Array<{ key: ColumnKey; label: string; width: string; sortable?: boolean }>;
  gridTemplateColumns: string;
  onUpdate?: (cardId: string, fields: Partial<KanbanCard>) => Promise<void>;
}) {
  return (
    <div
      className="grid items-center gap-1.5 border-b border-[#efefec] px-4 py-2.5 text-[12px] text-[#52524f]"
      style={{ gridTemplateColumns }}
    >
      {visibleColumns.map((column) => {
        switch (column.key) {
          case "check":
            return (
              <div key={column.key} className="grid place-items-center">
                <span className="h-3.5 w-3.5 rounded-full border border-[#d8d8d3] bg-white" />
              </div>
            );
          case "status":
            return (
              <div key={column.key}>
                <InlineCell
                  content={
                    <div className="space-y-0.5">
                      {Object.keys(STATUS_META).filter((status) => status !== "Golpe").map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => onUpdate?.(card.id, { status })}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px] text-[#3d3d39] hover:bg-[#f7f7f5]",
                            card.status === status && "bg-[#f7f7f5]"
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_META[status].dot }} />
                          {status}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <StatusPill status={card.status} />
                </InlineCell>
              </div>
            );
          case "display_name":
            return (
              <div key={column.key} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("truncate font-medium text-[#1f1f1f]", card.status === "Golpe" && "text-red-600")}>
                    {card.display_name}
                  </span>
                  {card.instagram_url ? (
                    <a
                      href={card.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[#b2b2ad] transition-colors hover:text-[#71716c]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          case "classificacao":
            return (
              <div key={column.key} className="flex items-center">
                <InlineCell
                  align="center"
                  className="grid h-6 w-6 place-items-center"
                  content={
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => onUpdate?.(card.id, { classificacao: null })}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px] text-[#8a8a84] hover:bg-[#f7f7f5]",
                          !card.classificacao && "bg-[#f7f7f5]"
                        )}
                      >
                        <EngagementDot value={null} />
                        Nenhum
                      </button>
                      {CLASSIFICACAO_OPTIONS.map((option) => {
                        const meta = ENGAGEMENT_META[option.value];
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onUpdate?.(card.id, { classificacao: option.value })}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px] font-medium hover:bg-[#f7f7f5]",
                              card.classificacao === option.value && "bg-[#f7f7f5]"
                            )}
                            style={{ color: meta?.color ?? "#3d3d39" }}
                          >
                            <EngagementDot value={option.value} />
                            {option.value}
                          </button>
                        );
                      })}
                    </div>
                  }
                >
                  <EngagementDot value={card.classificacao} />
                </InlineCell>
              </div>
            );
          case "sites":
            return (
              <div key={column.key} className="text-[#c0c0bc]">
                —
              </div>
            );
          case "closerName":
            return (
              <div key={column.key} className="truncate text-[11px] text-[#7b7b77]">
                {card.closerName || "—"}
              </div>
            );
          case "apoios":
            return (
              <div key={column.key} className="min-w-0">
                <BridgeCell card={card} onUpdate={onUpdate} />
              </div>
            );
          case "valor_negociado":
            return (
              <div key={column.key} className="text-[11px] font-medium text-[#2a2a28]">
                <InlineCell
                  content={<ValueEditor card={card} onUpdate={onUpdate} />}
                  className="w-full"
                >
                  {formatCurrency(card.valor_negociado)}
                </InlineCell>
              </div>
            );
          case "last_moved_at":
            return (
              <div key={column.key} className="flex items-center gap-1 text-[11px] text-[#94948f]">
                <Clock3 className="h-3.5 w-3.5" />
                {formatRelative(card.last_moved_at)}
              </div>
            );
        }
      })}
    </div>
  );
}

function ValueEditor({
  card,
  onUpdate,
}: {
  card: TeamBoardCard;
  onUpdate?: (cardId: string, fields: Partial<KanbanCard>) => Promise<void>;
}) {
  const [value, setValue] = useState(
    card.valor_negociado != null
      ? card.valor_negociado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const parsed = Number.parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
            onUpdate?.(card.id, { valor_negociado: Number.isNaN(parsed) ? null : parsed });
          }
        }}
        className="h-9 border-[#e5e5e2] text-[12px]"
        placeholder="0,00"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full bg-[#242424] px-3 text-[11px] text-white hover:bg-[#181818]"
          onClick={() => {
            const parsed = Number.parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
            onUpdate?.(card.id, { valor_negociado: Number.isNaN(parsed) ? null : parsed });
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function BridgeEditor({
  card,
  onUpdate,
}: {
  card: TeamBoardCard;
  onUpdate?: (cardId: string, fields: Partial<KanbanCard>) => Promise<void>;
}) {
  const [value, setValue] = useState((card.apoios || []).join(", "));

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const next = value
              .split(/[,\n]+/)
              .map((item) => item.trim().replace(/^@/, ""))
              .filter(Boolean);
            onUpdate?.(card.id, { apoios: next.length ? next : null });
          }
        }}
        className="h-9 border-[#e5e5e2] text-[12px]"
        placeholder="@apoio1, @apoio2"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full bg-[#242424] px-3 text-[11px] text-white hover:bg-[#181818]"
          onClick={() => {
            const next = value
              .split(/[,\n]+/)
              .map((item) => item.trim().replace(/^@/, ""))
              .filter(Boolean);
            onUpdate?.(card.id, { apoios: next.length ? next : null });
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  subtitle,
  cards,
  collapsed,
  onToggle,
  emptyMessage,
  visibleColumns,
  gridTemplateColumns,
  onUpdate,
}: {
  title: string;
  subtitle?: string;
  cards: TeamBoardCard[];
  collapsed?: boolean;
  onToggle?: () => void;
  emptyMessage?: string;
  visibleColumns: Array<{ key: ColumnKey; label: string; width: string; sortable?: boolean }>;
  gridTemplateColumns: string;
  onUpdate?: (cardId: string, fields: Partial<KanbanCard>) => Promise<void>;
}) {
  return (
    <section>
      <div
        className={cn("mb-1 flex items-center gap-2", onToggle && "cursor-pointer select-none")}
        onClick={onToggle}
      >
        {onToggle ? (
          collapsed ? <ChevronRight className="h-3.5 w-3.5 text-[#8d8d89]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#8d8d89]" />
        ) : null}
        <h4 className="text-[16px] font-semibold tracking-[-0.03em] text-[#1f1f1f]">{title}</h4>
        {subtitle ? <span className="text-[11px] text-[#9e9e99]">{subtitle}</span> : null}
        <span className="text-[11px] text-[#a4a49e]">({cards.length})</span>
      </div>

      {!collapsed ? (
        cards.length ? (
          <div className="overflow-hidden rounded-[12px]">
            {cards.map((card) => (
              <TableRow
                key={card.id}
                card={card}
                visibleColumns={visibleColumns}
                gridTemplateColumns={gridTemplateColumns}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-4 text-[12px] text-[#aaa9a4]">{emptyMessage || "Nenhum influenciador nesta seção no momento."}</div>
        )
      ) : null}
    </section>
  );
}

export function CloserSharedBoard() {
  const { user } = useAuth();
  const [cards, setCards] = useState<TeamBoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(COLUMN_DEFS.map((column) => column.key)));
  const [teamClosedCollapsed, setTeamClosedCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"prospectar" | "fechados">("prospectar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newStatus, setNewStatus] = useState("Fechar");
  const [newEngagement, setNewEngagement] = useState<string>("none");
  const [newValue, setNewValue] = useState("");
  const [newObservation, setNewObservation] = useState("");
  const [newBridge, setNewBridge] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState<string>("none");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const fetchCards = async () => {
    if (!user?.teamId) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("team_shared_board")
      .select("*")
      .eq("team_id", user.teamId)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    const rawRows = (data || []) as Array<Record<string, unknown>>;
    const creatorIds = [...new Set(rawRows.map((r) => r.created_by as string).filter(Boolean))];
    const assignedIds = [...new Set(rawRows.map((r) => r.assigned_to as string).filter(Boolean))];
    const idsToFetch = [...new Set([...creatorIds, ...assignedIds])];
    let names = new Map<string, string>();

    if (idsToFetch.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", idsToFetch);
      names = new Map((profiles || []).map((profile: { id: string; nome: string | null }) => [profile.id, profile.nome || "Closer"]));
    }

    setCards(
      rawRows.map((row) => ({
        ...(row as unknown as KanbanCard),
        closer_id: row.created_by as string,
        closerName: names.get(row.created_by as string) || "Closer",
        assigned_to: (row.assigned_to as string | null) ?? null,
        assignedName: row.assigned_to ? names.get(row.assigned_to as string) || null : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchCards();
  }, [user?.teamId]);

  // Realtime: keep board in sync across all team members
  useEffect(() => {
    if (!user?.teamId) return;
    const channel = supabase
      .channel(`team_shared_board:${user.teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_shared_board", filter: `team_id=eq.${user.teamId}` },
        () => { fetchCards(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.teamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_approved_closers");
      if (!cancelled && Array.isArray(data)) {
        setTeamMembers(data.filter((m): m is TeamMember => !!m && !!m.id && !!m.nome));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.teamId]);

  const updateCard = async (cardId: string, fields: Partial<KanbanCard>) => {
    const { error } = await supabase.from("team_shared_board").update(fields).eq("id", cardId);
    if (!error) {
      setCards((current) =>
        current.map((card) => (card.id === cardId ? { ...card, ...fields } : card))
      );
    }
  };

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = !needle
      ? cards
      : cards.filter((card) => {
          const bridge = card.apoios?.join(" ").toLowerCase() || "";
          return (
            card.display_name.toLowerCase().includes(needle) ||
            card.instagram_username.toLowerCase().includes(needle) ||
            card.closerName.toLowerCase().includes(needle) ||
            bridge.includes(needle)
          );
        });

    return [...list].sort((a, b) => {
      if (sortField === "status") {
        const statusDiff = (STATUS_ORDER[a.status] ?? 50) - (STATUS_ORDER[b.status] ?? 50);
        if (statusDiff !== 0) return sortDir === "asc" ? statusDiff : -statusDiff;

        const engagementA = CLASSIFICACAO_OPTIONS.findIndex((item) => item.value === a.classificacao);
        const engagementB = CLASSIFICACAO_OPTIONS.findIndex((item) => item.value === b.classificacao);
        if (engagementA !== engagementB) return sortDir === "asc" ? engagementA - engagementB : engagementB - engagementA;

        return b.created_at.localeCompare(a.created_at);
      }

      let comparison = 0;
      switch (sortField) {
        case "display_name":
          comparison = a.display_name.localeCompare(b.display_name, "pt-BR", { sensitivity: "base" });
          break;
        case "classificacao": {
          const engagementA = CLASSIFICACAO_OPTIONS.findIndex((item) => item.value === a.classificacao);
          const engagementB = CLASSIFICACAO_OPTIONS.findIndex((item) => item.value === b.classificacao);
          comparison = engagementA - engagementB;
          break;
        }
        case "closerName":
          comparison = (a.closerName || "").localeCompare(b.closerName || "", "pt-BR", { sensitivity: "base" });
          break;
        case "valor_negociado":
          comparison = (a.valor_negociado || 0) - (b.valor_negociado || 0);
          break;
        case "last_moved_at":
          comparison = new Date(a.last_moved_at).getTime() - new Date(b.last_moved_at).getTime();
          break;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [cards, query, sortDir, sortField]);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((column) => visibleCols.has(column.key)),
    [visibleCols]
  );

  const dynamicInfluencerWidth = useMemo(() => {
    const longestNameLength = filteredCards.reduce((current, card) => {
      return Math.max(current, card.display_name.length);
    }, "Influenciador".length);

    const estimated = longestNameLength * 5.9 + 18;
    return Math.min(Math.max(estimated, 96), 190);
  }, [filteredCards]);

  const dynamicBridgeWidth = useMemo(() => {
    const longestBridgeLength = filteredCards.reduce((current, card) => {
      const bridgeText = card.apoios?.length
        ? Math.max(...card.apoios.slice(0, 2).map((item) => item.length))
        : 1;
      return Math.max(current, bridgeText);
    }, "Ponte".length);

    const estimated = longestBridgeLength * 4.4 + 10;
    return Math.min(Math.max(estimated, 38), 84);
  }, [filteredCards]);

  const gridTemplateColumns = useMemo(
    () => visibleColumns.map((column) => column.width).join(" "),
    [visibleColumns]
  );

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols((current) => {
      if (current.has(key) && current.size === 1) return current;
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sections = useMemo(() => {
    const closing: TeamBoardCard[] = [];
    const teamClosed: TeamBoardCard[] = [];
    const forYou: TeamBoardCard[] = [];
    const general: TeamBoardCard[] = [];

    const PROSPECT_STATUSES = ["Fechar", "Abordado", "Negociando"];
    const CLOSED_STATUSES = ["Positivo", "Empatando / Negociar", "Pausado", "Com a equipe", "Não posta mais"];

    filteredCards.forEach((card) => {
      if (CLOSED_STATUSES.includes(card.status)) {
        if (card.closer_id === user?.id) closing.push(card);
        else teamClosed.push(card);
        return;
      }

      if (PROSPECT_STATUSES.includes(card.status)) {
        if (card.assigned_to === user?.id) forYou.push(card);
        else general.push(card);
      }
    });

    return { closing, teamClosed, forYou, general };
  }, [filteredCards, user?.id]);

  const handleQuickAdd = async () => {
    const normalized = newInfluencer
      .trim()
      .replace(/^@/, "")
      .match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i)?.[1] || newInfluencer.trim().replace(/^@/, "");

    if (!normalized || !user) return;

    setSaving(true);
    const username = normalized.toLowerCase();
    const bridgeItems = newBridge
      .split(/[,\n]+/)
      .map((item) => item.trim().replace(/^@/, ""))
      .filter(Boolean);
    const cleanedValue = newValue.replace(/[^\d.,]/g, "").replace(",", ".");
    const parsedValue = Number.parseFloat(cleanedValue);
    const { error } = await supabase.from("team_shared_board").insert({
      created_by: user.id,
      instagram_username: username,
      display_name: username,
      instagram_url: `https://instagram.com/${username}`,
      status: newStatus,
      classificacao: newEngagement === "none" ? null : newEngagement,
      valor_negociado: Number.isNaN(parsedValue) ? null : parsedValue,
      observacao: newObservation.trim() || null,
      apoios: bridgeItems.length ? bridgeItems : null,
      assigned_to: newAssignedTo === "none" ? null : newAssignedTo,
    } as never);

    setSaving(false);
    if (!error) {
      setNewInfluencer("");
      setNewStatus("Fechar");
      setNewEngagement("none");
      setNewValue("");
      setNewObservation("");
      setNewBridge("");
      setNewAssignedTo("none");
      setDialogOpen(false);
      fetchCards();
    }
  };

  return (
    <section className="overflow-hidden rounded-[30px] bg-white p-6 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03] lg:p-7">
      <div className="mb-6">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9a9a95]">Time</span>
          <h3 className="mt-2 text-[32px] font-medium leading-[1.05] tracking-[-0.04em] text-slate-950">Board Compartilhado</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-500/90">
            Acompanhe os influenciadores de interesse do time e a evolução das negociações em uma visão única.
          </p>
        </div>
      </div>

      <div className="pb-2">
        <div className="w-full">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(true)}
                className="h-8 rounded-md bg-black px-3 text-[12px] font-medium text-white shadow-none hover:bg-black/90 hover:text-white"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Novo influenciador
              </Button>
              <div className="ml-1 flex items-center gap-0.5 rounded-md border border-[#e7e7e3] bg-white p-0.5">
                {([
                  { key: "prospectar", label: "Prospectar", count: sections.forYou.length + sections.general.length },
                  { key: "fechados", label: "Fechados", count: sections.closing.length + sections.teamClosed.length },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "h-7 rounded-[6px] px-2.5 text-[11px] font-medium transition-colors",
                      activeTab === tab.key
                        ? "bg-white text-black shadow-sm"
                        : "text-[#9a9a95] hover:bg-white hover:text-black"
                    )}
                  >
                    {tab.label}
                    <span className={cn("ml-1 text-[10px]", activeTab === tab.key ? "text-black/50" : "text-[#b4b4b0]")}>({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>


            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md text-[#b4b4b0] transition-colors hover:bg-[#f7f7f5] hover:text-[#4e4e49]"
                    title="Ordenação"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                    {SORT_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortDir((current) => (current === "asc" ? "desc" : "asc"))}>
                    Direção: {sortDir === "asc" ? "Crescente" : "Decrescente"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => setShowSearch((current) => !current)}
                className="grid h-7 w-7 place-items-center rounded-md text-[#b4b4b0] transition-colors hover:bg-[#f7f7f5] hover:text-[#4e4e49]"
                title="Buscar"
              >
                <Search className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md text-[#b4b4b0] transition-colors hover:bg-[#f7f7f5] hover:text-[#4e4e49]"
                    title="Colunas"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMN_DEFS.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={visibleCols.has(column.key)}
                      onCheckedChange={() => toggleColumn(column.key)}
                    >
                      {column.label || "Selecionar"}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md text-[#b4b4b0] transition-colors hover:bg-[#f7f7f5] hover:text-[#4e4e49]"
                    title="Mais"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setQuery("")}>Limpar busca</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleCols(new Set(COLUMN_DEFS.map((column) => column.key)))}>
                    Restaurar colunas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {showSearch || query ? (
            <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-[#e5e5e2] bg-white px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[#b4b4b0]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar influenciador..."
                className="h-6 w-full bg-transparent text-[12px] text-[#3c3c38] outline-none placeholder:text-[#afafa9]"
              />
            </div>
          ) : null}

          <div
            className="grid gap-1.5 border-b border-[#ecece8] px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#b0b0aa]"
            style={{ gridTemplateColumns }}
          >
            {visibleColumns.map((column) => (
              <div key={column.key}>
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === column.key) {
                        setSortDir((current) => (current === "asc" ? "desc" : "asc"));
                      } else {
                        setSortField(column.key as SortField);
                        setSortDir("asc");
                      }
                    }}
                    className="inline-flex items-center gap-1 transition-colors hover:text-[#7f7f79]"
                  >
                    {column.label || "✓"}
                    {sortField === column.key ? <span className="text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                  </button>
                ) : (
                  column.label || <span>✓</span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4 px-1 pt-3">
            {loading ? (
              <div className="px-3 py-10 text-[12px] text-[#aaa9a4]">Carregando board compartilhado...</div>
            ) : (
              <>
                {activeTab === "fechados" ? (
                  <>
                    <SectionBlock
                      title="Fechando"
                      cards={sections.closing}
                      visibleColumns={visibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      onUpdate={updateCard}
                    />
                    <SectionBlock
                      title="Equipe Fechou"
                      cards={sections.teamClosed}
                      emptyMessage="Nenhum influenciador fechado por outra pessoa no momento."
                      visibleColumns={visibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      onUpdate={updateCard}
                    />
                  </>
                ) : (
                  <>
                    <SectionBlock
                      title="Para você"
                      cards={sections.forYou}
                      emptyMessage="Nenhum influenciador indicado diretamente para você no momento."
                      visibleColumns={visibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      onUpdate={updateCard}
                    />
                    <SectionBlock
                      title="Geral"
                      cards={sections.general}
                      emptyMessage="Nenhum influenciador aberto na visão geral no momento."
                      visibleColumns={visibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      onUpdate={updateCard}
                    />
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden rounded-[28px] border-none bg-[#fafaf8] p-0 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
          <div className="border-b border-black/[0.06] px-8 pt-8 pb-6">
            <DialogHeader>
              <DialogTitle className="text-[28px] font-medium tracking-[-0.04em] text-[#1f1f1f]">
                Adicionar influenciador
              </DialogTitle>
              <DialogDescription className="text-[14px] text-[#6e6e73]">
                Preencha os dados do influenciador para adicioná-lo ao board compartilhado dos closers.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* LEFT — Identificação & Negociação */}
            <div className="rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04] shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)]">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f3ef]">
                  <AtSign className="h-4 w-4 text-[#1f1f1f]" />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">Perfil</div>
                  <div className="text-[16px] font-medium tracking-[-0.02em] text-[#1f1f1f]">Identificação</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
                    <LinkIcon className="h-3 w-3" /> @ ou URL do Instagram
                  </label>
                  <Input
                    value={newInfluencer}
                    onChange={(event) => setNewInfluencer(event.target.value)}
                    placeholder="@username ou https://instagram.com/exemplo"
                    className="h-12 rounded-[12px] border-[#ececeb] bg-[#fafaf8] text-[14px] shadow-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Engajamento</label>
                  <div className="grid grid-cols-5 gap-2">
                    {([
                      { value: "none", label: "Nenhum", color: null as string | null, fire: false },
                      { value: "Fraca", label: "Fraca", color: "#dc2626", fire: false },
                      { value: "Média", label: "Média", color: "#eab308", fire: false },
                      { value: "Forte", label: "Forte", color: "#16a34a", fire: false },
                      { value: "Prioridade", label: "Prioridade", color: "#f97316", fire: true },
                    ]).map((option) => {
                      const active = newEngagement === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setNewEngagement(option.value)}
                          className={cn(
                            "flex h-12 flex-col items-center justify-center gap-1 rounded-[12px] border text-[11px] font-medium transition-colors",
                            active
                              ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                              : "border-[#ececeb] bg-[#fafaf8] text-[#37352f] hover:border-[#d4d4cf]"
                          )}
                        >
                          {option.fire ? (
                            <span className="text-[14px] leading-none">🔥</span>
                          ) : option.color ? (
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: option.color }}
                            />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-current opacity-60" />
                          )}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="h-12 rounded-[12px] border-[#ececeb] bg-[#fafaf8] px-4 text-[14px] text-[#1f1f1f] shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: (STATUS_META[newStatus] ?? STATUS_META.Fechar).dot }}
                          />
                          {newStatus}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-[14px] border-[#ececeb] bg-white p-1 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.25)]">
                      {["Fechar", "Abordado", "Negociando", "Positivo", "Empatando / Negociar", "Pausado", "Com a equipe", "Não posta mais"].map((option) => {
                        const meta = STATUS_META[option] ?? STATUS_META.Fechar;
                        return (
                          <SelectItem
                            key={option}
                            value={option}
                            className="cursor-pointer rounded-[10px] pl-8 pr-3 py-2 text-[13px] text-[#1f1f1f] focus:bg-[#f3f3ef]"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: meta.bg, color: meta.text }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.dot }} />
                                {option}
                              </span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
                    <AtSign className="h-3 w-3" /> Direcionar para
                  </label>
                  <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
                    <SelectTrigger className="h-12 rounded-[12px] border-[#ececeb] bg-[#fafaf8] px-4 text-[14px] text-[#1f1f1f] shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Ninguém — fica no Geral" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[14px] border-[#ececeb] bg-white p-1 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.25)]">
                      <SelectItem value="none" className="cursor-pointer rounded-[10px] pl-8 pr-3 py-2 text-[13px] text-[#6e6e73] focus:bg-[#f3f3ef]">
                        Ninguém — fica no Geral
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id} className="cursor-pointer rounded-[10px] pl-8 pr-3 py-2 text-[13px] text-[#1f1f1f] focus:bg-[#f3f3ef]">
                          {member.nome}{member.id === user?.id ? " (você)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[#9a9a96]">A pessoa direcionada verá esse influenciador na seção "Para você".</p>
                </div>
              </div>
            </div>

            {/* RIGHT — Detalhes complementares */}
            <div className="rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04] shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)]">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f3ef]">
                  <Zap className="h-4 w-4 text-[#1f1f1f]" />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">Detalhes</div>
                  <div className="text-[16px] font-medium tracking-[-0.02em] text-[#1f1f1f]">Ponte, valor & observação</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
                    <Tag className="h-3 w-3" /> Ponte
                  </label>
                  <Input
                    value={newBridge}
                    onChange={(event) => setNewBridge(event.target.value)}
                    placeholder="@apoio1, @apoio2"
                    className="h-12 rounded-[12px] border-[#ececeb] bg-[#fafaf8] text-[14px] shadow-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
                    <Wallet className="h-3 w-3" /> Valor negociado
                  </label>
                  <Input
                    value={newValue}
                    onChange={(event) => setNewValue(event.target.value)}
                    placeholder="0,00"
                    className="h-12 rounded-[12px] border-[#ececeb] bg-[#fafaf8] text-[14px] shadow-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">
                    <FileText className="h-3 w-3" /> Observação
                  </label>
                  <Textarea
                    value={newObservation}
                    onChange={(event) => setNewObservation(event.target.value)}
                    placeholder="Observação opcional..."
                    className="min-h-[160px] rounded-[14px] border-[#ececeb] bg-[#fafaf8] text-[14px] shadow-none"
                  />
                </div>
              </div>
            </div>
          </div>


          <div className="flex justify-end gap-2 border-t border-black/[0.06] bg-white px-8 py-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 rounded-full border-[#ececeb] bg-white px-6 text-[13px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!newInfluencer.trim() || saving}
              className="h-11 rounded-full bg-[#1f1f1f] px-6 text-[13px] font-medium text-white hover:bg-[#111111]"
            >
              {saving ? "Adicionando..." : "Adicionar influenciador"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
