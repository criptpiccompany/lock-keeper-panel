import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { formatBRL, fmtShortDate, TAX_TOTAL, type DayAggregate } from "./financeiroHelpers";

type Metric = "cost" | "revenue" | "net";

interface Props {
  byDate: Map<string, DayAggregate>;
  today: string;
  filterStart: string;
  filterEnd: string;
}

const metricLabels: Record<Metric, string> = {
  cost: "Custo",
  revenue: "Faturamento Bruto",
  net: "Resultado Líquido",
};

export default function FinanceiroChart({ byDate, today, filterStart, filterEnd }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const data = useMemo(() => {
    const dates = Array.from(byDate.entries())
      .filter(([d]) => d >= filterStart && d <= filterEnd)
      .sort((a, b) => a[0].localeCompare(b[0]));

    return dates.map(([date, agg]) => {
      const net = agg.revenue - agg.revenue * TAX_TOTAL;
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
      <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground text-center py-8">
          Dados insuficientes para gráfico (mínimo 2 dias).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Evolução no Período</h3>
        <div className="flex gap-1">
          {(Object.entries(metricLabels) as [Metric, string][]).map(([key, label]) => (
            <Button key={key} size="sm" variant={metric === key ? "default" : "outline"} className="h-7 text-xs px-3" onClick={() => setMetric(key)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v: number) => formatBRL(v)}
            labelFormatter={(_, payload) => {
              if (payload?.[0]?.payload?.date) {
                const d = payload[0].payload;
                return `${d.label}${d.isToday ? " (Parcial)" : ""}`;
              }
              return "";
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={metric}
            name={metricLabels[metric]}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
