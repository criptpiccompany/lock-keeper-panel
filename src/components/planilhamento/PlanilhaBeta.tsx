import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

const ROWS_PER_MONTH = 30;
const FEE_RATE = 0.10;

// Column widths (px) — total = 1135
const COL_W = {
  date: 125,
  influencer: 230,
  traffic: 170,
  revenue: 215,
  result: 195,
  accumulated: 200,
};
const TABLE_W =
  COL_W.date + COL_W.influencer + COL_W.traffic + COL_W.revenue + COL_W.result + COL_W.accumulated;

interface RowState {
  influenciador: string;
  trafego: string;
  faturamento: string;
  acumulado: string;
}
interface DbRow {
  id?: string;
  day: number;
  row_index: number;
  influenciador: string | null;
  diaria_cents: number;
  faturamento_cents: number;
  acumulado_cents?: number;
}

function toCents(masked: string): number {
  if (!masked) return 0;
  const digits = masked.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
function fromCents(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
function formatInput(raw: string): string {
  // Accept plain integers/decimals typed by user; store as displayed
  return raw.replace(/[^\d.,-]/g, "");
}
function parseUserNumber(s: string): number {
  if (!s) return 0;
  // Convert "1.234,56" or "1234.56" or "1234,56" -> cents
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}
function displayNumber(cents: number): string {
  if (!cents) return "";
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PlanilhaBeta() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RowState[]>(
    Array.from({ length: ROWS_PER_MONTH }, () => ({
      influenciador: "", trafego: "", faturamento: "", acumulado: "",
    }))
  );
  const rowIds = useRef<Record<number, string>>({});
  const dirtyIndex = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      rowIds.current = {};
      dirtyIndex.current.clear();
      const { data } = await supabase
        .from("planilha_beta")
        .select("id, day, row_index, influenciador, diaria_cents, faturamento_cents, acumulado_cents")
        .eq("closer_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .order("row_index");
      const fresh: RowState[] = Array.from({ length: ROWS_PER_MONTH }, () => ({
        influenciador: "", trafego: "", faturamento: "", acumulado: "",
      }));
      (data as DbRow[] | null)?.forEach((r) => {
        if (r.row_index >= 0 && r.row_index < ROWS_PER_MONTH) {
          fresh[r.row_index] = {
            influenciador: r.influenciador || "",
            trafego: fromCents(r.diaria_cents),
            faturamento: fromCents(r.faturamento_cents),
            acumulado: fromCents(r.acumulado_cents || 0),
          };
          if (r.id) rowIds.current[r.row_index] = r.id;
        }
      });
      setRows(fresh);
      setLoading(false);
    };
    load();
  }, [user?.id, year, month]);

  const resultados = useMemo(
    () =>
      rows.map((r) => {
        const hasData =
          r.influenciador.trim() || r.trafego || r.faturamento || r.acumulado;
        if (!hasData) return null;
        const fat = parseUserNumber(r.faturamento);
        const tra = parseUserNumber(r.trafego);
        if (fat === 0 && tra === 0) return null;
        return Math.round(fat - tra - fat * FEE_RATE);
      }),
    [rows]
  );

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    dirtyIndex.current.add(idx);
  };

  const persistRow = async (idx: number) => {
    if (!user) return;
    if (!dirtyIndex.current.has(idx)) return;
    dirtyIndex.current.delete(idx);
    const r = rows[idx];
    const day = 1;
    const diaria_cents = parseUserNumber(r.trafego);
    const faturamento_cents = parseUserNumber(r.faturamento);
    const acumulado_cents = parseUserNumber(r.acumulado);
    const influenciador = r.influenciador.trim() || null;
    const isEmpty =
      !influenciador && !diaria_cents && !faturamento_cents && !acumulado_cents;
    const existingId = rowIds.current[idx];
    if (isEmpty) {
      if (existingId) {
        await supabase.from("planilha_beta").delete().eq("id", existingId);
        delete rowIds.current[idx];
      }
      return;
    }
    if (existingId) {
      await supabase.from("planilha_beta")
        .update({ influenciador, diaria_cents, faturamento_cents, acumulado_cents, day })
        .eq("id", existingId);
    } else {
      const { data } = await supabase.from("planilha_beta")
        .insert({
          closer_id: user.id, year, month, day, row_index: idx,
          influenciador, diaria_cents, faturamento_cents, acumulado_cents,
        })
        .select("id").single();
      if (data?.id) rowIds.current[idx] = data.id;
    }
  };

  const monthLabel = MONTHS_PT[month - 1];
  const firstDayStr = `01/${String(month).padStart(2, "0")}/${year}`;

  const border = "1px solid #e3e3e3";
  const cellStyle: React.CSSProperties = {
    height: 26,
    padding: "0 8px",
    borderRight: border,
    borderBottom: border,
    fontFamily: "'Poppins', sans-serif",
    fontSize: 13,
    fontWeight: 400,
    color: "#111",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: "26px",
    background: "#fff",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 26,
    padding: "0 4px",
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: "'Poppins', sans-serif",
    fontSize: 13,
    color: "#111",
    textAlign: "center",
    lineHeight: "26px",
  };
  const headerCell: React.CSSProperties = {
    height: 42,
    padding: "0 8px",
    background: "#209d55",
    color: "#ffffff",
    fontFamily: "'Poppins', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    borderRight: border,
    borderBottom: border,
    textTransform: "uppercase",
  };
  const headerResult: React.CSSProperties = {
    ...headerCell,
    background: "#fcbc00",
    color: "#111",
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#fff" }}>
      {/* Year toggle */}
      <div style={{ width: TABLE_W, display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 6 }}>
        <button onClick={() => setYear((y) => y - 1)} className="rounded border px-2 py-0.5 text-xs">◀</button>
        <span className="text-xs font-medium tabular-nums" style={{ lineHeight: "22px" }}>{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="rounded border px-2 py-0.5 text-xs">▶</button>
      </div>

      <div style={{ width: "100%", overflowX: "auto", overflowY: "visible" }}>
        <div style={{ width: TABLE_W, minWidth: TABLE_W }}>
          {/* Black month bar */}
          <div
            style={{
              width: TABLE_W,
              height: 58,
              background: "#000",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Poppins', sans-serif",
              fontSize: 25,
              fontWeight: 700,
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {monthLabel}
          </div>
          <div style={{ height: 12, background: "#fff" }} />

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <table
              style={{
                width: TABLE_W,
                tableLayout: "fixed",
                borderCollapse: "collapse",
                borderTop: border,
                borderLeft: border,
              }}
            >
              <colgroup>
                <col style={{ width: COL_W.date }} />
                <col style={{ width: COL_W.influencer }} />
                <col style={{ width: COL_W.traffic }} />
                <col style={{ width: COL_W.revenue }} />
                <col style={{ width: COL_W.result }} />
                <col style={{ width: COL_W.accumulated }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={headerCell}>{firstDayStr}</th>
                  <th style={headerCell}>INFLUENCIADOR</th>
                  <th style={headerCell}>TRÁFEGO</th>
                  <th style={headerCell}>FATURAMENTO</th>
                  <th style={headerResult}>RESULTADO</th>
                  <th style={headerCell}>ACUMULADO</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const resultado = resultados[idx];
                  let resBg = "#fff";
                  if (resultado !== null && resultado !== undefined) {
                    if (resultado < 0) resBg = "#f4c6c3";
                    else if (resultado > 0 && resultado <= 5000) resBg = "#fde7b3";
                    else if (resultado > 5000) resBg = "#b7e0cd";
                  }
                  return (
                    <tr key={idx}>
                      <td style={cellStyle} />
                      <td style={{ ...cellStyle, padding: 0 }}>
                        <input
                          type="text"
                          value={r.influenciador}
                          onChange={(e) => updateRow(idx, { influenciador: e.target.value })}
                          onBlur={() => persistRow(idx)}
                          style={inputStyle}
                        />
                      </td>
                      <td style={{ ...cellStyle, padding: 0 }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.trafego}
                          onChange={(e) => updateRow(idx, { trafego: formatInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                      <td style={{ ...cellStyle, padding: 0 }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.faturamento}
                          onChange={(e) => updateRow(idx, { faturamento: formatInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                      <td style={{ ...cellStyle, background: resBg, fontVariantNumeric: "tabular-nums" }}>
                        {resultado === null || resultado === undefined ? "" : displayNumber(resultado)}
                      </td>
                      <td style={{ ...cellStyle, padding: 0 }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.acumulado}
                          onChange={(e) => updateRow(idx, { acumulado: formatInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const totTraf = rows.reduce((s, r) => s + parseUserNumber(r.trafego), 0);
                  const totFat = rows.reduce((s, r) => s + parseUserNumber(r.faturamento), 0);
                  const totRes = resultados.reduce((s: number, v) => s + (v || 0), 0);
                  const totAcum = rows.reduce((s, r) => s + parseUserNumber(r.acumulado), 0);
                  const footCell: React.CSSProperties = {
                    height: 38,
                    padding: "0 8px",
                    background: "#209d55",
                    color: "#fff",
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    verticalAlign: "middle",
                    borderRight: border,
                    borderBottom: border,
                    fontVariantNumeric: "tabular-nums",
                  };
                  const footResult: React.CSSProperties = { ...footCell, background: "#fcbc00", color: "#111" };
                  return (
                    <tr>
                      <td style={footCell}>TOTAL</td>
                      <td style={footCell} />
                      <td style={footCell}>{totTraf ? displayNumber(totTraf) : ""}</td>
                      <td style={footCell}>{totFat ? displayNumber(totFat) : ""}</td>
                      <td style={footResult}>{totRes ? displayNumber(totRes) : ""}</td>
                      <td style={footCell}>{totAcum ? displayNumber(totAcum) : ""}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          )}

          {/* Month tabs */}
          <div
            style={{
              width: TABLE_W,
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              background: "#f8f9fa",
              padding: 6,
            }}
          >
            {MONTHS_PT.map((m, i) => {
              const isActive = month === i + 1;
              return (
                <button
                  key={m}
                  onClick={() => setMonth(i + 1)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "'Poppins', sans-serif",
                    borderRadius: 4,
                    background: isActive ? "#fff" : "transparent",
                    color: isActive ? "#111" : "#666",
                    border: isActive ? "1px solid #d0d0d0" : "1px solid transparent",
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
