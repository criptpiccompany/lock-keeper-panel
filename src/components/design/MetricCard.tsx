import { type ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="metric-kicker">{label}</p>
          <p className="metric-value">{value}</p>
        </div>
        {icon ? <div className="icon-badge">{icon}</div> : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
