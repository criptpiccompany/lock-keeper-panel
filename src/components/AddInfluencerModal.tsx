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
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

interface AddInfluencerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInfluencerModal({ open, onOpenChange }: AddInfluencerModalProps) {
  const [handle, setHandle] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const { addInfluencer, getEnrichedInfluencers } = useStore();

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
    
    // Check for duplicates
    const existing = getEnrichedInfluencers().find(
      (i) => i.handle.toLowerCase() === value.toLowerCase()
    );
    if (existing) {
      setError("Este influenciador já existe");
      return false;
    }
    
    setError("");
    return true;
  };

  const handleSubmit = () => {
    if (!validateHandle(handle)) return;

    addInfluencer(handle.trim(), notas.trim() || undefined);
    toast.success("Influenciador adicionado ao seu painel", {
      description: `${handle} foi criado e está pronto para fechamentos.`,
    });
    
    setHandle("");
    setNotas("");
    setError("");
    onOpenChange(false);
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
            <UserPlus className="h-5 w-5 text-primary" />
            Adicionar Influenciador
          </DialogTitle>
          <DialogDescription>
            Adicione um novo influenciador ao seu painel. Ele ficará liberado até
            você registrar o primeiro fechamento.
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!handle.trim()}>
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
