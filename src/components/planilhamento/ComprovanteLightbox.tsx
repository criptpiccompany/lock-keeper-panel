import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  parsedData?: any;
}

export default function ComprovanteLightbox({ open, onClose, url, parsedData }: Props) {
  const isPdf = url.toLowerCase().includes(".pdf");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on open/url change
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open, url]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isPdf) return;
    e.preventDefault();
    setZoom((z) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      return Math.min(Math.max(z + delta, 0.25), 5);
    });
  }, [isPdf]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPdf || zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [isPdf, zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.target = "_self";
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${parsedData ? "sm:max-w-5xl" : "sm:max-w-3xl"} max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-sm font-semibold">Comprovante</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1">
            {!isPdf && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Diminuir zoom">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground w-10 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Aumentar zoom">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Resetar">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <span className="w-px h-4 bg-border/60 mx-1" />
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="Baixar">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content + side panel */}
        <div className="flex-1 flex overflow-hidden">
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden flex items-center justify-center bg-muted/30 min-h-[400px]"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: !isPdf && zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
          >
            {isPdf ? (
              <iframe
                src={url}
                className="w-full h-[78vh] border-0"
                title="Comprovante PDF"
              />
            ) : (
              <img
                src={url}
                alt="Comprovante"
                className="max-w-full max-h-[78vh] object-contain rounded select-none"
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transition: dragging ? "none" : "transform 0.15s ease",
                }}
              />
            )}
          </div>
          {parsedData && (
            <div className="w-[280px] border-l border-border/40 overflow-y-auto p-5 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-medium">Dados extraídos pela IA</p>
              <div className="space-y-3 text-sm">
                {parsedData.valor && <Field label="Valor" value={`R$ ${parsedData.valor}`} highlight />}
                {parsedData.destinatario && <Field label="Destinatário" value={parsedData.destinatario} />}
                {parsedData.cpf_cnpj && <Field label="CPF/CNPJ" value={parsedData.cpf_cnpj} />}
                {parsedData.banco && <Field label="Banco" value={parsedData.banco} />}
                {parsedData.tipo && <Field label="Tipo" value={parsedData.tipo} />}
                {parsedData.data && <Field label="Data" value={parsedData.data + (parsedData.hora ? ` ${parsedData.hora}` : "")} />}
                {parsedData.id_transacao && <Field label="ID transação" value={parsedData.id_transacao} mono />}
                {parsedData.raw && (
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">{parsedData.raw}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
