import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutStore } from "@/store/useLayoutStore";

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

const DEFAULT_ROWS_PER_DAY = 20;
const MAX_ROWS_PER_DAY = 100;
const DAILY_FEE_RATE = 0.1;

const COLUMN_WIDTHS = [94, 176, 130, 150, 155, 90, 140, 135];
const MIN_SHEET_WIDTH = 1480;

interface SheetRow {
  influenciador: string;
  trafego: string;
  faturamento: string;
  acumulado: string;
  comprovanteUrl: string;
  observacao: string;
}

interface DbRow {
  id: string;
  day: number;
  row_index: number;
  influenciador: string | null;
  diaria_cents: number;
  faturamento_cents: number;
  acumulado_cents: number;
  comprovante_url: string | null;
  observacao: string | null;
}

type MonthRows = Record<number, SheetRow[]>;

const emptyRow = (): SheetRow => ({
  influenciador: "",
  trafego: "",
  faturamento: "",
  acumulado: "",
  comprovanteUrl: "",
  observacao: "",
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

function rowResult(row: SheetRow): number | null {
  const hasValues = row.influenciador.trim() || row.trafego || row.faturamento || row.acumulado || row.comprovanteUrl || row.observacao.trim();
  if (!hasValues) return null;
  const traffic = parseCents(row.trafego);
  const revenue = parseCents(row.faturamento);
  return Math.round(revenue - traffic - revenue * DAILY_FEE_RATE);
}

function formatRoi(result: number | null, traffic: number): string {
  if (result === null || traffic <= 0) return "—";
  return `${((result / traffic) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const betaTable = () => supabase.from("planilha_beta") as any;

function resultBackground(result: number | null, traffic: number): string {
  if (result === null) return "var(--sheet-cell)";
  if (result < 0) return "var(--sheet-result-negative)";
  if (result <= traffic * 0.3) return "var(--sheet-result-warning)";
  return "var(--sheet-result-positive)";
}

export default function PlanilhaBeta() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const [rowsByDay, setRowsByDay] = useState<MonthRows>(() => createMonthRows(daysInMonth));
  const [visibleRowsByDay, setVisibleRowsByDay] = useState<Record<number, number>>({});
  const rowsRef = useRef(rowsByDay);
  const rowIds = useRef<Record<string, string>>({});
  const dirtyRows = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rowsByDay;
  }, [rowsByDay]);

  useEffect(() => {
    useLayoutStore.getState().setFullWidth(true);
    return () => useLayoutStore.getState().setFullWidth(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadRows = async () => {
      setLoading(true);
      rowIds.current = {};
      dirtyRows.current.clear();

      const { data, error } = await betaTable()
        .select("id, day, row_index, influenciador, diaria_cents, faturamento_cents, acumulado_cents, comprovante_url, observacao")
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

      const nextRows = createMonthRows(daysInMonth);
      const nextVisibleRows: Record<number, number> = Object.fromEntries(
        Array.from({ length: daysInMonth }, (_, index) => [index + 1, DEFAULT_ROWS_PER_DAY]),
      );
      (data as DbRow[] | null)?.forEach((row) => {
        if (!nextRows[row.day] || row.row_index < 0 || row.row_index >= MAX_ROWS_PER_DAY) return;
        nextRows[row.day][row.row_index] = {
          influenciador: row.influenciador ?? "",
          trafego: formatCents(row.diaria_cents),
          faturamento: formatCents(row.faturamento_cents),
          acumulado: formatCents(row.acumulado_cents),
          comprovanteUrl: row.comprovante_url ?? "",
          observacao: row.observacao ?? "",
        };
        rowIds.current[`${row.day}:${row.row_index}`] = row.id;
        nextVisibleRows[row.day] = Math.max(nextVisibleRows[row.day], row.row_index + 1);
      });

      rowsRef.current = nextRows;
      setRowsByDay(nextRows);
      setVisibleRowsByDay(nextVisibleRows);
      setLoading(false);
    };

    void loadRows();
    return () => { cancelled = true; };
  }, [daysInMonth, month, user, year]);

  const updateRow = useCallback((day: number, rowIndex: number, patch: Partial<SheetRow>) => {
    const key = `${day}:${rowIndex}`;
    dirtyRows.current.add(key);
    setRowsByDay((current) => {
      const dayRows = [...current[day]];
      dayRows[rowIndex] = { ...dayRows[rowIndex], ...patch };
      return { ...current, [day]: dayRows };
    });
  }, []);

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
      comprovante_url: row.comprovanteUrl || null,
      observacao: row.observacao.trim() || null,
    };
    const isEmpty = !payload.influenciador && !payload.diaria_cents && !payload.faturamento_cents && !payload.acumulado_cents && !payload.comprovante_url && !payload.observacao;
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
        .insert({
          closer_id: user.id,
          year,
          month,
          day,
          row_index: rowIndex,
          ...payload,
        })
        .select("id")
        .single();
      error = response.error;
      if (response.data?.id) rowIds.current[key] = response.data.id;
    }

    if (error) {
      dirtyRows.current.add(key);
      toast.error("Não foi possível salvar esta linha");
    }
  }, [month, user, year]);

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

    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${user.id}/planilha-beta/${year}/${month}/${day}-${rowIndex}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("comprovantes").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      toast.error("Erro ao enviar comprovante", { description: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("comprovantes").getPublicUrl(path);
    const nextRow = { ...rowsRef.current[day][rowIndex], comprovanteUrl: data.publicUrl };
    updateRow(day, rowIndex, { comprovanteUrl: data.publicUrl });
    await persistRow(day, rowIndex, nextRow);
    toast.success("Comprovante anexado");
  }, [month, persistRow, updateRow, user, year]);

  const moveOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-sheet-input]"));
    const position = inputs.indexOf(event.currentTarget);
    inputs[position + 4]?.focus();
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
      } as React.CSSProperties}
    >
      <div className="sticky left-0 z-20 flex h-10 items-center gap-2 border-b border-[var(--sheet-grid)] bg-[var(--sheet-canvas)] px-3">
        <button className="h-7 rounded border border-[var(--sheet-grid)] px-2 text-xs" onClick={() => setYear((value) => value - 1)}>◀</button>
        <span className="min-w-12 text-center text-xs font-semibold tabular-nums">{year}</span>
        <button className="h-7 rounded border border-[var(--sheet-grid)] px-2 text-xs" onClick={() => setYear((value) => value + 1)}>▶</button>
        <select
          aria-label="Mês"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
          className="ml-2 h-7 rounded border border-[var(--sheet-grid)] bg-background px-2 text-xs"
        >
          {MONTHS_PT.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
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
          Array.from({ length: daysInMonth }, (_, dayIndex) => {
            const day = dayIndex + 1;
            const visibleRowCount = visibleRowsByDay[day] ?? DEFAULT_ROWS_PER_DAY;
            const visibleRows = rowsByDay[day].slice(0, visibleRowCount);
            const trafficTotal = visibleRows.reduce((total, row) => total + parseCents(row.trafego), 0);
            const revenueTotal = visibleRows.reduce((total, row) => total + parseCents(row.faturamento), 0);
            const resultTotal = visibleRows.reduce((total, row) => total + (rowResult(row) ?? 0), 0);
            return (
              <section key={day} aria-label={`Dia ${day}`}>
                <table className="w-full table-fixed border-collapse font-[Poppins]">
                  <colgroup>
                    {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="h-[41px] text-[15px] font-bold uppercase">
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">{String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year}</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Influenciador</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Tráfego</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Faturamento</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-result-header)] text-black">Resultado</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">ROI</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Acumulado</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Comprovante</th>
                      <th className="border border-[var(--sheet-grid)] bg-[var(--sheet-header)] text-white">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => {
                      const result = rowResult(row);
                      const traffic = parseCents(row.trafego);
                      return (
                        <tr key={rowIndex} className="h-[21px]">
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)]" />
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "influenciador", row.influenciador)}</td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "trafego", row.trafego, true)}</td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "faturamento", row.faturamento, true)}</td>
                          <td
                            className="border border-[var(--sheet-grid)] px-1 text-center text-[15px] tabular-nums text-black"
                            style={{ background: resultBackground(result, traffic) }}
                          >
                            {result === null ? "" : formatCents(result)}
                          </td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-1 text-center text-[13px] font-medium tabular-nums">
                            {formatRoi(result, traffic)}
                          </td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "acumulado", row.acumulado, true)}</td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-1">
                            <div className="flex items-center justify-center gap-1">
                              <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full bg-foreground px-2.5 text-[10px] font-semibold text-background transition-opacity hover:opacity-80">
                                <Paperclip className="h-3 w-3" />
                                {row.comprovanteUrl ? "Trocar" : "Anexar"}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,application/pdf"
                                  className="sr-only"
                                  onChange={(event) => void uploadProof(day, rowIndex, event.target.files?.[0])}
                                />
                              </label>
                              {row.comprovanteUrl && (
                                <a href={row.comprovanteUrl} target="_blank" rel="noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--sheet-grid)] text-foreground hover:bg-muted" title="Ver comprovante">
                                  <Eye className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="border border-[var(--sheet-grid)] bg-[var(--sheet-cell)] p-0">{input(day, rowIndex, "observacao", row.observacao)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="h-[27px] bg-[var(--sheet-cell)] text-[15px] font-bold text-black">
                      <td className="border border-[var(--sheet-grid)]" />
                      <td className="border border-[var(--sheet-grid)] text-center">TOTAL</td>
                      <td className="border border-[var(--sheet-grid)] text-center tabular-nums">{formatCents(trafficTotal)}</td>
                      <td className="border border-[var(--sheet-grid)] text-center tabular-nums">{formatCents(revenueTotal)}</td>
                      <td
                        className="border border-[var(--sheet-grid)] text-center font-normal tabular-nums"
                        style={{ background: resultBackground(resultTotal, trafficTotal) }}
                      >
                        {formatCents(resultTotal)}
                      </td>
                      <td className="border border-[var(--sheet-grid)] text-center font-normal tabular-nums">{formatRoi(resultTotal, trafficTotal)}</td>
                      <td className="border border-[var(--sheet-grid)]" />
                      <td className="border border-[var(--sheet-grid)]" />
                      <td className="border border-[var(--sheet-grid)]" />
                    </tr>
                  </tfoot>
                </table>
                <div className="flex h-12 items-center border-x border-b border-[var(--sheet-grid)] bg-[var(--sheet-cell)] px-3">
                  <button
                    type="button"
                    disabled={visibleRowCount >= MAX_ROWS_PER_DAY}
                    onClick={() => setVisibleRowsByDay((current) => ({
                      ...current,
                      [day]: Math.min(MAX_ROWS_PER_DAY, visibleRowCount + 1),
                    }))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar linha
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
