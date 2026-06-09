import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PeriodPreset } from "./financeiroHelpers";

interface Props {
  preset: PeriodPreset;
  customStart: Date | undefined;
  customEnd: Date | undefined;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomRange: (start: Date | undefined, end: Date | undefined) => void;
}

const presets: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

export default function FinanceiroPeriodFilter({ preset, customStart, customEnd, onPresetChange, onCustomRange }: Props) {
  const [calOpen, setCalOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              onPresetChange(p.value);
              if (p.value !== "custom") onCustomRange(undefined, undefined);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition-colors whitespace-nowrap",
              preset === p.value
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-950"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 rounded-full border-black/5 bg-white">
              <CalendarIcon className="h-3.5 w-3.5" />
              {customStart && customEnd
                ? `${format(customStart, "dd/MM", { locale: ptBR })} – ${format(customEnd, "dd/MM", { locale: ptBR })}`
                : "Selecionar datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={customStart && customEnd ? { from: customStart, to: customEnd } : undefined}
              onSelect={(range) => {
                onCustomRange(range?.from, range?.to);
                if (range?.from && range?.to) setCalOpen(false);
              }}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
