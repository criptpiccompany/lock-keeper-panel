import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, User as UserIcon, ClipboardPaste } from "lucide-react";

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

  const handlePasteClick = async () => {
    try {
      // @ts-ignore
      if (!navigator.clipboard?.read) {
        toast.error("Navegador não suporta colar imagem", { description: "Use Ctrl+V" });
        return;
      }
      // @ts-ignore
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t: string) => t.startsWith("image/") || t === "application/pdf");
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split("/")[1] || "png";
          const f = new File([blob], `colado-${Date.now()}.${ext}`, { type: imgType });
          setFile(f);
          toast.success("Imagem colada");
          return;
        }
      }
      toast.error("Nenhuma imagem na área de transferência");
    } catch (err: any) {
      toast.error("Não foi possível colar", { description: err?.message || "Permita o acesso à área de transferência" });
    }
  };

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
        parsed_data: { manual_influencer: `@${handle}` } as any,
        parse_status: "processing",
      } as any).select("id").single();
      if (insErr) throw insErr;
      // Trigger AI parse (fire and forget)
      if (inserted?.id && fileType === "image") {
        supabase.functions.invoke("parse-receipt", { body: { receiptId: inserted.id } })
          .catch((e) => console.warn("parse-receipt invoke fail:", e));
      }
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
      <div className="flex items-end justify-between gap-4 mb-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#1f1f1f]/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6ea93d]" />
            Adicionar comprovante
          </div>
          <h2 className="text-[28px] leading-[1.05] font-semibold tracking-[-0.03em] text-[#1f1f1f]">
            Anexe um comprovante <span className="text-[#cfcfce]">em segundos.</span>
          </h2>
        </div>
        <p className="hidden md:block text-right text-[12.5px] leading-snug text-[#676767] max-w-[280px]">
          Cole (Ctrl+V), arraste ou clique. Escolha o closer e o influenciador, então confirme.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Drop area */}
        <div className="col-span-12 md:col-span-4">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#1f1f1f]/70 mb-2 block">Comprovante</label>
          <div className="flex items-stretch gap-2">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) setFile(f); }}
              onClick={() => !file && fileRef.current?.click()}
              className="flex-1 group relative rounded-2xl border-2 border-dashed border-[#e5e3dd] bg-[#fafaf8] hover:border-[#1f1f1f]/40 hover:bg-white transition-all h-[52px] flex items-center justify-center cursor-pointer overflow-hidden"
            >
              {preview && preview !== "pdf" ? (
                <>
                  <img src={preview} alt="preview" className="max-h-[48px] object-contain" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/90 border border-[#ececeb] flex items-center justify-center hover:bg-white"
                    title="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : preview === "pdf" ? (
                <div className="flex items-center gap-2 px-3">
                  <FileText className="h-4 w-4 text-[#676767]" />
                  <span className="text-[12.5px] font-medium text-[#1f1f1f] truncate max-w-[140px]">{file?.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[10px] text-[#999] underline ml-1">remover</button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-[#676767] px-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#1f1f1f] text-white shadow-sm group-hover:scale-105 transition-transform shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <p className="text-[12px] font-semibold tracking-[-0.01em] text-[#1f1f1f]">Arraste ou clique</p>
                    <p className="text-[10px] text-[#999]">PNG · JPG · WEBP · PDF</p>
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
            <button
              type="button"
              onClick={handlePasteClick}
              title="Colar imagem da área de transferência"
              className="shrink-0 h-[52px] px-3 rounded-2xl border border-[#ececeb] bg-white hover:bg-[#fafaf8] hover:border-[#1f1f1f]/40 transition-colors flex items-center gap-1.5 text-[#1f1f1f]"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em]">Colar</span>
            </button>
          </div>
        </div>


        {/* Closer */}
        <div className="col-span-6 md:col-span-3">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#1f1f1f]/70 mb-2 block">Closer</label>
          <Select value={closerId} onValueChange={setCloserId}>
            <SelectTrigger className="h-[52px] w-full rounded-2xl border border-[#ececeb] bg-white px-3.5 text-[14px] font-medium tracking-[-0.01em] text-[#1f1f1f] focus:ring-0 focus:ring-offset-0 data-[state=open]:border-[#1f1f1f]/40 hover:border-[#1f1f1f]/30 transition-colors [&>span]:flex [&>span]:items-center [&>span]:gap-2">
              <SelectValue
                placeholder={
                  <span className="flex items-center gap-2 text-[#999]">
                    <UserIcon className="h-4 w-4" />
                    Selecione…
                  </span>
                }
              >
                {closerId ? (
                  <span className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[linear-gradient(180deg,#1f1f1f_0%,#0d0d0d_100%)] text-white text-[10px] font-semibold uppercase">
                      {closers.find((c) => c.id === closerId)?.nome?.[0]}
                    </span>
                    {closers.find((c) => c.id === closerId)?.nome}
                  </span>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border border-[#ececeb] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] p-1.5">
              {closers.map((c) => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                  className="rounded-xl px-2.5 py-2.5 text-[13.5px] font-medium tracking-[-0.01em] text-[#1f1f1f] focus:bg-[#fafaf8] data-[state=checked]:bg-[#f4f2ec]"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(180deg,#1f1f1f_0%,#0d0d0d_100%)] text-white text-[11px] font-semibold uppercase">
                      {c.nome?.[0]}
                    </span>
                    {c.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Influencer */}
        <div className="col-span-6 md:col-span-3">
          <label className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#1f1f1f]/70 mb-2 block">Influenciador</label>
          <div className="flex h-[52px] w-full items-center gap-1.5 rounded-2xl border border-[#ececeb] bg-white px-3.5 focus-within:border-[#1f1f1f]/40 transition-colors">
            <span className="text-[#999] text-[15px]">@</span>
            <input
              value={influencer}
              onChange={(e) => setInfluencer(e.target.value.replace(/^@+/, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              placeholder="handle"
              className="flex-1 min-w-0 bg-transparent text-[14px] font-medium tracking-[-0.01em] text-[#1f1f1f] outline-none placeholder:text-[#bbb]"
            />
          </div>
        </div>

        {/* Confirm */}
        <div className="col-span-12 md:col-span-2">
          <Button
            onClick={handleConfirm}
            disabled={saving || !file || !closerId || !influencer.trim()}
            className="w-full rounded-2xl h-[52px] text-[13px] font-semibold tracking-[-0.01em] bg-[linear-gradient(180deg,#1f1f1f_0%,#0d0d0d_100%)] text-white hover:opacity-95 disabled:bg-[#e5e3dd] disabled:bg-none disabled:text-[#bbb] shadow-[0_6px_14px_rgba(15,23,42,0.18)] disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

