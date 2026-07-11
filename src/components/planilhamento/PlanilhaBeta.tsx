import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

const ROWS_PER_MONTH = 40;

interface RowState {
  influenciador: string;
  diaria: string; // BRL masked
  faturamento: string; // BRL masked
}

interface DbRow {
  id?: string;
  day: number;
  row_index: number;
  influenciador: string | null;
  diaria_cents: number;
  faturamento_cents: number;
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function PlanilhaBeta() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RowState[]>(
    Array.from({ length: ROWS_PER_MONTH }, () => ({
      influenciador: "",
      diaria: "",
      faturamento: "",
    }))
  );
  const rowIds = useRef<Record<number, string>>({});
  const dirtyIndex = useRef<Set<number>>(new Set());

  // Load rows for month
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      rowIds.current = {};
      dirtyIndex.current.clear();
      const { data } = await supabase
        .from("planilha_beta")
        .select("id, day, row_index, influenciador, diaria_cents, faturamento_cents")
        .eq("closer_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .order("row_index");

      const fresh: RowState[] = Array.from({ length: ROWS_PER_MONTH }, () => ({
        influenciador: "",
        diaria: "",
        faturamento: "",
      }));
      (data as DbRow[] | null)?.forEach((r) => {
        if (r.row_index >= 0 && r.row_index < ROWS_PER_MONTH) {
          fresh[r.row_index] = {
            influenciador: r.influenciador || "",
            diaria: fromCents(r.diaria_cents),
            faturamento: fromCents(r.faturamento_cents),
          };
          if (r.id) rowIds.current[r.row_index] = r.id;
        }
      });
      setRows(fresh);
      setLoading(false);
    };
    load();
  }, [user?.id, year, month]);

  const totals = useMemo(() => {
    let acc = 0;
    const perRow = rows.map((r) => {
      const fat = toCents(r.faturamento);
      const dia = toCents(r.diaria);
      const resultado = fat - dia;
      acc += resultado;
      return { resultado, acumulado: acc };
    });
    return perRow;
  }, [rows]);

  const totalResultado = totals.length ? totals[totals.length - 1].acumulado : 0;

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
    const day = Math.min(idx + 1, daysInMonth(year, month));
    const diaria_cents = toCents(r.diaria);
    const faturamento_cents = toCents(r.faturamento);
    const influenciador = r.influenciador.trim() || null;
    const isEmpty = !influenciador && diaria_cents === 0 && faturamento_cents === 0;

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
        .update({ influenciador, diaria_cents, faturamento_cents, day })
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
        })
        .select("id")
        .single();
      if (data?.id) rowIds.current[idx] = data.id;
    }
  };

  const monthLabel = MONTHS_PT[month - 1];
  const dim = daysInMonth(year, month);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Year selector */}
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

      {/* Sheet */}
      <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" style={{ fontFamily: "Arial, sans-serif" }}>
              {/* Row 1: black header with month */}
              <thead>
                <tr>
                  <th
                    colSpan={6}
                    className="border border-slate-400 bg-black py-3 text-center text-[22px] font-bold tracking-wider text-white"
                  >
                    {monthLabel}
                  </th>
                </tr>
                {/* Row 2: red warning above RESULTADO */}
                <tr>
                  <th className="border border-slate-400 bg-white p-0" />
                  <th className="border border-slate-400 bg-white p-0" />
                  <th className="border border-slate-400 bg-white p-0" />
                  <th className="border border-slate-400 bg-white p-0" />
                  <th className="border border-slate-400 bg-[#e74c3c] py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                    Não alterar manualmente
                  </th>
                  <th className="border border-slate-400 bg-white p-0" />
                </tr>
                {/* Row 3: column headers */}
                <tr>
                  <th className="border border-slate-400 bg-[#2e9c48] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-white w-[110px]">
                    {`01/${String(month).padStart(2, "0")}/${year}`}
                  </th>
                  <th className="border border-slate-400 bg-[#2e9c48] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-white">
                    Influenciador
                  </th>
                  <th className="border border-slate-400 bg-[#2e9c48] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-white w-[140px]">
                    Diária
                  </th>
                  <th className="border border-slate-400 bg-[#2e9c48] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-white w-[160px]">
                    Faturamento
                  </th>
                  <th className="border border-slate-400 bg-[#f1c40f] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-black w-[140px]">
                    Resultado
                  </th>
                  <th className="border border-slate-400 bg-[#2e9c48] py-2 text-center text-[13px] font-bold uppercase tracking-wide text-white w-[160px]">
                    Acumulado
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const day = Math.min(idx + 1, dim);
                  const dateStr = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
                  const { resultado, acumulado } = totals[idx];
                  const resColor =
                    resultado > 0 ? "text-emerald-700" : resultado < 0 ? "text-red-600" : "text-slate-400";
                  const accColor =
                    acumulado > 0 ? "text-emerald-700" : acumulado < 0 ? "text-red-600" : "text-slate-400";
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="border border-slate-300 bg-slate-50 px-2 py-1 text-center text-[12px] font-medium text-slate-600 tabular-nums">
                        {dateStr}
                      </td>
                      <td className="border border-slate-300 p-0">
                        <input
                          type="text"
                          value={r.influenciador}
                          onChange={(e) => updateRow(idx, { influenciador: e.target.value })}
                          onBlur={() => persistRow(idx)}
                          className="w-full bg-transparent px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:bg-blue-50/50"
                          placeholder=""
                        />
                      </td>
                      <td className="border border-slate-300 p-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.diaria}
                          onChange={(e) => updateRow(idx, { diaria: formatBRLFromInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          className="w-full bg-transparent px-2 py-1.5 text-right text-[13px] tabular-nums text-slate-900 outline-none focus:bg-blue-50/50"
                          placeholder=""
                        />
                      </td>
                      <td className="border border-slate-300 p-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.faturamento}
                          onChange={(e) => updateRow(idx, { faturamento: formatBRLFromInput(e.target.value) })}
                          onBlur={() => persistRow(idx)}
                          className="w-full bg-transparent px-2 py-1.5 text-right text-[13px] tabular-nums text-slate-900 outline-none focus:bg-blue-50/50"
                          placeholder=""
                        />
                      </td>
                      <td className={`border border-slate-300 bg-[#fef7d6] px-2 py-1.5 text-right text-[13px] tabular-nums font-medium ${resColor}`}>
                        {resultado === 0 ? "0" : fromCents(resultado)}
                      </td>
                      <td className={`border border-slate-300 px-2 py-1.5 text-right text-[13px] tabular-nums font-medium ${accColor}`}>
                        {acumulado === 0 ? "0" : fromCents(acumulado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="border border-slate-400 bg-slate-100 px-2 py-2 text-right text-[12px] font-bold uppercase tracking-wide text-slate-700">
                    Total do mês
                  </td>
                  <td
                    colSpan={2}
                    className={`border border-slate-400 bg-slate-100 px-2 py-2 text-right text-[13px] tabular-nums font-bold ${
                      totalResultado > 0 ? "text-emerald-700" : totalResultado < 0 ? "text-red-600" : "text-slate-600"
                    }`}
                  >
                    {fromCents(totalResultado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Month tabs (Google Sheets style, bottom) */}
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
              style={{ fontFamily: "Arial, sans-serif" }}
            >
              {m.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
