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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface ReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: (motivo: string) => void;
  variant?: "default" | "warning" | "destructive";
}

export function ReasonModal({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onConfirm,
  variant = "default",
}: ReasonModalProps) {
  const [motivo, setMotivo] = useState("");

  const handleConfirm = () => {
    if (motivo.trim().length < 5) return;
    onConfirm(motivo.trim());
    setMotivo("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setMotivo("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variant !== "default" && (
              <AlertTriangle className={`h-5 w-5 ${variant === "destructive" ? "text-destructive" : "text-warning"}`} />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (obrigatório)</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo desta ação..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 5 caracteres. Esta ação será registrada no log de auditoria.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={motivo.trim().length < 5}
            variant={variant === "destructive" ? "destructive" : "default"}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
