import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho premium da marca — usar em todas as páginas de visão admin.
 * Eyebrow uppercase + título grande tracking apertado + subtítulo discreto.
 * Fundo bege off-white quente (#F6F4F0) e respiração generosa.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  right,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b border-black/5 bg-[#F6F4F0]", className)}>
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl space-y-3">
            {eyebrow && (
              <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {eyebrow}
              </div>
            )}
            <h1 className="text-[36px] leading-[1.02] tracking-[-0.04em] text-slate-950 font-medium sm:text-[44px]">
              {title}
            </h1>
            {subtitle && (
              <p className="max-w-2xl text-[14px] leading-7 text-slate-500/90">
                {subtitle}
              </p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Classes para reaproveitar nos TabsList das páginas admin (pill premium). */
export const brandTabsListClass =
  "inline-flex h-auto items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-[0_1px_0_rgba(0,0,0,0.02)]";
export const brandTabsTriggerClass =
  "rounded-full px-4 py-1.5 text-[13px] font-medium text-slate-500 transition-colors data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm";

/** Card de superfície neutra premium (uso geral em conteúdo de página). */
export const brandSurfaceClass =
  "bg-white rounded-2xl border border-black/5 shadow-[0_1px_0_rgba(0,0,0,0.02)]";

/** Wrapper para tabelas: borda suave, cantos arredondados, overflow controlado. */
export const brandTableWrapClass =
  "bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.02)]";

type Tone = "neutral" | "amber" | "emerald" | "blue" | "violet" | "rose";

const toneMap: Record<Tone, { border: string; label: string; value: string; iconBg: string; iconFg: string }> = {
  neutral: { border: "border-black/5", label: "text-slate-500", value: "text-slate-950", iconBg: "bg-slate-100", iconFg: "text-slate-600" },
  amber:   { border: "border-amber-200/60", label: "text-amber-700", value: "text-amber-700", iconBg: "bg-amber-50", iconFg: "text-amber-600" },
  emerald: { border: "border-emerald-200/60", label: "text-emerald-700", value: "text-emerald-700", iconBg: "bg-emerald-50", iconFg: "text-emerald-600" },
  blue:    { border: "border-blue-200/60", label: "text-blue-700", value: "text-blue-700", iconBg: "bg-blue-50", iconFg: "text-blue-600" },
  violet:  { border: "border-violet-200/60", label: "text-violet-700", value: "text-violet-700", iconBg: "bg-violet-50", iconFg: "text-violet-600" },
  rose:    { border: "border-rose-200/60", label: "text-rose-700", value: "text-rose-700", iconBg: "bg-rose-50", iconFg: "text-rose-600" },
};

interface BrandStatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}

/** Hero-metric card — métrica em destaque, padrão da identidade. */
export function BrandStat({ label, value, hint, icon: Icon, tone = "neutral", className }: BrandStatProps) {
  const t = toneMap[tone];
  return (
    <div className={cn("bg-white rounded-2xl border p-4 sm:p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]", t.border, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[11px] uppercase tracking-[0.14em]", t.label)}>{label}</p>
        {Icon && (
          <div className={cn("grid h-7 w-7 place-items-center rounded-full", t.iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", t.iconFg)} />
          </div>
        )}
      </div>
      <p className={cn("mt-3 text-[28px] sm:text-3xl font-medium tracking-[-0.02em] tabular-nums", t.value)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500/90">{hint}</p>}
    </div>
  );
}

/** Card de seção branded — substitui o shadcn Card quando queremos visual premium. */
export function BrandCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(brandSurfaceClass, "p-5 sm:p-6", className)}>
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {title && (
              <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-slate-950">
                {Icon && <Icon className="h-4 w-4 text-slate-500" />}
                {title}
              </h3>
            )}
            {description && <p className="text-[13px] leading-6 text-slate-500/90">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
