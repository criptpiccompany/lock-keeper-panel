import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, X, ImageIcon, User as UserIcon } from "lucide-react";

interface Closer { id: string; nome: string; team_id: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  closers: Closer[];
  defaultCloserId?: string;
  date: string;
  onCreated?: (closerId: string) => void;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

export default function QuickAddReceiptModal({ open, onClose, closers, defaultCloserId, date, onCreated }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [closerId, setCloserId] = useState<string>(defaultCloserId || "");
  const [influencer, setInfluencer] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null); setPreview(null); setInfluencer("");
      setCloserId(defaultCloserId || closers[0]?.id || "");
    }
  }, [open, defaultCloserId, closers]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (file.type === "application/pdf") { setPreview("pdf"); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Paste handler when modal open
  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
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
  }, [open]);

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
      const { data: inserted, error: insErr } = await supabase.from("daily_receipt_uploads").insert({
        date, closer_id: closerId, daily_record_id: null,
        file_url: urlData.publicUrl, file_type: fileType, uploaded_by: user.id,
        parsed_data: { destinatario: `@${handle}`, manual: true } as any,
        parse_status: "done",
        parsed_at: new Date().toISOString(),
      } as any).select("id").single();
      if (insErr) throw insErr;
      toast.success("Comprovante adicionado");
      onCreated?.(closerId);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#1f1f1f]">
            Adicionar comprovante
          </DialogTitle>
          <p className="text-[12.5px] text-[#676767]">
            Cole (Ctrl+V), arraste ou clique para anexar. Selecione o closer e o influenciador.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Drop / paste area */}
          <div
            ref={dropRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0];
              if (f) setFile(f);
            }}
            onClick={() => !file && fileRef.current?.click()}
            className="relative rounded-xl border-2 border-dashed border-[#e5e3dd] bg-[#fafaf8] hover:border-[#6ea93d] hover:bg-white transition-colors min-h-[180px] flex items-center justify-center cursor-pointer overflow-hidden"
          >
            {preview && preview !== "pdf" ? (
              <>
                <img src={preview} alt="preview" className="max-h-[220px] object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 border border-[#ececeb] flex items-center justify-center hover:bg-white"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : preview === "pdf" ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <ImageIcon className="h-8 w-8 text-[#999]" />
                <p className="text-[13px] font-medium text-[#1f1f1f]">{file?.name}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[11px] text-[#999] underline">
                  Remover
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#999]">
                <Upload className="h-7 w-7" />
                <p className="text-[13px] font-medium text-[#1f1f1f]">Cole, arraste ou clique aqui</p>
                <p className="text-[11px] text-[#999]">PNG, JPG, WEBP ou PDF</p>
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
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#999] mb-1.5 block">Closer</label>
            <div className="inline-flex w-full items-center gap-2 rounded-xl border border-[#ececeb] bg-white px-3 py-2.5">
              <UserIcon className="h-4 w-4 text-[#999]" />
              <select
                value={closerId}
                onChange={(e) => setCloserId(e.target.value)}
                className="flex-1 bg-transparent text-[13.5px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none"
              >
                <option value="">Selecione…</option>
                {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Influencer */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#999] mb-1.5 block">Influenciador</label>
            <div className="inline-flex w-full items-center gap-1 rounded-xl border border-[#ececeb] bg-white px-3 py-2.5">
              <span className="text-[#999] text-[14px]">@</span>
              <input
                value={influencer}
                onChange={(e) => setInfluencer(e.target.value.replace(/^@+/, ""))}
                placeholder="handle_do_influencer"
                className="flex-1 bg-transparent text-[13.5px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none placeholder:text-[#bbb]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || !file || !closerId || !influencer.trim()}
              className="bg-[#1f1f1f] text-white hover:bg-[#0d0d0d] rounded-full px-5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
