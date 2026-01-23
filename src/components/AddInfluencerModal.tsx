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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

interface AddInfluencerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddInfluencerModal({ open, onOpenChange, onSuccess }: AddInfluencerModalProps) {
  const { user } = useAuth();
  const [handle, setHandle] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateHandle = (value: string): boolean => {
    if (!value.trim()) {
      setError("O handle é obrigatório");
      return false;
    }
    if (!value.startsWith("@")) {
      setError("O handle deve começar com @");
      return false;
    }
    if (value.length < 3) {
      setError("O handle deve ter pelo menos 3 caracteres");
      return false;
    }
    
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateHandle(handle)) return;

    setIsSubmitting(true);

    // Check for duplicates
    const { data: existing } = await supabase
      .from('influencers')
      .select('id')
      .eq('handle', handle.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      setError("Este influenciador já existe");
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('influencers')
      .insert({
        handle: handle.trim().toLowerCase(),
        owner_id: user.id,
        owner_nome: user.nome,
        notas: notas.trim() || null,
        ativo: true
      });

    if (insertError) {
      toast.error("Erro ao adicionar influenciador");
      setIsSubmitting(false);
      return;
    }

    toast.success("Influenciador adicionado!", {
      description: `${handle} foi adicionado ao seu painel.`,
    });
    
    setHandle("");
    setNotas("");
    setError("");
    setIsSubmitting(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setHandle("");
    setNotas("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Influenciador
          </DialogTitle>
          <DialogDescription>
            Adicione um novo influenciador ao seu painel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="handle">Handle do Instagram *</Label>
            <Input
              id="handle"
              placeholder="@exemplo"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (error) validateHandle(e.target.value);
              }}
              className={error ? "border-destructive" : ""}
              disabled={isSubmitting}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              placeholder="Observações sobre o influenciador..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="min-h-[80px]"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!handle.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
