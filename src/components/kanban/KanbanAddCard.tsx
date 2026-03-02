import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";

interface KanbanAddCardProps {
  onAdd: (usernames: string[]) => Promise<void>;
}

/** Extract valid Instagram username from various formats */
function extractUsername(raw: string): string | null {
  let val = raw.trim();
  if (!val) return null;

  // Extract from URL patterns
  const urlMatch = val.match(
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i
  );
  if (urlMatch) val = urlMatch[1];

  // Remove leading @
  val = val.replace(/^@/, "").trim().toLowerCase();

  // Validate: Instagram usernames are 1-30 chars, alphanumeric + dots + underscores
  if (!/^[a-z0-9_.]{1,30}$/.test(val)) return null;

  return val;
}

export function KanbanAddCard({ onAdd }: KanbanAddCardProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;

    // Split by newlines, commas, or spaces and parse each
    const parts = value.split(/[\n,]+/).flatMap((p) => p.trim().split(/\s+/));
    const parsed = parts.map(extractUsername).filter(Boolean) as string[];
    // Deduplicate
    const unique = [...new Set(parsed)];

    if (unique.length === 0) return;

    setLoading(true);
    try {
      await onAdd(unique);
      setValue("");
    } catch {
      // errors handled inside onAdd with toasts
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <Textarea
        placeholder={"@username, URL ou lista separada por vírgula/linha\nEx: @toguro, @influencer2"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-sm min-h-[40px] h-10 resize-y text-sm"
        rows={1}
      />
      <Button type="submit" size="sm" disabled={loading || !value.trim()}>
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-1.5 h-4 w-4" />
        )}
        Adicionar
      </Button>
    </form>
  );
}
