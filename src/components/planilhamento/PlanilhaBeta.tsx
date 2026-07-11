import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

const ROWS_PER_MONTH = 40;
const FEE_RATE = 0.10; // 10% da coluna FATURAMENTO

interface RowState {
  influenciador: string;
  trafego: string;      // BRL masked (mapped to diaria_cents)
  faturamento: string;  // BRL masked
  acumulado: string;    // BRL masked (entrada manual)
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
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatBRLFromInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// Sem símbolo R$ — visual mais próximo do Sheets
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
      influenciador: "",
      trafego: "",
      faturamento: "",
      acumulado: "",
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
        influenciador: "",
        trafego: "",
        faturamento: "",
        acumulado: "",
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

  // RESULTADO = Faturamento - Tráfego - Faturamento * 10%
  const resultados = useMemo(
    () =>
      rows.map((r) => {
        const fat = toCents(r.faturamento);
        const tra = toCents(r.trafego);
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
    const diaria_cents = toCents(r.trafego);
    const faturamento_cents = toCents(r.faturamento);
    const acumulado_cents = toCents(r.acumulado);
    const influenciador = r.influenciador.trim() || null;
    const isEmpty =
      !influenciador &&
      diaria_cents === 0 &&
      faturamento_cents === 0 &&
      acumulado_cents === 0;

    const existingId = rowIds.current[idx];

    if (isEmpty) {
      if (existingId) {
        await supabase.from("planilha_beta").delete().eq("id", existingId);
        delete rowIds.current[idx];
      }
      return;
    }

    if (existingId) {
      await supabase
        .from("planilha_beta")
        .update({ influenciador, diaria_cents, faturamento_cents, acumulado_cents, day })
        .eq("id", existingId);
    } else {
      const { data } = await supabase
        .from("planilha_beta")
        .insert({
          closer_id: user.id,
          year,
          month,
          day,
          row_index: idx,
          influenciador,
          diaria_cents,
          faturamento_cents,
          acumulado_cents,
        })
        .select("id")
        .single();
      if (data?.id) rowIds.current[idx] = data.id;
    }
  };

  const monthLabel = MONTHS_PT[month - 1];
  const firstDayStr = `01/${String(month).padStart(2, "0")}/${year}`;

  const cellBase =
    "border border-black/70 px-2 py-2 text-center align-middle";
  const inputBase =
    "w-full bg-transparent text-center outline-none focus:bg-blue-50/60";

  return (
    <div className="mx-auto max-w-[1400px]" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          ◀
        </button>
        <span className="text-xs font-medium text-slate-700 tabular-nums">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          ▶
        </button>
      </div>

      <div className="overflow-hidden bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse"
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
            >
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead>
                {/* Faixa preta com o mês */}
                <tr>
                  <th
                    colSpan={6}
                    className="border border-black bg-black text-white text-center"
                    style={{ height: 78, fontSize: 30, fontWeight: 700, letterSpacing: 1 }}
                  >
                    {monthLabel}
                  </th>
                </tr>
                {/* Linha em branco (row 2 do Sheets) */}
                <tr>
                  <th colSpan={6} className="p-0" style={{ height: 14 }} />
                </tr>
                {/* Cabeçalho das colunas */}
                <tr style={{ height: 58 }}>
                  <th className={`${cellBase} text-white`} style={{ background: "#1F9D55", fontWeight: 700 }}>
                    {firstDayStr}
                  </th>
                  <th className={`${cellBase} text-white`} style={{ background: "#1F9D55", fontWeight: 700 }}>
                    INFLUENCIADOR
                  </th>
                  <th className={`${cellBase} text-white`} style={{ background: "#1F9D55", fontWeight: 700 }}>
                    TRÁFEGO
                  </th>
                  <th className={`${cellBase} text-white`} style={{ background: "#1F9D55", fontWeight: 700 }}>
                    FATURAMENTO
                  </th>
                  <th className={`${cellBase} text-black`} style={{ background: "#FBBC04", fontWeight: 700 }}>
                    RESULTADO
                  </th>
                  <th className={`${cellBase} text-white`} style={{ background: "#1F9D55", fontWeight: 700 }}>
                    ACUMULADO
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const resultado = resultados[idx];
                  let resBg = "transparent";
                  let resColor = "#000";
                  if (resultado > 0) {
                    resBg = "#D9EAD3"; // verde claro Sheets
                    resColor = "#000";
                  } else if (resultado < 0) {
                    resBg = "#F4CCCC"; // vermelho claro Sheets
                    resColor = "#000";
                  }
                  return (
                    <tr key={idx} style={{ height: 40 }}>
                      <td className={`${cellBase}`} />
                      <td className={`${cellBase} p-0`}>
                        <input
                          type="text"
                          value={r.influenciador}
                          onChange={(e) => updateRow(idx, { influenciador: e.target.value })}
                          onBlur={() => persistRow(idx)}
                          className={`${inputBase} px-2 py-2`}
                          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                        />
                      </td>
                      <td className={`${cellBase} p-0`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.trafego}
                          onChange={(e) => updateRow(idx, { trafego: formatBRLFromInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          className={`${inputBase} px-2 py-2 tabular-nums`}
                          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                        />
                      </td>
                      <td className={`${cellBase} p-0`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.faturamento}
                          onChange={(e) => updateRow(idx, { faturamento: formatBRLFromInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          className={`${inputBase} px-2 py-2 tabular-nums`}
                          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                        />
                      </td>
                      <td
                        className={`${cellBase} tabular-nums`}
                        style={{ background: resBg, color: resColor, fontWeight: 500 }}
                      >
                        {resultado === 0 ? "0" : displayNumber(resultado)}
                      </td>
                      <td className={`${cellBase} p-0`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.acumulado}
                          onChange={(e) => updateRow(idx, { acumulado: formatBRLFromInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          className={`${inputBase} px-2 py-2 tabular-nums`}
                          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Abas de meses estilo Google Sheets */}
      <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-200 bg-[#f8f9fa] px-2 py-2 rounded-b-md">
        {MONTHS_PT.map((m, i) => {
          const isActive = month === i + 1;
          return (
            <button
              key={m}
              onClick={() => setMonth(i + 1)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {m.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
