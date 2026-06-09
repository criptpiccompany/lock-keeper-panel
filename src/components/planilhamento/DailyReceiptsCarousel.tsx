import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Plus, X, Loader2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ComprovanteThumbnail from "./ComprovanteThumbnail";
import ComprovanteLightbox from "./ComprovanteLightbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

interface InfluencerLine {
  recordId: string;
  handle: string;
}

interface ReceiptRow {
  id: string;
  file_url: string;
  file_type: string | null;
  daily_record_id: string | null;
  created_at: string;
  closer_id: string;
  parsed_data?: any;
  parse_status?: string | null;
}

interface LegacyReceipt {
  id: string;          // synthetic
  file_url: string;
  daily_record_id: string;
  handle?: string;
}

interface Props {
  date: string;
  closerId: string;
  teamId?: string | null;
  canEdit?: boolean;
  influencerLines?: InfluencerLine[];      // for "marcar influenciador"
  legacyReceipts?: LegacyReceipt[];         // old comprovante_url from daily_influencer_records
  compact?: boolean;
  requireFocus?: boolean;                   // when true, paste only triggers if this carousel is focused
}

export default function DailyReceiptsCarousel({
  date, closerId, teamId, canEdit = true, influencerLines = [], legacyReceipts = [], compact = false, requireFocus = false,
}: Props) {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [tagOpenFor, setTagOpenFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const fetchReceipts = useCallback(async () => {
    if (!closerId || !date) return;
    const { data, error } = await supabase
      .from("daily_receipt_uploads")
      .select("id, file_url, file_type, daily_record_id, created_at, closer_id, deleted_at, parsed_data, parse_status")
      .eq("date", date)
      .eq("closer_id", closerId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[DailyReceiptsCarousel] fetch error:", error);
    } else {
      // Filter out soft-deleted client-side so SELECT policy can stay open enough
      // for PostgREST to return the row right after a soft-delete update.
      setReceipts(((data as any[]) || []).filter((r) => !r.deleted_at));
    }
    setLoading(false);
  }, [closerId, date]);

  useEffect(() => {
    setLoading(true);
    fetchReceipts();
  }, [fetchReceipts]);

  // Realtime
  useEffect(() => {
    if (!closerId || !date) return;
    const channel = supabase
      .channel(`receipts-${closerId}-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_receipt_uploads", filter: `closer_id=eq.${closerId}` },
        (payload: any) => {
          const row = (payload.new || payload.old) as ReceiptRow;
          if (!row || row.closer_id !== closerId) return;
          // Filter by date manually (filter only supports one)
          const rowDate = (payload.new?.date || payload.old?.date) as string | undefined;
          if (rowDate !== date) return;
          fetchReceipts();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [closerId, date, fetchReceipts]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const teamSlug = teamId || "unknown";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `daily-receipts/${teamSlug}/${closerId}/${date}/${fileName}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file, {
          cacheControl: "3600", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        const fileType = file.type === "application/pdf" ? "pdf" : "image";
        const { data: inserted, error: insErr } = await supabase.from("daily_receipt_uploads").insert({
          date, closer_id: closerId, daily_record_id: null,
          file_url: urlData.publicUrl, file_type: fileType, uploaded_by: user.id,
        } as any).select("id").single();
        if (insErr) throw insErr;
        // Fire-and-forget IA parse
        if (inserted?.id && fileType === "image") {
          supabase.functions.invoke("parse-receipt", { body: { receiptId: inserted.id } })
            .catch((e) => console.warn("parse-receipt invoke fail:", e));
        }
      }
      toast.success(list.length > 1 ? `${list.length} comprovantes enviados` : "Comprovante enviado");
      fetchReceipts();
    } catch (err: any) {
      console.error("[DailyReceiptsCarousel] upload error:", err);
      toast.error("Erro ao enviar comprovante", { description: err?.message });
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  // Paste support when carousel is in viewport (and focused, if scoped)
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: ClipboardEvent) => {
      if (!carouselRef.current) return;
      if (requireFocus) {
        const active = document.activeElement;
        if (!active || !carouselRef.current.contains(active)) return;
      } else {
        const rect = carouselRef.current.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && (it.type.startsWith("image/") || it.type === "application/pdf")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); handleFiles(files); }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [canEdit, closerId, date, requireFocus]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Remover este comprovante?")) return;
    const { error } = await supabase
      .from("daily_receipt_uploads")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao remover", { description: error.message });
    } else {
      toast.success("Comprovante removido");
      fetchReceipts();
    }
  };

  const handleTagInfluencer = async (receiptId: string, recordId: string | null) => {
    const { error } = await supabase
      .from("daily_receipt_uploads")
      .update({ daily_record_id: recordId } as any)
      .eq("id", receiptId);
    if (error) {
      toast.error("Erro ao marcar", { description: error.message });
    } else {
      toast.success(recordId ? "Influenciador marcado" : "Marcação removida");
      setTagOpenFor(null);
      fetchReceipts();
    }
  };

  const allItems = useMemo(() => {
    const items: Array<{ kind: "receipt" | "legacy"; id: string; url: string; tagHandle?: string; receiptId?: string; parsedData?: any; parseStatus?: string | null }> = [];
    receipts.forEach((r) => {
      const linked = influencerLines.find((l) => l.recordId === r.daily_record_id);
      items.push({ kind: "receipt", id: r.id, url: r.file_url, tagHandle: linked?.handle, receiptId: r.id, parsedData: r.parsed_data, parseStatus: r.parse_status });
    });
    legacyReceipts.forEach((l) => {
      items.push({ kind: "legacy", id: `legacy-${l.id}`, url: l.file_url, tagHandle: l.handle });
    });
    return items;
  }, [receipts, legacyReceipts, influencerLines]);

  const [lightboxParsed, setLightboxParsed] = useState<any>(null);

  return (
    <div
      ref={carouselRef}
      tabIndex={requireFocus ? 0 : -1}
      className={cn(
        "rounded-2xl border bg-white/60 backdrop-blur-sm px-4 pt-4 pb-5 outline-none",
        compact ? "" : "mt-4",
        requireFocus && "focus-within:border-[#6ea93d] focus-within:bg-white"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-[#2c2c2c]">Comprovantes do dia</h4>
          <span className="text-[11px] text-muted-foreground">{allItems.length}</span>
        </div>
        {canEdit && (
          <p className="hidden sm:block text-[11px] text-muted-foreground">
            {requireFocus ? "Clique aqui e cole (Ctrl+V), arraste ou use +" : "Arraste, cole (Ctrl+V) ou clique em +"}
          </p>
        )}
      </div>

      <div
        className="flex items-start gap-4 overflow-x-auto pt-3 pb-2 -mx-1 px-1 scroll-smooth"
        onDragOver={(e) => { if (canEdit) { e.preventDefault(); } }}
        onDrop={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 inline-flex flex-col items-center justify-center w-[104px] h-[104px] rounded-2xl border-2 border-dashed border-[#d8d6cf] bg-white hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
            title="Adicionar comprovante"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Plus className="h-6 w-6 text-muted-foreground" />}
            <span className="text-[11px] text-muted-foreground mt-1">Adicionar</span>
          </button>
        )}

        {loading ? (
          <span className="text-xs text-muted-foreground px-2">Carregando…</span>
        ) : allItems.length === 0 && !canEdit ? (
          <span className="text-xs text-muted-foreground px-2">Nenhum comprovante</span>
        ) : (
          allItems.map((it) => (
            <div key={it.id} className="shrink-0 flex flex-col items-center gap-1.5">
              <div className="relative group">
                <div className="w-[104px] h-[104px] rounded-2xl overflow-hidden ring-1 ring-black/5 bg-white flex items-center justify-center">
                  <ComprovanteThumbnail
                    url={it.url}
                    onClick={async () => {
                      const path = it.url.split("/comprovantes/")[1];
                      if (path) {
                        const { data } = await supabase.storage.from("comprovantes").createSignedUrl(path, 600);
                        setLightboxUrl(data?.signedUrl || it.url);
                      } else {
                        setLightboxUrl(it.url);
                      }
                      setLightboxParsed(it.parsedData || null);
                      setLightboxOpen(true);
                    }}
                  />
                </div>
                {it.tagHandle && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 max-w-[80px] truncate rounded-full bg-foreground text-background text-[9px] px-1.5 py-0.5 font-medium">
                    {it.tagHandle}
                  </div>
                )}
                {canEdit && it.kind === "receipt" && it.receiptId && (
                  <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {influencerLines.length > 0 && (
                      <Popover open={tagOpenFor === it.receiptId} onOpenChange={(o) => setTagOpenFor(o ? it.receiptId! : null)}>
                        <PopoverTrigger asChild>
                          <button
                            className="h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm"
                            title="Marcar influenciador"
                          >
                            <Tag className="h-2.5 w-2.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1 px-1">Marcar influenciador</p>
                          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                            <button
                              onClick={() => handleTagInfluencer(it.receiptId!, null)}
                              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted text-muted-foreground"
                            >
                              — Sem marcação
                            </button>
                            {influencerLines.map((l) => (
                              <button
                                key={l.recordId}
                                onClick={() => handleTagInfluencer(it.receiptId!, l.recordId)}
                                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted"
                              >
                                {l.handle}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <button
                      onClick={() => handleDelete(it.receiptId!)}
                      className="h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                      title="Remover"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
              {/* Dados extraídos pela IA */}
              {it.kind === "receipt" && (
                <div className="w-[140px] text-center leading-tight mt-1">
                  {it.parseStatus === "processing" || (!it.parsedData && it.parseStatus !== "error" && it.parseStatus !== "unsupported" && it.parseStatus !== "done") ? (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> lendo…
                    </span>
                  ) : it.parsedData ? (
                    <div className="space-y-0.5">
                      {it.parsedData.manual_influencer && (
                        <div className="font-semibold text-[13px] tracking-[-0.01em] text-[#1f1f1f] truncate" title={it.parsedData.manual_influencer}>
                          {it.parsedData.manual_influencer}
                        </div>
                      )}
                      {it.parsedData.valor && (
                        <div className="font-semibold text-[12.5px] text-[#2c2c2c]">R$ {it.parsedData.valor}</div>
                      )}
                      {it.parsedData.destinatario && (
                        <div className="truncate text-[11px] text-muted-foreground" title={it.parsedData.destinatario}>
                          {it.parsedData.destinatario}
                        </div>
                      )}
                    </div>
                  ) : it.parseStatus === "error" ? (
                    <span className="text-[11px] text-red-500/70">falha leitura</span>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={onInputChange} />
      <ComprovanteLightbox open={lightboxOpen} url={lightboxUrl} parsedData={lightboxParsed} onClose={() => setLightboxOpen(false)} />
    </div>
  );
}
