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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Check, X, AlertCircle, Loader2 } from "lucide-react";

interface BulkAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParseResult {
  handle: string;
  status: 'pending' | 'success' | 'exists' | 'locked' | 'invalid';
  message?: string;
}

export function BulkAddModal({ open, onOpenChange, onSuccess }: BulkAddModalProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ParseResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Parse handles from input
  const parseHandles = (text: string): string[] => {
    // Split by newlines, commas, or spaces
    const parts = text.split(/[\n,\s]+/).filter(Boolean);
    
    // Normalize handles
    const handles = parts.map(part => {
      let handle = part.trim().toLowerCase();
      // Add @ if missing
      if (!handle.startsWith('@')) {
        handle = '@' + handle;
      }
      return handle;
    });

    // Remove duplicates
    return [...new Set(handles)];
  };

  const validateHandle = (handle: string): boolean => {
    // Must start with @ and have at least 2 chars after
    return /^@[a-z0-9_\.]{2,}$/i.test(handle);
  };

  const handleProcess = async () => {
    if (!user) return;

    const handles = parseHandles(input);
    if (handles.length === 0) {
      toast.error("Nenhum handle válido encontrado");
      return;
    }

    setIsProcessing(true);
    const newResults: ParseResult[] = [];

    for (const handle of handles) {
      // Validate format
      if (!validateHandle(handle)) {
        newResults.push({
          handle,
          status: 'invalid',
          message: 'Formato inválido'
        });
        continue;
      }

      // Check if exists
      const { data: existing, error } = await supabase
        .from('influencers')
        .select('id, owner_id, owner_nome, last_closed_at, ativo')
        .eq('handle', handle)
        .maybeSingle();

      if (error) {
        newResults.push({
          handle,
          status: 'invalid',
          message: 'Erro ao verificar'
        });
        continue;
      }

      if (existing) {
        // Check ownership
        if (existing.owner_id === user.id) {
          newResults.push({
            handle,
            status: 'exists',
            message: 'Já está na sua lista'
          });
          continue;
        }

        // Check if locked by someone else
        if (existing.last_closed_at) {
          const lockedUntil = new Date(new Date(existing.last_closed_at).getTime() + 10 * 24 * 60 * 60 * 1000);
          if (new Date() < lockedUntil && existing.owner_id !== user.id) {
            newResults.push({
              handle,
              status: 'locked',
              message: `Travado por ${existing.owner_nome || 'outro'}`
            });
            continue;
          }
        }

        // Exists but is released - can claim
        newResults.push({
          handle,
          status: 'pending',
          message: 'Liberado - será registrado fechamento'
        });
      } else {
        // New influencer
        newResults.push({
          handle,
          status: 'pending',
          message: 'Novo - será adicionado'
        });
      }
    }

    setResults(newResults);
    setShowResults(true);
    setIsProcessing(false);
  };

  const handleConfirm = async () => {
    if (!user) return;

    setIsProcessing(true);
    const pendingHandles = results.filter(r => r.status === 'pending');
    let successCount = 0;
    let errorCount = 0;

    for (const item of pendingHandles) {
      // Check if exists
      const { data: existing } = await supabase
        .from('influencers')
        .select('id')
        .eq('handle', item.handle)
        .maybeSingle();

      if (existing) {
        // Register fechamento
        const now = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('influencers')
          .update({
            owner_id: user.id,
            owner_nome: user.nome,
            last_closed_at: now
          })
          .eq('id', existing.id);

        if (updateError) {
          errorCount++;
          continue;
        }

        // Create event
        await supabase.from('close_events').insert({
          influencer_id: existing.id,
          influencer_handle: item.handle,
          feito_por_id: user.id,
          feito_por_nome: user.nome,
          feito_em: now,
          acao: 'FECHAMENTO'
        });

        successCount++;
      } else {
        // Create new
        const { data: newInf, error: insertError } = await supabase
          .from('influencers')
          .insert({
            handle: item.handle,
            owner_id: user.id,
            owner_nome: user.nome,
            ativo: true
          })
          .select('id')
          .single();

        if (insertError) {
          errorCount++;
          continue;
        }

        successCount++;
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(`${successCount} influenciador(es) adicionado(s)`);
      onSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erro(s) ao processar`);
    }

    handleClose();
  };

  const handleClose = () => {
    setInput("");
    setResults([]);
    setShowResults(false);
    onOpenChange(false);
  };

  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Vários Influenciadores
          </DialogTitle>
          <DialogDescription>
            Cole os handles dos influenciadores, um por linha ou separados por vírgula.
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Handles</Label>
                <Textarea
                  placeholder="@influencer1&#10;@influencer2, @influencer3&#10;perfil_sem_arroba"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita múltiplos formatos: um por linha, separados por vírgula ou espaço.
                  O @ será adicionado automaticamente se necessário.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleProcess} disabled={!input.trim() || isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <span className="font-mono text-sm">{result.handle}</span>
                  <div className="flex items-center gap-2">
                    {result.status === 'pending' && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Check className="h-3 w-3 mr-1" />
                        Pronto
                      </Badge>
                    )}
                    {result.status === 'exists' && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {result.message}
                      </Badge>
                    )}
                    {result.status === 'locked' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <X className="h-3 w-3 mr-1" />
                        {result.message}
                      </Badge>
                    )}
                    {result.status === 'invalid' && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <X className="h-3 w-3 mr-1" />
                        {result.message}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
              <span>
                {pendingCount} de {results.length} serão processados
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResults(false)}>
                Voltar
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={pendingCount === 0 || isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar ({pendingCount})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
