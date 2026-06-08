import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, Clock3, ExternalLink, MoreHorizontal, Plus, Search, SlidersHorizontal } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLASSIFICACAO_OPTIONS, type KanbanCard } from "@/components/kanban/types";

type TeamBoardCard = KanbanCard & {
  closerName: string;
};

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
};

function EngagementDot({ value }: { value: string | null }) {
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
                        <span className="text-[#c0c0bc]">—</span>
                        Nenhum
                      </button>
                      {CLASSIFICACAO_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onUpdate?.(card.id, { classificacao: option.value })}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px] text-[#3d3d39] hover:bg-[#f7f7f5]",
                            card.classificacao === option.value && "bg-[#f7f7f5]"
                          )}
                        >
                          <span
                            className="inline-flex h-3.5 w-3.5 rounded-full border"
                            style={{ borderColor: option.text, boxShadow: `inset 0 0 0 3px ${option.bg}` }}
                          />
                          {option.value}
                        </button>
                      ))}
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
                <InlineCell
                  content={<BridgeEditor card={card} onUpdate={onUpdate} />}
                  className="w-full"
                >
                  {card.apoios?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {card.apoios.slice(0, 2).map((apoio) => (
                        <span
                          key={apoio}
                          className="max-w-[84px] truncate rounded-[6px] bg-[#f2f2ef] px-1.5 py-0.5 text-[10px] text-[#6d6d69]"
                        >
                          {apoio}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[#c0c0bc]">—</span>
                  )}
                </InlineCell>
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
  const [activeTab, setActiveTab] = useState<"closing" | "teamClosed" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newStatus, setNewStatus] = useState("Fechar");
  const [newEngagement, setNewEngagement] = useState<string>("none");
  const [newValue, setNewValue] = useState("");
  const [newObservation, setNewObservation] = useState("");
  const [newBridge, setNewBridge] = useState("");

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
    let names = new Map<string, string>();

    if (creatorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", creatorIds);
      names = new Map((profiles || []).map((profile: { id: string; nome: string | null }) => [profile.id, profile.nome || "Closer"]));
    }

    setCards(
      rawRows.map((row) => ({
        ...(row as unknown as KanbanCard),
        closer_id: row.created_by as string,
        closerName: names.get(row.created_by as string) || "Closer",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchCards();
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

    filteredCards.forEach((card) => {
      if (["Positivo", "Empatando / Negociar"].includes(card.status)) {
        closing.push(card);
        return;
      }

      if (card.status === "Com a equipe") {
        teamClosed.push(card);
        return;
      }

      if (card.closer_id === user?.id && ["Fechar", "Negociando", "Abordado"].includes(card.status)) {
        forYou.push(card);
        return;
      }

      general.push(card);
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
    });

    setSaving(false);
    if (!error) {
      setNewInfluencer("");
      setNewStatus("Fechar");
      setNewEngagement("none");
      setNewValue("");
      setNewObservation("");
      setNewBridge("");
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
                  { key: "closing", label: "Fechando", count: sections.closing.length },
                  { key: "teamClosed", label: "Equipe Fechou", count: sections.teamClosed.length },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab((prev) => (prev === tab.key ? null : tab.key))}
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
                <SectionBlock
                  title="Para você"
                  cards={sections.forYou}
                  emptyMessage="Nenhum influenciador indicado diretamente para você no momento."
                  visibleColumns={visibleColumns}
                  gridTemplateColumns={gridTemplateColumns}
                  onUpdate={updateCard}
                />
                {activeTab === "closing" && (
                  <SectionBlock
                    title="Fechando"
                    cards={sections.closing}
                    visibleColumns={visibleColumns}
                    gridTemplateColumns={gridTemplateColumns}
                    onUpdate={updateCard}
                  />
                )}
                {activeTab === "teamClosed" && (
                  <SectionBlock
                    title="Equipe Fechou"
                    cards={sections.teamClosed}
                    emptyMessage="Nenhum influenciador fechado por outra pessoa no momento."
                    visibleColumns={visibleColumns}
                    gridTemplateColumns={gridTemplateColumns}
                    onUpdate={updateCard}
                  />
                )}
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

          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold text-[#37352f]">Adicionar influenciador</DialogTitle>
            <DialogDescription className="text-[13px] text-[#8f8f89]">
              Adicione um @username ou URL do Instagram ao board compartilhado dos closers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#9b9a97]">Instagram</label>
              <Input
                value={newInfluencer}
                onChange={(event) => setNewInfluencer(event.target.value)}
                placeholder="@username ou URL do Instagram"
                className="h-9 border-[#e5e5e5] text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#9b9a97]">Status</label>
                <div className="rounded-md border border-[#e5e5e5] bg-white px-3">
                  <select
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value)}
                    className="h-9 w-full bg-transparent text-[13px] text-[#37352f] outline-none"
                  >
                    {["Fechar", "Abordado", "Negociando", "Positivo", "Empatando / Negociar", "Pausado", "Com a equipe", "Não posta mais"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#9b9a97]">Engajamento</label>
                <div className="rounded-md border border-[#e5e5e5] bg-white px-3">
                  <select
                    value={newEngagement}
                    onChange={(event) => setNewEngagement(event.target.value)}
                    className="h-9 w-full bg-transparent text-[13px] text-[#37352f] outline-none"
                  >
                    <option value="none">Nenhum</option>
                    {CLASSIFICACAO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#9b9a97]">Ponte</label>
              <Input
                value={newBridge}
                onChange={(event) => setNewBridge(event.target.value)}
                placeholder="@apoio1, @apoio2"
                className="h-9 border-[#e5e5e5] text-[13px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#9b9a97]">Valor negociado</label>
              <Input
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                placeholder="0,00"
                className="h-9 border-[#e5e5e5] text-[13px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[#9b9a97]">Observação</label>
              <Textarea
                value={newObservation}
                onChange={(event) => setNewObservation(event.target.value)}
                placeholder="Observação opcional..."
                className="min-h-[72px] border-[#e5e5e5] text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleQuickAdd} disabled={!newInfluencer.trim() || saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
