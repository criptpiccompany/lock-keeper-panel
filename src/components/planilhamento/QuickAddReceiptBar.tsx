import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, User as UserIcon } from "lucide-react";

interface Closer { id: string; nome: string; team_id: string | null }

interface Props {
  closers: Closer[];
  date: string;
  onCreated?: (closerId: string) => void;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

export default function QuickAddReceiptBar({ closers, date, onCreated }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [closerId, setCloserId] = useState<string>("");
  const [influencer, setInfluencer] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (file.type === "application/pdf") { setPreview("pdf"); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Paste handler — captures global paste when focus is inside this bar
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!dropRef.current) return;
      const active = document.activeElement;
      const inside = active && dropRef.current.contains(active);
      // Always accept if no other contentEditable / input is focused on the page
      const isOtherInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") && !inside;
      if (isOtherInput) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && (it.type.startsWith("image/") || it.type === "application/pdf")) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); setFile(f); return; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  const reset = () => { setFile(null); setInfluencer(""); };

  const handleConfirm = async () => {
    if (!user) return;
    if (!file) return toast.error("Adicione um comprovante");
    if (!closerId) return toast.error("Selecione um closer");
    if (!influencer.trim()) return toast.error("Digite o influenciador");
    setSaving(true);
    try {
      const closer = closers.find((c) => c.id === closerId);
      const teamSlug = closer?.team_id || "unknown";
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `daily-receipts/${teamSlug}/${closerId}/${date}/${fileName}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
      const fileType = file.type === "application/pdf" ? "pdf" : "image";
      const handle = influencer.trim().replace(/^@+/, "");
      const { error: insErr } = await supabase.from("daily_receipt_uploads").insert({
        date, closer_id: closerId, daily_record_id: null,
        file_url: urlData.publicUrl, file_type: fileType, uploaded_by: user.id,
        parsed_data: { destinatario: `@${handle}`, manual: true } as any,
        parse_status: "done",
        parsed_at: new Date().toISOString(),
      } as any);
      if (insErr) throw insErr;
      toast.success("Comprovante adicionado");
      onCreated?.(closerId);
      reset();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={dropRef}
      className="rounded-[22px] border border-[#ececeb] bg-white/95 backdrop-blur-md p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#999]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6ea93d]" />
            Adicionar comprovante
          </div>
          <h2 className="text-[22px] leading-[1.05] font-semibold tracking-[-0.03em] text-[#1f1f1f]">
            Anexe um comprovante <span className="text-[#cfcfce]">em segundos.</span>
          </h2>
        </div>
        <p className="hidden md:block text-right text-[11.5px] leading-snug text-[#999] max-w-[260px]">
          Cole (Ctrl+V), arraste ou clique. Escolha o closer e o influenciador, então confirme.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3 items-stretch">
        {/* Drop area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) setFile(f); }}
          onClick={() => !file && fileRef.current?.click()}
          className="col-span-12 md:col-span-4 group relative rounded-2xl border-2 border-dashed border-[#e5e3dd] bg-[#fafaf8] hover:border-[#1f1f1f]/40 hover:bg-white transition-all min-h-[100px] flex items-center justify-center cursor-pointer overflow-hidden"
        >
          {preview && preview !== "pdf" ? (
            <>
              <img src={preview} alt="preview" className="max-h-[96px] object-contain" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-white/90 border border-[#ececeb] flex items-center justify-center hover:bg-white"
                title="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : preview === "pdf" ? (
            <div className="flex items-center gap-2 px-3">
              <FileText className="h-5 w-5 text-[#676767]" />
              <span className="text-[12.5px] font-medium text-[#1f1f1f] truncate max-w-[160px]">{file?.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[10px] text-[#999] underline ml-1">remover</button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-[#676767]">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1f1f1f] text-white shadow-sm group-hover:scale-105 transition-transform">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col leading-tight">
                <p className="text-[12.5px] font-semibold tracking-[-0.01em] text-[#1f1f1f]">Cole, arraste ou clique</p>
                <p className="text-[10.5px] text-[#999]">PNG · JPG · WEBP · PDF</p>
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }}
          />
        </div>

        {/* Closer */}
        <div className="col-span-6 md:col-span-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#999] mb-1.5 block">Closer</label>
          <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-[#ececeb] bg-white px-3.5 py-3 focus-within:border-[#1f1f1f]/40 transition-colors">
            <UserIcon className="h-4 w-4 text-[#999]" />
            <select
              value={closerId}
              onChange={(e) => setCloserId(e.target.value)}
              className="flex-1 bg-transparent text-[13.5px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none cursor-pointer"
            >
              <option value="">Selecione…</option>
              {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Influencer */}
        <div className="col-span-6 md:col-span-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#999] mb-1.5 block">Influenciador</label>
          <div className="inline-flex w-full items-center gap-1 rounded-2xl border border-[#ececeb] bg-white px-3.5 py-3 focus-within:border-[#1f1f1f]/40 transition-colors">
            <span className="text-[#999] text-[14px]">@</span>
            <input
              value={influencer}
              onChange={(e) => setInfluencer(e.target.value.replace(/^@+/, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              placeholder="handle"
              className="flex-1 min-w-0 bg-transparent text-[13.5px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none placeholder:text-[#bbb]"
            />
          </div>
        </div>

        {/* Confirm */}
        <div className="col-span-12 md:col-span-2 flex md:items-end">
          <Button
            onClick={handleConfirm}
            disabled={saving || !file || !closerId || !influencer.trim()}
            className="w-full rounded-2xl h-[48px] mt-0 md:mt-[22px] text-[13px] font-semibold tracking-[-0.01em] bg-[linear-gradient(180deg,#1f1f1f_0%,#0d0d0d_100%)] text-white hover:opacity-95 disabled:bg-[#e5e3dd] disabled:bg-none disabled:text-[#bbb] shadow-[0_6px_14px_rgba(15,23,42,0.18)] disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

