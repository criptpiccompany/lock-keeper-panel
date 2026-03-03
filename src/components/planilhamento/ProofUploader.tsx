import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB
const COMPRESS_MAX_DIM = 1600;
const COMPRESS_QUALITY = 0.8;

interface Props {
  label: string;
  sublabel?: string;
  value: File | null;
  existingUrl?: string;
  onChange: (file: File | null) => void;
  /** true while parent is submitting */
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedType(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function isImageType(file: File): boolean {
  return file.type.startsWith("image/");
}

async function compressImage(file: File): Promise<File> {
  if (!isImageType(file) || file.type === "application/pdf") return file;
  if (file.size <= COMPRESS_THRESHOLD) return file;

  return new Promise<File>((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
            const ratio = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) { resolve(file); return; }
              const compressed = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
              resolve(compressed);
            },
            file.type === "image/png" ? "image/png" : "image/jpeg",
            COMPRESS_QUALITY
          );
        } catch {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch {
      resolve(file);
    }
  });
}

async function processFile(raw: File): Promise<File | null> {
  if (!isAcceptedType(raw)) {
    toast.error("Formato não aceito", { description: "Use JPG, PNG, WEBP ou PDF." });
    return null;
  }
  if (raw.size > MAX_SIZE_BYTES) {
    toast.error("Arquivo muito grande", { description: `Limite de 10 MB. Este tem ${formatFileSize(raw.size)}.` });
    return null;
  }
  const file = await compressImage(raw);
  return file;
}

export default function ProofUploader({ label, sublabel, value, existingUrl, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Generate preview for current file
  useEffect(() => {
    if (!value) { setPreview(null); return; }
    if (!isImageType(value)) { setPreview(null); return; }
    try {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setPreview(null);
    }
  }, [value]);

  const handleFile = useCallback(async (file: File) => {
    const processed = await processFile(file);
    if (processed) onChange(processed);
  }, [onChange]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (list.length > 1) {
      toast.info("Somente 1 arquivo por comprovante");
    }
    handleFile(list[0]);
  }, [handleFile]);

  // File input change
  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (files && files.length > 0) handleFiles(files);
    } catch (err) {
      console.error("[ProofUploader] input change error:", err);
    }
    // Reset so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }, [handleFiles]);

  // Drag & drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    try {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) handleFiles(files);
    } catch (err) {
      console.error("[ProofUploader] drop error:", err);
    }
  }, [handleFiles]);

  // Paste handler (attached to document when component is mounted)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      try {
        // Only handle if the dropzone or its parent modal is visible
        if (!dropzoneRef.current) return;
        const rect = dropzoneRef.current.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === "file" && (item.type.startsWith("image/") || item.type === "application/pdf")) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              handleFile(file);
              return;
            }
          }
        }
      } catch (err) {
        console.error("[ProofUploader] paste error:", err);
      }
    };

    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [handleFile]);

  const isPdf = value?.type === "application/pdf" || value?.name?.toLowerCase().endsWith(".pdf");
  const hasExisting = !value && !!existingUrl;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">
        {label}
        {sublabel && <span className="text-muted-foreground text-xs ml-1">{sublabel}</span>}
      </label>

      {/* File selected — show preview */}
      {value ? (
        <div className="flex items-center gap-3 border rounded-lg px-3 py-2.5 bg-muted/30">
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted/60 flex items-center justify-center shrink-0 border border-border/30">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : isPdf ? (
              <FileText className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
          </div>
          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
            disabled={disabled}
            title="Remover"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        /* Dropzone */
        <div
          ref={dropzoneRef}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            cursor-pointer border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors
            ${dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40 hover:bg-muted/30"}
            ${disabled ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
          <p className="text-xs text-muted-foreground">
            Clique para selecionar, cole <span className="hidden sm:inline">(Ctrl+V)</span> ou arraste
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">JPG, PNG, WEBP, PDF • Máx 10 MB</p>
          {hasExisting && (
            <p className="text-[10px] text-primary mt-1">Já possui comprovante anexado</p>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
