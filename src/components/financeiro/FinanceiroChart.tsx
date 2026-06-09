import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BrandCard } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { formatBRL, fmtShortDate, computeNet, type DayAggregate } from "./financeiroHelpers";

type Metric = "cost" | "revenue" | "net";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  filterStart: string;
  filterEnd: string;
}

const metricLabels: Record<Metric, string> = {
  cost: "Custo",
  revenue: "Faturamento bruto",
  net: "Resultado líquido",
};

export default function FinanceiroChart({ byDate, today, filterStart, filterEnd }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const data = useMemo(() => {
    const dates = Array.from(byDate.entries())
      .filter(([d]) => d >= filterStart && d <= filterEnd)
      .sort((a, b) => a[0].localeCompare(b[0]));

    return dates.map(([date, agg]) => {
      const net = computeNet(agg.revenue, agg.cost);
      return {
        date,
        label: fmtShortDate(date),
        cost: agg.cost,
        revenue: agg.revenue,
        net,
        isToday: date === today,
      };
    });
  }, [byDate, today, filterStart, filterEnd]);

  if (data.length < 2) {
    return (
      <BrandCard title="Evolução no período">
        <p className="text-[13px] text-slate-500 text-center py-8">
          Dados insuficientes para gráfico (mínimo 2 dias).
        </p>
      </BrandCard>
    );
  }

  return (
    <BrandCard
      title="Evolução no período"
      action={
        <div className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          {(Object.entries(metricLabels) as [Metric, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                metric === key
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-black/5" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#e2e8f0" />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} stroke="#e2e8f0" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }}
            formatter={(v: number) => formatBRL(v)}
            labelFormatter={(_, payload) => {
              if (payload?.[0]?.payload?.date) {
                const d = payload[0].payload;
                return `${d.label}${d.isToday ? " (Parcial)" : ""}`;
              }
              return "";
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey={metric}
            name={metricLabels[metric]}
            stroke="#0f172a"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0f172a" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </BrandCard>
  );
}
