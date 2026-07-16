import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bold, CalendarPlus, Check, CheckSquare, Eye, ImagePlus, Italic, Loader2, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ComprovanteLightbox from "./ComprovanteLightbox";
import { DAILY_FEE_RATE } from "@/lib/constants";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

const DEFAULT_ROWS_PER_DAY = 5;
const EMPTY_ROWS_AFTER_LAST_INFLUENCER = 4;
const MAX_ROWS_PER_DAY = 100;
const COLUMN_WIDTHS = [94, 176, 130, 150, 155, 140, 135];
const MIN_SHEET_WIDTH = 1480;

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

interface SheetRow {
  influenciador: string;
  trafego: string;
  faturamento: string;
  acumulado: string;
  comprovanteUrl: string;
  observacao: string;
  observationStyle: ObservationStyle;
}

type ObservationBackground = "neutral" | "green" | "yellow" | "red" | "blue";
type ObservationText = "default" | "green" | "yellow" | "red" | "blue";

interface ObservationStyle {
  background: ObservationBackground;
  text: ObservationText;
  bold: boolean;
  italic: boolean;
  checkbox: boolean;
  checked: boolean;
}

interface DbObservationStyle extends ObservationStyle {
  day: number;
  row_index: number;
}

interface DbRow {
  id: string;
  day: number;
  row_index: number;
  influenciador: string | null;
  diaria_cents: number;
  faturamento_cents: number;
  acumulado_cents: number;
}

interface DbReceipt {
  id: string;
  daily_record_id: string;
  file_url: string;
}

interface DailyRecordRow {
  id: string;
  date: string;
  influencer_id: string;
  observacao: string | null;
  comprovante_url: string | null;
  comprovante_url_2: string | null;
  influencers: { handle: string } | null;
}

interface MyInfluencer {
  id: string;
  handle: string;
}

type MonthRows = Record<number, SheetRow[]>;

const emptyRow = (): SheetRow => ({
  influenciador: "",
  trafego: "",
  faturamento: "",
  acumulado: "",
  comprovanteUrl: "",
  observacao: "",
  observationStyle: {
    background: "neutral",
    text: "default",
    bold: false,
    italic: false,
    checkbox: false,
    checked: false,
  },
});

const createMonthRows = (daysInMonth: number): MonthRows =>
  Object.fromEntries(
    Array.from({ length: daysInMonth }, (_, index) => [
      index + 1,
      Array.from({ length: MAX_ROWS_PER_DAY }, emptyRow),
    ]),
  );

function parseCents(value: string): number {
  if (!value.trim()) return 0;
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatCents(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function sanitizeNumber(value: string): string {
  return value.replace(/[^\d.,-]/g, "");
}

function normalizeHandle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i);
  if (urlMatch) return `@${urlMatch[1].toLowerCase()}`;
  return trimmed.startsWith("@") ? `@${trimmed.slice(1).toLowerCase()}` : `@${trimmed.toLowerCase()}`;
}

function validHandle(value: string): boolean {
  return /^@[a-z0-9_.]{2,}$/i.test(normalizeHandle(value));
}

function comprovanteStoragePath(url: string): string | null {
  const path = url.split("/comprovantes/")[1]?.split("?")[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function rowResult(row: SheetRow): number | null {
  const hasFinancialValues = row.trafego.trim() || row.faturamento.trim();
  if (!hasFinancialValues) return null;
  const traffic = parseCents(row.trafego);
  const revenue = parseCents(row.faturamento);
  return Math.round(revenue - traffic - revenue * DAILY_FEE_RATE);
}

function formatRoi(revenue: number, traffic: number): string {
  if (revenue <= 0 || traffic <= 0) return "—";
  return (revenue / traffic).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const betaTable = () => supabase.from("planilha_beta") as any;
const observationStylesTable = () => supabase.from("planilha_beta_observation_styles" as any) as any;

const observationStylesStorageKey = (userId: string, year: number, month: number) =>
  `criptpic:observation-styles:${userId}:${year}:${month}`;

function isMissingObservationStylesTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205"
    || error.code === "42P01"
    || Boolean(error.message?.includes("planilha_beta_observation_styles"));
}

function readLocalObservationStyles(userId: string, year: number, month: number): DbObservationStyle[] {
  try {
    const stored = window.localStorage.getItem(observationStylesStorageKey(userId, year, month));
    return stored ? JSON.parse(stored) as DbObservationStyle[] : [];
  } catch {
    return [];
  }
}

function writeLocalObservationStyle(
  userId: string,
  year: number,
  month: number,
  day: number,
  rowIndex: number,
  style: ObservationStyle,
) {
  const stored = readLocalObservationStyles(userId, year, month);
  const next = stored.filter((item) => item.day !== day || item.row_index !== rowIndex);
  const isDefault = style.background === "neutral"
    && style.text === "default"
    && !style.bold
    && !style.italic
    && !style.checkbox
    && !style.checked;
  if (!isDefault) next.push({ day, row_index: rowIndex, ...style });
  window.localStorage.setItem(observationStylesStorageKey(userId, year, month), JSON.stringify(next));
}

const OBSERVATION_BACKGROUNDS: Record<ObservationBackground, string> = {
  neutral: "var(--sheet-cell)",
  green: "var(--observation-green)",
  yellow: "var(--observation-yellow)",
  red: "var(--observation-red)",
  blue: "var(--observation-blue)",
};

const OBSERVATION_TEXTS: Record<ObservationText, string> = {
  default: "var(--observation-text)",
  green: "var(--sheet-roi-positive)",
  yellow: "var(--sheet-roi-warning)",
  red: "var(--sheet-roi-negative)",
  blue: "var(--observation-text-blue)",
};

function resultBackground(result: number | null, traffic: number): string {
  if (result === null) return "var(--sheet-cell)";
  if (result < 0) return "var(--sheet-result-negative)";
  if (result <= traffic * 0.3) return "var(--sheet-result-warning)";
  return "var(--sheet-result-positive)";
}

function resultTextColor(result: number | null, traffic: number): string {
  if (result === null) return "var(--sheet-roi-neutral)";
  if (result < 0) return "var(--sheet-roi-negative)";
  if (result <= traffic * 0.3) return "var(--sheet-roi-warning)";
  return "var(--sheet-roi-positive)";
}

function InfluencerCell({
  day,
  rowIndex,
  value,
  influencers,
  onChange,
  onBlur,
  onEnter,
  onAdd,
}: {
  day: number;
  rowIndex: number;
  value: string;
  influencers: MyInfluencer[];
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onAdd: (handle: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const normalized = normalizeHandle(value);
  const search = normalized.replace(/^@/, "");
  const filtered = influencers.filter((item) => item.handle.replace(/^@/, "").includes(search));
  const exactMatch = influencers.some((item) => item.handle === normalized);
  const canAdd = validHandle(normalized) && !exactMatch;

  const selectHandle = (handle: string) => {
    onChange(handle);
    setOpen(false);
  };

  const addHandle = async () => {
    setAdding(true);
    await onAdd(normalized);
    onChange(normalized);
    setAdding(false);
    setOpen(false);
  };

  return (
    <div className="relative h-full w-full">
      <input
        data-sheet-input
        aria-label={`Influenciador, dia ${day}, linha ${rowIndex + 1}`}
        value={value}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue.includes("instagram.com/") || nextValue.includes("instagr.am/") ? normalizeHandle(nextValue) : nextValue.toLowerCase());
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          onBlur();
        }}
        onKeyDown={onEnter}
        className="h-full w-full border-0 bg-transparent px-1 text-center font-[Poppins] text-[15px] text-foreground outline-none focus:bg-[var(--sheet-focus)]"
      />

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-[300px] overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length > 0 ? filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectHandle(item.handle)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span>{item.handle}</span>
                {item.handle === normalized && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum influenciador encontrado</div>
            )}
          </div>

          {canAdd && (
            <div className="mt-1 border-t border-border pt-1.5">
              <button
                type="button"
                disabled={adding}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void addHandle()}
                className="flex w-full items-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-left text-xs font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Adicionar {normalized} à Minha Lista
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ObservationCell({
  day,
  rowIndex,
  value,
  style,
  onChange,
  onBlur,
  onStyleChange,
}: {
  day: number;
  rowIndex: number;
  value: string;
  style: ObservationStyle;
  onChange: (value: string) => void;
  onBlur: () => void;
  onStyleChange: (patch: Partial<ObservationStyle>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex h-full min-h-[21px] w-full items-center"
      style={{ background: OBSERVATION_BACKGROUNDS[style.background], color: OBSERVATION_TEXTS[style.text] }}
    >
      {style.checkbox && (
        <button
          type="button"
          aria-label={style.checked ? "Desmarcar observação" : "Marcar observação"}
          aria-pressed={style.checked}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onStyleChange({ checked: !style.checked })}
          className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-current/40 bg-background/60"
        >
          {style.checked && <Check className="h-3 w-3" />}
        </button>
      )}
      <input
        data-sheet-input
        aria-label={`Observação, dia ${day}, linha ${rowIndex + 1}`}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 140);
          onBlur();
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-left font-[Poppins] text-[14px] outline-none"
        style={{ fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? "italic" : "normal" }}
      />

      {open && (
        <div
          className="absolute bottom-full right-1 z-[90] mb-1 flex items-center gap-1 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-1 border-r border-border pr-1" aria-label="Cor do fundo">
            {(Object.keys(OBSERVATION_BACKGROUNDS) as ObservationBackground[]).map((color) => (
              <button
                key={color}
                type="button"
                title={`Fundo ${color}`}
                aria-label={`Fundo ${color}`}
                aria-pressed={style.background === color}
                onClick={() => onStyleChange({ background: color })}
                className="h-5 w-5 rounded-full border border-border ring-offset-1 aria-pressed:ring-2 aria-pressed:ring-foreground/50"
                style={{ background: OBSERVATION_BACKGROUNDS[color] }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 border-r border-border pr-1" aria-label="Cor do texto">
            {(Object.keys(OBSERVATION_TEXTS) as ObservationText[]).map((color) => (
              <button
                key={color}
                type="button"
                title={`Texto ${color}`}
                aria-label={`Texto ${color}`}
                aria-pressed={style.text === color}
                onClick={() => onStyleChange({ text: color })}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ring-offset-1 hover:bg-muted aria-pressed:bg-muted aria-pressed:ring-1 aria-pressed:ring-foreground/40"
                style={{ color: OBSERVATION_TEXTS[color] }}
              >A</button>
            ))}
          </div>
          <button type="button" title="Negrito" aria-label="Negrito" aria-pressed={style.bold} onClick={() => onStyleChange({ bold: !style.bold })} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"><Bold className="h-3.5 w-3.5" /></button>
          <button type="button" title="Itálico" aria-label="Itálico" aria-pressed={style.italic} onClick={() => onStyleChange({ italic: !style.italic })} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" title="Checkbox" aria-label="Adicionar checkbox" aria-pressed={style.checkbox} onClick={() => onStyleChange({ checkbox: !style.checkbox, checked: style.checkbox ? false : style.checked })} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"><CheckSquare className="h-3.5 w-3.5" /></button>
          <button type="button" title="Limpar formatação" aria-label="Limpar formatação" onClick={() => onStyleChange(emptyRow().observationStyle)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

export default function PlanilhaBeta() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const [dateToAdd, setDateToAdd] = useState(() => isoDate(currentYear, currentMonth, currentDay));
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const [rowsByDay, setRowsByDay] = useState<MonthRows>(() => createMonthRows(daysInMonth));
  const [visibleRowsByDay, setVisibleRowsByDay] = useState<Record<number, number>>({});
  const displayedDays = useMemo(
    () => Object.keys(visibleRowsByDay).map(Number).sort((a, b) => a - b),
    [visibleRowsByDay],
  );
  const [myInfluencers, setMyInfluencers] = useState<MyInfluencer[]>([]);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const rowsRef = useRef(rowsByDay);
  const rowIds = useRef<Record<string, string>>({});
  const dailyRecordIds = useRef<Record<string, string>>({});
  const receiptIds = useRef<Record<string, string>>({});
  const dirtyRows = useRef<Set<string>>(new Set());
  const observationStylesBackendAvailable = useRef(true);

  useEffect(() => {
    rowsRef.current = rowsByDay;
  }, [rowsByDay]);

  useEffect(() => {
    const refreshDate = () => setCurrentDate(new Date());
    const interval = window.setInterval(refreshDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const monthStart = isoDate(year, month, 1);
  const monthEnd = isoDate(year, month, daysInMonth);
  const todayIso = isoDate(currentYear, currentMonth, currentDay);
  const latestAllowedDate = monthStart > todayIso ? "" : (monthEnd < todayIso ? monthEnd : todayIso);

  useEffect(() => {
    setDateToAdd(year === currentYear && month === currentMonth ? todayIso : latestAllowedDate || monthStart);
  }, [currentMonth, currentYear, latestAllowedDate, month, monthStart, todayIso, year]);

  const loadMyInfluencers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("influencers")
      .select("id, handle")
      .eq("owner_id", user.id)
      .eq("ativo", true)
      .order("handle", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar a Minha Lista");
      return;
    }
    setMyInfluencers((data ?? []).sort((a, b) => a.handle.localeCompare(b.handle, "pt-BR")));
  }, [user]);

  useEffect(() => {
    void loadMyInfluencers();
  }, [loadMyInfluencers]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadRows = async () => {
      setLoading(true);
      rowIds.current = {};
      dailyRecordIds.current = {};
      receiptIds.current = {};
      dirtyRows.current.clear();
      observationStylesBackendAvailable.current = true;

      const { data, error } = await betaTable()
        .select("id, day, row_index, influenciador, diaria_cents, faturamento_cents, acumulado_cents")
        .eq("closer_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .order("day")
        .order("row_index");

      if (cancelled) return;
      if (error) {
        toast.error("Não foi possível carregar a Planilha Diário");
        setLoading(false);
        return;
      }

      const betaRows = (data as DbRow[] | null) ?? [];
      const { data: styleData, error: styleError } = await observationStylesTable()
        .select("day, row_index, background, text, bold, italic, checkbox, checked")
        .eq("closer_id", user.id)
        .eq("year", year)
        .eq("month", month);
      const stylesByRow = new Map<string, DbObservationStyle>();
      const localStyles = readLocalObservationStyles(user.id, year, month);
      const loadedStyles = styleError
        ? localStyles
        : [...((styleData as DbObservationStyle[] | null) ?? []), ...localStyles];
      if (isMissingObservationStylesTable(styleError)) observationStylesBackendAvailable.current = false;
      loadedStyles.forEach((item) => stylesByRow.set(`${item.day}:${item.row_index}`, item));
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const { data: dailyData, error: dailyError } = await supabase
        .from("daily_influencer_records")
        .select("id, date, influencer_id, observacao, comprovante_url, comprovante_url_2, influencers(handle)")
        .eq("closer_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .is("deleted_at", null);
      if (dailyError) toast.error("Não foi possível carregar os dados operacionais da planilha");

      const dailyRecords = (dailyData as DailyRecordRow[] | null) ?? [];
      const dailyByDateHandle = new Map<string, DailyRecordRow>();
      dailyRecords.forEach((record) => {
        const handle = normalizeHandle(record.influencers?.handle ?? "");
        if (handle) dailyByDateHandle.set(`${record.date}:${handle}`, record);
      });

      const receiptsByRecord = new Map<string, DbReceipt>();
      const recordIds = dailyRecords.map((record) => record.id);
      if (recordIds.length > 0) {
        const { data: receiptData, error: receiptError } = await (supabase.from("daily_receipt_uploads") as any)
          .select("id, daily_record_id, file_url, created_at")
          .in("daily_record_id", recordIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (receiptError) {
          toast.error("Não foi possível carregar os Comprovantes");
        } else {
          (receiptData as DbReceipt[] | null)?.forEach((receipt) => {
            if (receipt.daily_record_id && !receiptsByRecord.has(receipt.daily_record_id)) {
              receiptsByRecord.set(receipt.daily_record_id, receipt);
            }
          });
        }
      }

      const nextRows = createMonthRows(daysInMonth);
      const activeDays = new Set<number>(betaRows.map((row) => row.day));
      dailyRecords.forEach((record) => activeDays.add(Number(record.date.slice(-2))));
      if (year === currentYear && month === currentMonth) activeDays.add(currentDay);

      const nextVisibleRows: Record<number, number> = {};
      betaRows.forEach((row) => {
        if (!nextRows[row.day] || row.row_index < 0 || row.row_index >= MAX_ROWS_PER_DAY) return;
        const date = `${year}-${String(month).padStart(2, "0")}-${String(row.day).padStart(2, "0")}`;
        const dailyRecord = dailyByDateHandle.get(`${date}:${normalizeHandle(row.influenciador ?? "")}`);
        const receipt = dailyRecord ? receiptsByRecord.get(dailyRecord.id) : undefined;
        const savedStyle = stylesByRow.get(`${row.day}:${row.row_index}`);
        nextRows[row.day][row.row_index] = {
          influenciador: row.influenciador ?? "",
          trafego: formatCents(row.diaria_cents),
          faturamento: formatCents(row.faturamento_cents),
          acumulado: formatCents(row.acumulado_cents),
          comprovanteUrl: receipt?.file_url ?? dailyRecord?.comprovante_url ?? dailyRecord?.comprovante_url_2 ?? "",
          observacao: dailyRecord?.observacao ?? "",
          observationStyle: savedStyle ? {
            background: savedStyle.background,
            text: savedStyle.text,
            bold: savedStyle.bold,
            italic: savedStyle.italic,
            checkbox: savedStyle.checkbox,
            checked: savedStyle.checked,
          } : emptyRow().observationStyle,
        };
        rowIds.current[`${row.day}:${row.row_index}`] = row.id;
        if (dailyRecord) dailyRecordIds.current[`${row.day}:${row.row_index}`] = dailyRecord.id;
        if (receipt) receiptIds.current[`${row.day}:${row.row_index}`] = receipt.id;
      });

      activeDays.forEach((day) => {
        const lastInfluencerIndex = nextRows[day]?.findLastIndex((row) => row.influenciador.trim()) ?? -1;
        nextVisibleRows[day] = Math.min(
          MAX_ROWS_PER_DAY,
          Math.max(DEFAULT_ROWS_PER_DAY, lastInfluencerIndex + 1 + EMPTY_ROWS_AFTER_LAST_INFLUENCER),
        );
      });

      rowsRef.current = nextRows;
      setRowsByDay(nextRows);
      setVisibleRowsByDay(nextVisibleRows);
      setLoading(false);
    };

    void loadRows();
    return () => { cancelled = true; };
  }, [currentDay, currentMonth, currentYear, daysInMonth, month, user, year]);

  const updateRow = useCallback((day: number, rowIndex: number, patch: Partial<SheetRow>) => {
    const key = `${day}:${rowIndex}`;
    dirtyRows.current.add(key);
    setRowsByDay((current) => {
      const dayRows = [...current[day]];
      dayRows[rowIndex] = { ...dayRows[rowIndex], ...patch };
      const lastInfluencerIndex = dayRows.findLastIndex((row) => row.influenciador.trim());
      setVisibleRowsByDay((visible) => ({
        ...visible,
        [day]: Math.min(
          MAX_ROWS_PER_DAY,
          Math.max(DEFAULT_ROWS_PER_DAY, lastInfluencerIndex + 1 + EMPTY_ROWS_AFTER_LAST_INFLUENCER),
        ),
      }));
      const updated = { ...current, [day]: dayRows };
      rowsRef.current = updated;
      return updated;
    });
  }, []);

  const warnDuplicateInfluencer = useCallback((day: number, rowIndex: number) => {
    const row = rowsRef.current[day]?.[rowIndex];
    const handle = normalizeHandle(row?.influenciador ?? "");
    if (!handle) return;

    const duplicateLines = rowsRef.current[day]
      .map((candidate, index) => ({ handle: normalizeHandle(candidate.influenciador), index }))
      .filter((candidate) => candidate.index !== rowIndex && candidate.handle === handle)
      .map((candidate) => candidate.index + 1);
    if (duplicateLines.length === 0) return;

    const toastId = `duplicate-${year}-${month}-${day}-${handle}`;
    toast.warning(`${handle} já aparece neste dia`, {
      id: toastId,
      description: `Confira as linhas ${[...duplicateLines, rowIndex + 1].sort((a, b) => a - b).join(" e ")} antes de lançar Pagamento e Faturamento novamente.`,
      duration: 12_000,
      closeButton: true,
    });
  }, [month, year]);

  const updateObservationStyle = useCallback(async (day: number, rowIndex: number, patch: Partial<ObservationStyle>) => {
    if (!user) return;
    const current = rowsRef.current[day][rowIndex].observationStyle;
    const next = { ...current, ...patch };
    setRowsByDay((rows) => {
      const dayRows = [...rows[day]];
      dayRows[rowIndex] = { ...dayRows[rowIndex], observationStyle: next };
      const updated = { ...rows, [day]: dayRows };
      rowsRef.current = updated;
      return updated;
    });

    const isDefault = next.background === "neutral"
      && next.text === "default"
      && !next.bold
      && !next.italic
      && !next.checkbox
      && !next.checked;
    writeLocalObservationStyle(user.id, year, month, day, rowIndex, next);
    if (!observationStylesBackendAvailable.current) return;

    const query = observationStylesTable();
    const response = isDefault
      ? await query.delete()
        .eq("closer_id", user.id).eq("year", year).eq("month", month).eq("day", day).eq("row_index", rowIndex)
      : await query.upsert({
        closer_id: user.id,
        year,
        month,
        day,
        row_index: rowIndex,
        ...next,
      }, { onConflict: "closer_id,year,month,day,row_index" });
    if (isMissingObservationStylesTable(response.error)) {
      observationStylesBackendAvailable.current = false;
      return;
    }
    if (response.error) {
      toast.error("Não foi possível salvar o estilo da Observação", { description: response.error.message });
    }
  }, [month, user, year]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`beta-receipts-${user.id}-${year}-${month}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_receipt_uploads", filter: `closer_id=eq.${user.id}` },
        (payload: any) => {
          const receipt = payload.new ?? payload.old;
          const dailyRecordId = receipt?.daily_record_id as string | undefined;
          if (!dailyRecordId) return;
          const key = Object.entries(dailyRecordIds.current).find(([, id]) => id === dailyRecordId)?.[0];
          if (!key) return;
          const [day, rowIndex] = key.split(":").map(Number);
          if (payload.eventType === "DELETE" || receipt.deleted_at) {
            delete receiptIds.current[key];
            updateRow(day, rowIndex, { comprovanteUrl: "" });
            dirtyRows.current.delete(key);
            return;
          }
          receiptIds.current[key] = receipt.id;
          updateRow(day, rowIndex, { comprovanteUrl: receipt.file_url });
          dirtyRows.current.delete(key);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [month, updateRow, user, year]);

  const ensureDailyRecord = useCallback(async (day: number, rowIndex: number, row: SheetRow): Promise<string | null> => {
    if (!user) return null;
    const rowKey = `${day}:${rowIndex}`;
    const normalizedHandle = normalizeHandle(row.influenciador);
    let influencer = myInfluencers.find((item) => item.handle === normalizedHandle);
    const hasFinancialValues = parseCents(row.trafego) > 0 || parseCents(row.faturamento) > 0;
    if (!influencer && hasFinancialValues && validHandle(normalizedHandle)) {
      const { data, error } = await supabase
        .from("influencers")
        .insert({
          handle: normalizedHandle,
          owner_id: user.id,
          owner_nome: user.nome,
          ativo: true,
        })
        .select("id, handle")
        .single();
      if (error || !data) {
        toast.error("Não foi possível vincular o influenciador à Minha Lista", { description: error?.message });
        return null;
      }
      influencer = data;
      setMyInfluencers((current) => [...current, data].sort((a, b) => a.handle.localeCompare(b.handle, "pt-BR")));
    }
    if (!influencer) return null;

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let recordId = dailyRecordIds.current[rowKey];
    if (!recordId) {
      const { data: existing, error: lookupError } = await supabase
        .from("daily_influencer_records")
        .select("id")
        .eq("closer_id", user.id)
        .eq("date", date)
        .eq("influencer_id", influencer.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (lookupError) {
        toast.error("Não foi possível localizar o registro do dia", { description: lookupError.message });
        return null;
      }
      recordId = existing?.id;
    }

    const recordPayload = {
      valor_pago: parseCents(row.trafego) / 100,
      faturamento: parseCents(row.faturamento) / 100,
      acumulado: parseCents(row.acumulado) / 100,
      observacao: row.observacao.trim() || null,
    };

    if (recordId) {
      const { error } = await supabase.from("daily_influencer_records").update(recordPayload).eq("id", recordId);
      if (error) {
        toast.error("Não foi possível salvar os dados da linha", { description: error.message });
        return null;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("daily_influencer_records")
        .insert({ ...recordPayload, closer_id: user.id, date, influencer_id: influencer.id })
        .select("id")
        .single();
      if (error || !inserted?.id) {
        toast.error("Não foi possível criar o registro do dia", { description: error?.message });
        return null;
      }
      recordId = inserted.id;
    }

    dailyRecordIds.current[rowKey] = recordId;
    return recordId;
  }, [month, myInfluencers, user, year]);

  const persistRow = useCallback(async (day: number, rowIndex: number, rowOverride?: SheetRow) => {
    if (!user) return;
    const key = `${day}:${rowIndex}`;
    if (!dirtyRows.current.has(key)) return;

    const row = rowOverride ?? rowsRef.current[day][rowIndex];
    const payload = {
      influenciador: row.influenciador.trim() || null,
      diaria_cents: parseCents(row.trafego),
      faturamento_cents: parseCents(row.faturamento),
      acumulado_cents: parseCents(row.acumulado),
    };
    const isEmpty = !payload.influenciador && !payload.diaria_cents && !payload.faturamento_cents && !payload.acumulado_cents && !row.comprovanteUrl && !row.observacao.trim();
    const existingId = rowIds.current[key];

    dirtyRows.current.delete(key);
    let error: { message: string } | null = null;

    if (isEmpty && existingId) {
      ({ error } = await betaTable().delete().eq("id", existingId));
      if (!error) delete rowIds.current[key];
    } else if (!isEmpty && existingId) {
      ({ error } = await betaTable().update(payload).eq("id", existingId));
    } else if (!isEmpty) {
      const response = await betaTable()
        .upsert({
          closer_id: user.id,
          year,
          month,
          day,
          row_index: rowIndex,
          ...payload,
        }, { onConflict: "closer_id,year,month,day,row_index" })
        .select("id")
        .single();
      error = response.error;
      if (response.data?.id) rowIds.current[key] = response.data.id;
    }

    if (error) {
      dirtyRows.current.add(key);
      toast.error("Não foi possível salvar esta linha", { description: error.message });
      return;
    }
    if (!isEmpty) await ensureDailyRecord(day, rowIndex, row);
  }, [ensureDailyRecord, month, user, year]);

  const uploadProof = useCallback(async (day: number, rowIndex: number, file?: File) => {
    if (!file || !user) return;
    if (!(["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type))) {
      toast.error("Formato não aceito", { description: "Use JPG, PNG, WEBP ou PDF." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O limite é 10 MB." });
      return;
    }

    const currentRow = rowsRef.current[day][rowIndex];
    const rowKey = `${day}:${rowIndex}`;
    const hasRowContent = currentRow.influenciador.trim() || currentRow.trafego || currentRow.faturamento || currentRow.acumulado || currentRow.observacao.trim();
    if (!hasRowContent) {
      toast.error("Preencha a linha antes de anexar o Comprovante");
      return;
    }

    let betaRowId = rowIds.current[rowKey];
    if (!betaRowId) {
      const { data: savedRow, error: saveError } = await betaTable()
        .upsert({
          closer_id: user.id,
          year,
          month,
          day,
          row_index: rowIndex,
          influenciador: currentRow.influenciador.trim() || null,
          diaria_cents: parseCents(currentRow.trafego),
          faturamento_cents: parseCents(currentRow.faturamento),
          acumulado_cents: parseCents(currentRow.acumulado),
        }, { onConflict: "closer_id,year,month,day,row_index" })
        .select("id")
        .single();
      if (saveError || !savedRow?.id) {
        toast.error("Não foi possível preparar a linha para o Comprovante", {
          description: saveError?.message ?? "A linha não retornou um identificador.",
        });
        return;
      }
      betaRowId = savedRow.id;
      rowIds.current[rowKey] = betaRowId;
      dirtyRows.current.delete(rowKey);
    }

    const dailyRecordId = await ensureDailyRecord(day, rowIndex, currentRow);
    if (!dailyRecordId) {
      toast.error("Selecione um influenciador da Minha Lista antes de anexar o Comprovante");
      return;
    }

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `daily-receipts/${user.teamId ?? "unknown"}/${user.id}/${date}/${Date.now()}-${rowIndex}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("comprovantes").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      toast.error("Erro ao enviar comprovante", { description: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("comprovantes").getPublicUrl(path);
    const existingReceiptId = receiptIds.current[rowKey];
    const receiptPayload = {
      date,
      closer_id: user.id,
      daily_record_id: dailyRecordId,
      file_url: data.publicUrl,
      file_type: file.type === "application/pdf" ? "pdf" : "image",
      uploaded_by: user.id,
      parsed_data: { manual_influencer: normalizeHandle(currentRow.influenciador), source: "planilhamento" },
      parse_status: file.type === "application/pdf" ? null : "processing",
    };
    const receiptResponse = existingReceiptId
      ? await (supabase.from("daily_receipt_uploads") as any).update(receiptPayload).eq("id", existingReceiptId).select("id").single()
      : await (supabase.from("daily_receipt_uploads") as any).insert(receiptPayload).select("id").single();
    if (receiptResponse.error) {
      toast.error("Erro ao vincular Comprovante", { description: receiptResponse.error.message });
      return;
    }
    receiptIds.current[rowKey] = receiptResponse.data.id;
    updateRow(day, rowIndex, { comprovanteUrl: data.publicUrl });
    dirtyRows.current.delete(rowKey);
    if (receiptPayload.file_type === "image") {
      void supabase.functions.invoke("parse-receipt", { body: { receiptId: receiptResponse.data.id } });
    }
    toast.success("Comprovante anexado");
  }, [ensureDailyRecord, month, updateRow, user, year]);

  const openProofPreview = useCallback(async (url: string) => {
    const path = comprovanteStoragePath(url);
    if (!path) {
      setProofPreviewUrl(url);
      return;
    }

    const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o Comprovante", {
        description: error?.message ?? "O arquivo não retornou uma URL válida.",
      });
      return;
    }
    setProofPreviewUrl(data.signedUrl);
  }, []);

  const addToMyList = useCallback(async (handle: string) => {
    if (!user) return;
    const normalized = normalizeHandle(handle);
    if (!validHandle(normalized)) {
      toast.error("@ do Instagram inválido");
      return;
    }
    const alreadyExists = myInfluencers.some((item) => item.handle === normalized);
    if (alreadyExists) return;

    const { data, error } = await supabase
      .from("influencers")
      .insert({
        handle: normalized,
        owner_id: user.id,
        owner_nome: user.nome,
        ativo: true,
      })
      .select("id, handle")
      .single();

    if (error) {
      toast.error("Não foi possível adicionar à Minha Lista", { description: error.message });
      return;
    }
    setMyInfluencers((current) => [...current, data].sort((a, b) => a.handle.localeCompare(b.handle, "pt-BR")));
    toast.success(`${normalized} adicionado à Minha Lista`);
  }, [myInfluencers, user]);

  const moveOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-sheet-input]"));
    const position = inputs.indexOf(event.currentTarget);
    inputs[position + 4]?.focus();
  };

  const addManualDay = () => {
    const [selectedYear, selectedMonth, selectedDay] = dateToAdd.split("-").map(Number);
    if (!dateToAdd || selectedYear !== year || selectedMonth !== month || selectedDay < 1 || selectedDay > daysInMonth) {
      toast.error("Escolha uma data válida do mês aberto");
      return false;
    }
    if (dateToAdd > todayIso) {
      toast.error("Não é possível adicionar um dia futuro");
      return false;
    }
    if (visibleRowsByDay[selectedDay]) {
      toast.info("Este dia já está aberto no Planilhamento");
    } else {
      setVisibleRowsByDay((current) => ({ ...current, [selectedDay]: DEFAULT_ROWS_PER_DAY }));
    }
    window.setTimeout(() => {
      document.querySelector(`[data-sheet-day="${selectedDay}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return true;
  };

  const input = (
    day: number,
    rowIndex: number,
    field: keyof SheetRow,
    value: string,
    numeric = false,
  ) => (
    <input
      data-sheet-input
      aria-label={`${field}, dia ${day}, linha ${rowIndex + 1}`}
      inputMode={numeric ? "decimal" : "text"}
      value={value}
      onChange={(event) => updateRow(day, rowIndex, {
        [field]: numeric ? sanitizeNumber(event.target.value) : event.target.value,
      })}
      onBlur={() => void persistRow(day, rowIndex)}
      onKeyDown={moveOnEnter}
      className="h-full w-full border-0 bg-transparent px-1 text-center font-[Poppins] text-[15px] text-foreground outline-none focus:bg-[var(--sheet-focus)]"
    />
  );

  return (
    <div
      className="min-h-screen w-full overflow-x-auto bg-[var(--sheet-canvas)] pb-12"
      style={{
        "--sheet-canvas": "#ffffff",
        "--sheet-cell": "#ffffff",
        "--sheet-grid": "#d9d9d9",
        "--sheet-header": "#1f9d55",
        "--sheet-result-header": "#fbbc04",
        "--sheet-result-positive": "#b7e1cd",
        "--sheet-result-warning": "#fce8b2",
        "--sheet-result-negative": "#f4c7c3",
        "--sheet-focus": "#e8f0fe",
        "--sheet-roi-pill": "#f1f2f4",
        "--sheet-roi-neutral": "#6b7280",
        "--sheet-roi-positive": "#16835b",
        "--sheet-roi-warning": "#a16207",
        "--sheet-roi-negative": "#c2413b",
        "--observation-green": "#e8f4ed",
        "--observation-yellow": "#fff6dc",
        "--observation-red": "#fbe9e7",
        "--observation-blue": "#eaf1fb",
        "--observation-text": "#202124",
        "--observation-text-blue": "#315f9b",
      } as React.CSSProperties}
    >
      <div className="sticky left-0 z-20 flex h-[72px] min-w-max items-center justify-end gap-3 border-b border-[var(--sheet-grid)] bg-[var(--sheet-canvas)] px-6">
        <Select
          value={selectedMonth}
          onValueChange={(value) => {
            const [nextYear, nextMonth] = value.split("-").map(Number);
            setYear(nextYear);
            setMonth(nextMonth);
          }}
        >
          <SelectTrigger className="h-11 w-[220px] rounded-2xl border-border bg-background px-4 text-sm shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!latestAllowedDate}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-xs font-semibold text-background shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CalendarPlus className="h-4 w-4" />
              Adicionar dia
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-2xl border-border/70 p-0 shadow-xl" align="end">
            <div className="border-b border-border/70 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Escolha o dia</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Selecione uma data do mês aberto.</p>
            </div>
            <Calendar
              mode="single"
              locale={ptBR}
              selected={dateToAdd ? new Date(`${dateToAdd}T12:00:00`) : undefined}
              onSelect={(date) => {
                if (!date) return;
                setDateToAdd(isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()));
              }}
              defaultMonth={new Date(year, month - 1, 1)}
              disabled={(date) => (
                date.getFullYear() !== year
                || date.getMonth() + 1 !== month
                || date > new Date(`${latestAllowedDate}T23:59:59`)
              )}
              initialFocus
              className="p-4"
            />
            <div className="flex items-center justify-between gap-4 border-t border-border/70 px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                {new Date(`${dateToAdd}T12:00:00`).toLocaleDateString("pt-BR")}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (addManualDay()) setDayPickerOpen(false);
                }}
                className="inline-flex h-9 items-center rounded-xl bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-90"
              >
                Confirmar
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="mx-[26px] w-[calc(100%-52px)]" style={{ minWidth: MIN_SHEET_WIDTH }}>
        <div className="mt-4 flex h-[54px] items-center justify-center bg-black font-[Poppins] text-[30px] font-bold text-white">
          {MONTHS_PT[month - 1]}
        </div>
        <div className="h-[13px]" />

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          displayedDays.map((day) => {
            const visibleRowCount = visibleRowsByDay[day] ?? DEFAULT_ROWS_PER_DAY;
            const visibleRows = rowsByDay[day].slice(0, visibleRowCount);
            const trafficTotal = visibleRows.reduce((total, row) => total + parseCents(row.trafego), 0);
            const revenueTotal = visibleRows.reduce((total, row) => total + parseCents(row.faturamento), 0);
            const populatedResults = visibleRows
              .map(rowResult)
              .filter((result): result is number => result !== null);
            const resultTotal = populatedResults.length > 0
              ? populatedResults.reduce((total, result) => total + result, 0)
              : null;
            const totalRoi = revenueTotal > 0 && trafficTotal > 0
              ? formatRoi(revenueTotal, trafficTotal)
              : null;
            return (
              <section key={day} data-sheet-day={day} aria-label={`Dia ${day}`}>
                <table className="w-full table-fixed border-collapse font-[Poppins]">
                  <colgroup>
                    {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="h-[41px] text-[15px] font-bold uppercase">
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">
                        {year === currentYear && month === currentMonth && day === currentDay
                          ? "HOJE"
                          : `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`}
                      </th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Influenciador</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Pagamento</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Faturamento</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-header)] text-black">Resultado (-3%)</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Acumulado</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Comprovante</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => {
                      const result = rowResult(row);
                      const traffic = parseCents(row.trafego);
                      const revenue = parseCents(row.faturamento);
                      const roi = revenue > 0 && traffic > 0 ? formatRoi(revenue, traffic) : null;
                      return (
                        <tr key={rowIndex} className="h-[21px]">
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-1 text-center">
                            {roi && (
                              <span
                                className="inline-flex min-w-[38px] items-center justify-center rounded-full bg-[var(--sheet-roi-pill)] px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                                style={{ color: resultTextColor(result, traffic) }}
                                title={`ROI ${roi}`}
                              >
                                {roi}
                              </span>
                            )}
                          </td>
                          <td className="relative z-0 border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0 focus-within:z-[70]">
                            <InfluencerCell
                              day={day}
                              rowIndex={rowIndex}
                              value={row.influenciador}
                              influencers={myInfluencers}
                              onChange={(value) => updateRow(day, rowIndex, { influenciador: value })}
                              onBlur={() => {
                                warnDuplicateInfluencer(day, rowIndex);
                                void persistRow(day, rowIndex);
                              }}
                              onEnter={moveOnEnter}
                              onAdd={addToMyList}
                            />
                          </td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "trafego", row.trafego, true)}</td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "faturamento", row.faturamento, true)}</td>
                          <td
                            className="border border-[var(--sheet-grid)] px-1 text-center text-[15px] tabular-nums text-black"
                            style={{ background: resultBackground(result, traffic) }}
                          >
                            {result === null ? "" : formatCents(result)}
                          </td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "acumulado", row.acumulado, true)}</td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-1">
                            <div className="flex items-center justify-center gap-1">
                              {row.influenciador.trim() && (
                                <label
                                  className="inline-flex h-[21px] w-[21px] cursor-pointer items-center justify-center rounded border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  title={row.comprovanteUrl ? "Trocar Comprovante" : "Anexar Comprovante"}
                                  aria-label={row.comprovanteUrl ? "Trocar Comprovante" : "Anexar Comprovante"}
                                >
                                  <ImagePlus className="h-3 w-3" />
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    className="sr-only"
                                    onChange={(event) => void uploadProof(day, rowIndex, event.target.files?.[0])}
                                  />
                                </label>
                              )}
                              {row.comprovanteUrl && (
                                <button
                                  type="button"
                                  onClick={() => void openProofPreview(row.comprovanteUrl)}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--sheet-grid)] text-foreground hover:bg-muted"
                                  title="Ver Comprovante"
                                  aria-label="Abrir Comprovante"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="relative z-0 border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0 focus-within:z-[80]">
                            <ObservationCell
                              day={day}
                              rowIndex={rowIndex}
                              value={row.observacao}
                              style={row.observationStyle}
                              onChange={(value) => updateRow(day, rowIndex, { observacao: value })}
                              onBlur={() => void persistRow(day, rowIndex)}
                              onStyleChange={(patch) => void updateObservationStyle(day, rowIndex, patch)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="h-[27px] bg-[var(--sheet-cell)] text-[15px] font-bold text-black">
                      <td className="border border-[var(--sheet-grid)] px-1 text-center">
                        {totalRoi && (
                          <span
                            className="inline-flex min-w-[38px] items-center justify-center rounded-full bg-[var(--sheet-roi-pill)] px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                            style={{ color: resultTextColor(resultTotal, trafficTotal) }}
                            title={`ROI total ${totalRoi}`}
                          >
                            {totalRoi}
                          </span>
                        )}
                      </td>
                      <td className="border border-[var(--sheet-grid)] text-center">TOTAL</td>
                      <td className="border border-[var(--sheet-grid)] text-center tabular-nums">{formatCents(trafficTotal)}</td>
                      <td className="border border-[var(--sheet-grid)] text-center tabular-nums">{formatCents(revenueTotal)}</td>
                      <td
                        className="border border-[var(--sheet-grid)] text-center font-normal tabular-nums"
                        style={{ background: resultBackground(resultTotal, trafficTotal) }}
                      >
                        {resultTotal === null ? "" : formatCents(resultTotal)}
                      </td>
                      <td className="border border-[var(--sheet-grid)]" />
                      <td className="border border-[var(--sheet-grid)]" />
                      <td className="border border-[var(--sheet-grid)]" />
                    </tr>
                  </tfoot>
                </table>
              </section>
            );
          })
        )}
      </div>
      <ComprovanteLightbox
        open={Boolean(proofPreviewUrl)}
        url={proofPreviewUrl}
        onClose={() => setProofPreviewUrl("")}
      />
    </div>
  );
}
