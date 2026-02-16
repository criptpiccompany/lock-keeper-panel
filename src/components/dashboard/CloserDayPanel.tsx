import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { ADMIN_TAX_TOTAL_RATE } from "@/lib/constants";

interface DailyRecord {
  id: string;
  date: string;
  influencer_id: string;
  valor_pago: number;
  faturamento: number | null;
  status: string | null;
  observacao: string | null;
  influencer_handle?: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface CloserDayPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closerId: string;
  closerNome: string;
  date: string;
}

export default function CloserDayPanel({
  open,
  onOpenChange,
  closerId,
  closerNome,
  date,
}: CloserDayPanelProps) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  useEffect(() => {
    if (!open || !closerId || !date) return;
    setLoading(true);

    const fetch = async () => {
      const { data } = await supabase
        .from("daily_influencer_records")
        .select("id, date, influencer_id, valor_pago, faturamento, status, observacao")
        .eq("closer_id", closerId)
        .eq("date", date)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      const recs = (data as any as DailyRecord[]) || [];

      // Fetch influencer handles
      if (recs.length > 0) {
        const ids = [...new Set(recs.map((r) => r.influencer_id))];
        const { data: infData } = await supabase
          .from("influencers")
          .select("id, handle")
          .in("id", ids);
        const handleMap = new Map((infData || []).map((i: any) => [i.id, i.handle]));
        recs.forEach((r) => {
          r.influencer_handle = handleMap.get(r.influencer_id) || r.influencer_id;
        });
      }

      setRecords(recs);
      setLoading(false);
    };
    fetch();
  }, [open, closerId, date]);

  const dateLabel = (() => {
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  })();

  const totals = records.reduce(
    (acc, r) => {
      acc.invested += Number(r.valor_pago) || 0;
      acc.revenue += Number(r.faturamento) || 0;
      return acc;
    },
    { invested: 0, revenue: 0 }
  );
  const tax = totals.revenue * ADMIN_TAX_TOTAL_RATE;
  const result = totals.revenue - totals.invested - tax;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{closerNome}</SheetTitle>
          <SheetDescription className="capitalize">{dateLabel}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhum registro neste dia.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] text-muted-foreground">Investido</p>
                <p className="text-sm font-semibold tabular-nums">{formatBRL(totals.invested)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] text-muted-foreground">Faturado</p>
                <p className="text-sm font-semibold tabular-nums">{formatBRL(totals.revenue)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] text-muted-foreground">Resultado</p>
                <p className={`text-sm font-semibold tabular-nums ${result < 0 ? "text-red-600" : result > 0 ? "text-emerald-700" : ""}`}>
                  {formatBRL(result)}
                </p>
              </div>
            </div>

            {/* Records table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase">Influenciador</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase">Investido</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase">Faturado</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold uppercase">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const inv = Number(r.valor_pago) || 0;
                    const rev = Number(r.faturamento) || 0;
                    const t = rev * ADMIN_TAX_TOTAL_RATE;
                    const res = rev - inv - t;
                    return (
                      <tr key={r.id} className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
                        <td className="py-2 px-3 text-xs font-medium">{r.influencer_handle}</td>
                        <td className="py-2 px-3 text-xs text-right tabular-nums">{formatBRL(inv)}</td>
                        <td className="py-2 px-3 text-xs text-right tabular-nums">{formatBRL(rev)}</td>
                        <td className={`py-2 px-3 text-xs text-right tabular-nums font-medium ${res < 0 ? "text-red-600" : res > 0 ? "text-emerald-700" : ""}`}>
                          {formatBRL(res)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-foreground" style={{ backgroundColor: "#E9E9EA" }}>
                    <td className="py-2 px-3 text-xs">Total</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums">{formatBRL(totals.invested)}</td>
                    <td className="py-2 px-3 text-xs text-right tabular-nums">{formatBRL(totals.revenue)}</td>
                    <td className={`py-2 px-3 text-xs text-right tabular-nums ${result < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {formatBRL(result)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
