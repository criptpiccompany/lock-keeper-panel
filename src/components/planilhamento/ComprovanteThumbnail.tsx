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

  return (
    <button
      onClick={onClick}
      className="inline-block rounded border border-border/50 overflow-hidden hover:ring-2 hover:ring-ring/30 transition-all w-8 h-8"
      title="Ver comprovante"
    >
      {isPdf || failed || !thumbSrc ? (
        <span className="w-full h-full bg-muted flex items-center justify-center">
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
    </button>
  );
}
