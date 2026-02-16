import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface FieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

interface EditReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  diffs: FieldDiff[];
  submitting?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  valor_pago: "Valor Pago",
  faturamento: "Faturamento",
  acumulado: "Acumulado",
  status: "Status",
  comprovante_url: "Comprovante",
  observacao: "Observação",
};

export function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

export default function EditReasonModal({
  open,
  onClose,
  onConfirm,
  diffs,
  submitting,
}: EditReasonModalProps) {
  const [reason, setReason] = useState("");

  const isValid = reason.trim().length >= 15;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Confirmar edição
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Diff summary */}
          {diffs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Campos alterados:</p>
              {diffs.map((d) => (
                <div key={d.field} className="rounded-lg border border-border/40 p-2.5 bg-muted/20 space-y-1">
                  <p className="text-xs font-semibold">{d.label}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-red-50 text-red-800 px-2 py-0.5 rounded break-all max-w-[40%] truncate">
                      {d.before || "(vazio)"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded break-all max-w-[40%] truncate">
                      {d.after || "(vazio)"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reason input */}
          <div className="space-y-2">
            <Label className="text-sm">
              Motivo da edição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Descreva o motivo da alteração (mínimo 15 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-sm"
            />
            {reason.length > 0 && reason.trim().length < 15 && (
              <p className="text-xs text-destructive">Mínimo de 15 caracteres ({reason.trim().length}/15)</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!isValid || submitting}>
            Salvar edição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { FieldDiff };
