import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Users, Link as LinkIcon, Check, X, AlertCircle, Loader2, Lock } from "lucide-react";
import { useInfluboardLocks } from "@/hooks/useInfluboardLocks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParseResult {
  handle: string;
  status: "pending" | "success" | "exists" | "locked" | "invalid";
  message?: string;
}

const extractHandle = (input: string): string | null => {
  let username = input.trim();
  const match = username.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/);
  if (match) username = match[1];
  else username = username.replace(/^@/, "");
  return username || null;
};

export function AddInfluencerUnifiedModal({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { data: influboard } = useInfluboardLocks();

  // Single side
  const [singleInput, setSingleInput] = useState("");
  const [singleError, setSingleError] = useState("");
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  // Bulk side
  const [bulkInput, setBulkInput] = useState("");
  const [results, setResults] = useState<ParseResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const reset = () => {
    setSingleInput("");
    setSingleError("");
    setBulkInput("");
    setResults([]);
    setShowResults(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  // Sincroniza com o Board Compartilhado (aba "Fechados") marcando este closer como fechador
  const syncToSharedBoard = async (handle: string, closerId: string) => {
    const username = handle.replace(/^@/, "").toLowerCase();
    if (!username) return;
    const { data: existing } = await supabase
      .from("team_shared_board")
      .select("id")
      .ilike("instagram_username", username)
      .eq("archived", false)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("team_shared_board")
        .update({ closed_by: closerId, status: "Positivo" } as never)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("team_shared_board").insert({
        created_by: closerId,
        instagram_username: username,
        display_name: username,
        instagram_url: `https://instagram.com/${username}`,
        status: "Positivo",
        closed_by: closerId,
      } as never);
    }
  };

  // ===== Single submit (accepts @handle OR url) =====
  const handleSingleSubmit = async () => {
    if (!user) return;
    const username = extractHandle(singleInput);
    if (!username || username.length < 2) {
      setSingleError("URL ou @ inválido");
      return;
    }
    const handle = `@${username.toLowerCase()}`;
    setSingleSubmitting(true);

    const { data: existing } = await supabase
      .from("influencers")
      .select("id")
      .eq("handle", handle)
      .maybeSingle();

    if (existing) {
      setSingleError("Este influenciador já existe");
      setSingleSubmitting(false);
      return;
    }

    const { error } = await supabase.from("influencers").insert({
      handle,
      owner_id: user.id,
      owner_nome: user.nome,
      ativo: true,
    });

    if (error) {
      toast.error("Erro ao adicionar influenciador");
      setSingleSubmitting(false);
      return;
    }

    toast.success("Influenciador adicionado!", { description: `${handle} foi adicionado ao seu painel.` });
    await syncToSharedBoard(handle, user.id);
    setSingleInput("");
    setSingleError("");
    setSingleSubmitting(false);
    onSuccess?.();
    close();
  };

  // ===== Bulk =====
  const parseHandles = (text: string): string[] => {
    const parts = text.split(/[\n,\s]+/).filter(Boolean);
    const handles = parts.map((part) => {
      const u = extractHandle(part);
      if (!u) return null;
      return `@${u.toLowerCase()}`;
    }).filter(Boolean) as string[];
    return [...new Set(handles)];
  };

  const validateHandle = (h: string) => /^@[a-z0-9_\.]{2,}$/i.test(h);

  const handleVerify = async () => {
    if (!user) return;
    const handles = parseHandles(bulkInput);
    if (handles.length === 0) {
      toast.error("Nenhum handle válido encontrado");
      return;
    }
    setBulkProcessing(true);
    const newResults: ParseResult[] = [];
    for (const handle of handles) {
      if (!validateHandle(handle)) {
        newResults.push({ handle, status: "invalid", message: "Formato inválido" });
        continue;
      }
      const { data: existing } = await supabase
        .from("influencers")
        .select("id, owner_id, owner_nome, last_closed_at")
        .eq("handle", handle)
        .maybeSingle();

      if (existing) {
        if (existing.owner_id === user.id) {
          newResults.push({ handle, status: "exists", message: "Já está na sua lista" });
          continue;
        }
        if (existing.last_closed_at) {
          const lockedUntil = new Date(new Date(existing.last_closed_at).getTime() + 10 * 24 * 60 * 60 * 1000);
          if (new Date() < lockedUntil) {
            newResults.push({ handle, status: "locked", message: `Travado por ${existing.owner_nome || "outro"}` });
            continue;
          }
        }
        newResults.push({ handle, status: "pending", message: "Liberado - será registrado fechamento" });
      } else {
        newResults.push({ handle, status: "pending", message: "Novo - será adicionado" });
      }
    }
    setResults(newResults);
    setShowResults(true);
    setBulkProcessing(false);
  };

  const handleConfirmBulk = async () => {
    if (!user) return;
    setBulkProcessing(true);
    const pending = results.filter((r) => r.status === "pending");
    let ok = 0, err = 0;
    for (const item of pending) {
      const { data: existing } = await supabase
        .from("influencers")
        .select("id")
        .eq("handle", item.handle)
        .maybeSingle();
      if (existing) {
        const now = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("influencers")
          .update({ owner_id: user.id, owner_nome: user.nome, last_closed_at: now })
          .eq("id", existing.id);
        if (updErr) { err++; continue; }
        await supabase.from("close_events").insert({
          influencer_id: existing.id,
          influencer_handle: item.handle,
          feito_por_id: user.id,
          feito_por_nome: user.nome,
          feito_em: now,
          acao: "FECHAMENTO",
        });
        await syncToSharedBoard(item.handle, user.id);
        ok++;
      } else {
        const { error: insErr } = await supabase.from("influencers").insert({
          handle: item.handle,
          owner_id: user.id,
          owner_nome: user.nome,
          ativo: true,
        });
        if (insErr) { err++; continue; }
        await syncToSharedBoard(item.handle, user.id);
        ok++;
      }
    }
    setBulkProcessing(false);
    if (ok > 0) {
      toast.success(`${ok} influenciador(es) adicionado(s)`);
      onSuccess?.();
    }
    if (err > 0) toast.error(`${err} erro(s) ao processar`);
    close();
  };

  const pendingCount = results.filter((r) => r.status === "pending").length;
  const singlePreview = extractHandle(singleInput);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden rounded-[28px] border-none bg-[#fafaf8] p-0 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)]">
        <div className="border-b border-black/[0.06] px-8 pt-8 pb-6">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-medium tracking-[-0.04em] text-[#1f1f1f]">
              Adicionar influenciador
            </DialogTitle>
            <DialogDescription className="text-[14px] text-[#6e6e73]">
              Adicione um por vez à esquerda, ou cole uma lista à direita.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          {/* LEFT — Single */}
          <div className="rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04] shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f3ef]">
                <UserPlus className="h-4 w-4 text-[#1f1f1f]" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">Um por vez</div>
                <div className="text-[16px] font-medium tracking-[-0.02em] text-[#1f1f1f]">Adicionar individual</div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#6e6e73]">
                @ ou URL do Instagram
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a96]" />
                <Input
                  placeholder="@exemplo ou https://instagram.com/exemplo"
                  value={singleInput}
                  onChange={(e) => { setSingleInput(e.target.value); setSingleError(""); }}
                  className={`h-12 rounded-full border-[#ececeb] bg-[#fafaf8] pl-11 pr-4 text-[14px] shadow-none ${singleError ? "border-destructive" : ""}`}
                  disabled={singleSubmitting}
                  onKeyDown={(e) => { if (e.key === "Enter" && singleInput.trim()) handleSingleSubmit(); }}
                />
              </div>
              {singleError && <p className="text-sm text-destructive">{singleError}</p>}
              {!singleError && singlePreview && (
                <p className="text-sm text-[#6e6e73]">
                  Será adicionado como: <span className="font-medium text-[#1f1f1f]">@{singlePreview.toLowerCase()}</span>
                </p>
              )}
              {singlePreview && (() => {
                const lock = influboard?.byHandle.get(singlePreview.toLowerCase());
                if (!lock) return null;
                return (
                  <div className="flex items-start gap-2 rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">Travado no Influboard</div>
                      <div className="mt-0.5 text-red-700/90">
                        Por <b>{lock.closer_name ?? "—"}</b> ({lock.team_name ?? "—"}) até{" "}
                        {lock.lock_expires_at ? new Date(lock.lock_expires_at).toLocaleString("pt-BR") : "—"}.
                      </div>
                    </div>
                  </div>
                );
              })()}

              <Button
                onClick={handleSingleSubmit}
                disabled={!singleInput.trim() || singleSubmitting}
                className="mt-2 h-11 w-full rounded-full bg-[#1f1f1f] text-[13px] font-medium text-white hover:bg-[#111111]"
              >
                {singleSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* RIGHT — Bulk */}
          <div className="rounded-[24px] bg-white p-6 ring-1 ring-black/[0.04] shadow-[0_18px_44px_-38px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f3ef]">
                <Users className="h-4 w-4 text-[#1f1f1f]" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#999999]">Em lote</div>
                <div className="text-[16px] font-medium tracking-[-0.02em] text-[#1f1f1f]">Adicionar vários</div>
              </div>
            </div>

            {!showResults ? (
              <div className="space-y-3">
                <label className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#6e6e73]">
                  Lista de @ ou URLs
                </label>
                <Textarea
                  placeholder={"@influencer1\n@influencer2, @influencer3\nhttps://instagram.com/exemplo"}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[140px] rounded-[18px] border-[#ececeb] bg-[#fafaf8] font-mono text-[13px] shadow-none"
                />
                <p className="text-xs text-[#9a9a96]">
                  Aceita @, URL ou nome puro — separados por linha, vírgula ou espaço.
                </p>
                <Button
                  onClick={handleVerify}
                  disabled={!bulkInput.trim() || bulkProcessing}
                  className="mt-2 h-11 w-full rounded-full bg-[#1f1f1f] text-[13px] font-medium text-white hover:bg-[#111111]"
                >
                  {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verificar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-[14px] bg-[#fafaf8] px-3 py-2">
                      <span className="font-mono text-[13px] text-[#1f1f1f]">{r.handle}</span>
                      {r.status === "pending" && (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          <Check className="mr-1 h-3 w-3" /> Pronto
                        </Badge>
                      )}
                      {r.status === "exists" && (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          <AlertCircle className="mr-1 h-3 w-3" /> {r.message}
                        </Badge>
                      )}
                      {r.status === "locked" && (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          <X className="mr-1 h-3 w-3" /> {r.message}
                        </Badge>
                      )}
                      {r.status === "invalid" && (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                          <X className="mr-1 h-3 w-3" /> {r.message}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-[12px] text-[#6e6e73]">
                  <span>{pendingCount} de {results.length} serão processados</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowResults(false)}
                    className="h-11 flex-1 rounded-full border-[#ececeb] bg-white text-[13px]"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleConfirmBulk}
                    disabled={pendingCount === 0 || bulkProcessing}
                    className="h-11 flex-1 rounded-full bg-[#1f1f1f] text-[13px] font-medium text-white hover:bg-[#111111]"
                  >
                    {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar ({pendingCount})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-black/[0.06] bg-white px-8 py-4">
          <Button
            variant="outline"
            onClick={close}
            className="h-11 rounded-full border-[#ececeb] bg-white px-6 text-[13px]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
