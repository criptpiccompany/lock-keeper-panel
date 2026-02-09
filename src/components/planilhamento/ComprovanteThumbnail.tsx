import { useEffect, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  url: string;
  onClick: () => void;
}

export default function ComprovanteThumbnail({ url, onClick }: Props) {
  const isPdf = url.toLowerCase().includes(".pdf");
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isPdf) return;
    let cancelled = false;
    const path = url.split("/comprovantes/")[1];
    if (!path) {
      setFailed(true);
      return;
    }
    supabase.storage
      .from("comprovantes")
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.signedUrl) {
          setThumbSrc(data.signedUrl);
        } else {
          setFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [url, isPdf]);

  const showPlaceholder = isPdf || failed || !thumbSrc;
  const badge = isPdf ? "PDF" : "IMG";

  return (
    <button
      onClick={onClick}
      className="relative inline-flex w-9 h-9 rounded-lg overflow-hidden bg-muted/60 border border-border/30 hover:scale-105 hover:shadow-[0_2px_10px_0_hsl(var(--primary)/0.18)] transition-all duration-150 cursor-pointer group"
      title="Ver comprovante"
    >
      {showPlaceholder ? (
        <span className="w-full h-full flex items-center justify-center">
          {isPdf ? (
            <FileText className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      ) : (
        <img
          src={thumbSrc}
          alt="Comprovante"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {/* File type badge */}
      <span className="absolute bottom-0 right-0 text-[7px] leading-none font-semibold px-1 py-[1px] rounded-tl-md bg-foreground/70 text-background tracking-wide">
        {badge}
      </span>
    </button>
  );
}
