import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface ListRow {
  id: string;
  influencer_id: string;
  influencer_handle: string;
  email_afiliado: string;
  link_1: string;
  link_2: string;
  link_3: string;
  valor_total: number;
  observacoes: string;
}

interface CloserProfile {
  id: string;
  nome: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export default function ListaDoMes() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string>("");

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch closers
  useEffect(() => {
    const fetchClosers = async () => {
      if (!user) return;
      if (isAdmin) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .order("nome");
        setClosers((data as CloserProfile[]) || []);
        if (!selectedCloserId && data && data.length > 0) {
          setSelectedCloserId(data[0].id);
        }
      } else {
        setClosers([{ id: user.id, nome: user.nome }]);
        setSelectedCloserId(user.id);
      }
    };
    fetchClosers();
  }, [user, isAdmin]);

  // Sync influencers from daily records and load list
  useEffect(() => {
    const loadData = async () => {
      if (!selectedCloserId || !selectedMonth) return;
      setLoading(true);

      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, "0")}`;

      // 1. Get distinct influencers from daily records for this month
      const { data: dailyRecords } = await supabase
        .from("daily_influencer_records")
        .select("influencer_id")
        .eq("closer_id", selectedCloserId)
        .gte("date", startDate)
        .lte("date", endDateStr)
        .is("deleted_at", null);

      const uniqueInfluencerIds = [
        ...new Set((dailyRecords || []).map((r) => r.influencer_id)),
      ];

      if (uniqueInfluencerIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2. Get influencer handles
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, handle")
        .in("id", uniqueInfluencerIds);

      const handleMap = new Map(
        (influencers || []).map((i) => [i.id, i.handle])
      );

      // 3. Get existing list rows
      const { data: existingRows } = await supabase
        .from("monthly_influencer_list")
        .select("*")
        .eq("closer_id", selectedCloserId)
        .eq("month", selectedMonth);

      const existingMap = new Map(
        (existingRows || []).map((r: any) => [r.influencer_id, r])
      );

      // 4. Upsert missing influencers
      const toInsert: any[] = [];
      for (const infId of uniqueInfluencerIds) {
        if (!existingMap.has(infId)) {
          toInsert.push({
            month: selectedMonth,
            closer_id: selectedCloserId,
            influencer_id: infId,
            influencer_handle: handleMap.get(infId) || "???",
          });
        }
      }

      if (toInsert.length > 0) {
        await supabase.from("monthly_influencer_list").insert(toInsert);
      }

      // 5. Re-fetch all rows for this month/closer
      const { data: finalRows } = await supabase
        .from("monthly_influencer_list")
        .select("*")
        .eq("closer_id", selectedCloserId)
        .eq("month", selectedMonth)
        .order("influencer_handle", { ascending: true });

      setRows(
        (finalRows || []).map((r: any) => ({
          id: r.id,
          influencer_id: r.influencer_id,
          influencer_handle: r.influencer_handle,
          email_afiliado: r.email_afiliado || "",
          link_1: r.link_1 || "",
          link_2: r.link_2 || "",
          link_3: r.link_3 || "",
          valor_total: Number(r.valor_total) || 0,
          observacoes: r.observacoes || "",
        }))
      );
      setLoading(false);
    };
    loadData();
  }, [selectedCloserId, selectedMonth]);

  const totalMes = useMemo(
    () => rows.reduce((sum, r) => sum + r.valor_total, 0),
    [rows]
  );

  // Inline field update with debounced save
  const updateField = useCallback(
    async (rowId: string, field: string, value: string | number) => {
      // Optimistic update
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
      );

      const updatePayload: Record<string, any> = { [field]: value };
      const { error } = await supabase
        .from("monthly_influencer_list")
        .update(updatePayload)
        .eq("id", rowId);

      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
      }
    },
    []
  );

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && closers.length > 1 && (
          <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Selecionar closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Nenhum influenciador registrado neste mês.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-foreground" style={{ backgroundColor: '#E9E9EA' }}>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Influenciador
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Email afiliado
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Link 1
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Link 2
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Link 3
                  </th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Valor total
                  </th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs tracking-wide uppercase">
                    Obs
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border/20 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}
                  >
                    <td className="py-2 px-4 text-xs font-medium whitespace-nowrap">
                      {row.influencer_handle}
                    </td>
                    <EditableCell
                      value={row.email_afiliado}
                      onChange={(v) => updateField(row.id, "email_afiliado", v)}
                      placeholder="email@..."
                    />
                    <EditableCell
                      value={row.link_1}
                      onChange={(v) => updateField(row.id, "link_1", v)}
                      placeholder="—"
                    />
                    <EditableCell
                      value={row.link_2}
                      onChange={(v) => updateField(row.id, "link_2", v)}
                      placeholder="—"
                    />
                    <EditableCell
                      value={row.link_3}
                      onChange={(v) => updateField(row.id, "link_3", v)}
                      placeholder="—"
                    />
                    <td className="py-1.5 px-2">
                      <Input
                        type="number"
                        className="h-7 text-xs text-right tabular-nums w-28 ml-auto"
                        value={row.valor_total || ""}
                        placeholder="0,00"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateField(row.id, "valor_total", val);
                        }}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateField(row.id, "valor_total", val);
                        }}
                      />
                    </td>
                    <EditableCell
                      value={row.observacoes}
                      onChange={(v) => updateField(row.id, "observacoes", v)}
                      placeholder="—"
                    />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className="border-t border-border/60 font-semibold text-foreground"
                  style={{ backgroundColor: "#E9E9EA" }}
                >
                  <td className="py-3 px-4 text-xs" colSpan={5}>
                    Total do mês
                  </td>
                  <td className="py-3 px-4 text-xs text-right tabular-nums">
                    {formatBRL(totalMes)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Inline editable text cell ---

function EditableCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <td className="py-1.5 px-2">
      <Input
        className="h-7 text-xs w-full min-w-[100px]"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) {
            onChange(local);
          }
        }}
      />
    </td>
  );
}
