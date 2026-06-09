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
