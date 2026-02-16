/* ─── Financial Constants ─── */
export const TAX_DEV = 0.02;
export const TAX_GATEWAY = 0.03;
export const TAX_TOTAL = TAX_DEV + TAX_GATEWAY; // 5%

/* ─── Types ─── */
export interface DailyRecord {
  id: string;
  date: string;
  closer_id: string;
  valor_pago: number;
  faturamento: number | null;
}

export interface CloserProfile {
  id: string;
  nome: string;
}

export interface DayAggregate {
  cost: number;
  revenue: number;
  count: number;
}

export interface EmployeeDayData {
  costToday: number;
  revToday: number;
  countToday: number;
  costYesterday: number;
  revYesterday: number;
  countYesterday: number;
}

export type PeriodPreset = "today" | "yesterday" | "7d" | "30d" | "custom";

/* ─── Formatting ─── */
export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtShortDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/* ─── Date helpers ─── */
export function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr() {
  return dateToStr(new Date());
}

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateToStr(d);
}

export function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateToStr(d);
}

/* ─── Delta formatting ─── */
export function formatDelta(current: number, previous: number): { text: string; positive: boolean | null } {
  const diff = current - previous;
  if (diff === 0) return { text: "—", positive: null };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${formatBRL(diff)}`,
    positive: diff > 0,
  };
}
