import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, Loader2 } from "lucide-react";

interface AddInfluencerByUrlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddInfluencerByUrlModal({ open, onOpenChange, onSuccess }: AddInfluencerByUrlModalProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractHandle = (input: string): string | null => {
    let username = input.trim();
    const match = username.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/);
    if (match) username = match[1];
    else username = username.replace(/^@/, "");
    return username || null;
  };

  const handleSubmit = async () => {
    if (!user) return;

    const username = extractHandle(url);
    if (!username) {
      setError("URL ou username inválido");
      return;
    }

    const handle = `@${username.toLowerCase()}`;
    setIsSubmitting(true);

    const { data: existing } = await supabase
      .from("influencers")
      .select("id")
      .eq("handle", handle)
      .maybeSingle();

    if (existing) {
      setError("Este influenciador já existe");
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("influencers")
      .insert({
        handle,
        owner_id: user.id,
        owner_nome: user.nome,
        ativo: true,
      });

    if (insertError) {
      toast.error("Erro ao adicionar influenciador");
      setIsSubmitting(false);
      return;
    }

    toast.success("Influenciador adicionado!", {
      description: `${handle} foi adicionado ao seu painel.`,
    });

    setUrl("");
    setError("");
    setIsSubmitting(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setUrl("");
    setError("");
    onOpenChange(false);
  };

  const preview = extractHandle(url);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Adicionar com URL
          </DialogTitle>
          <DialogDescription>
            Cole a URL do perfil do Instagram e o @ será extraído automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="instagram-url">URL ou @username *</Label>
            <Input
              id="instagram-url"
              placeholder="https://instagram.com/exemplo ou @exemplo"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              className={error ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!error && preview && (
              <p className="text-sm text-muted-foreground">
                Será adicionado como: <span className="font-medium text-foreground">@{preview.toLowerCase()}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
