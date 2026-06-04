import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("influencers")
        .select("handle")
        .eq("owner_id", user.id)
        .eq("ativo", true)
        .order("handle", { ascending: true });

      setSuggestions(
        (data || [])
          .map((item: { handle: string | null }) => item.handle?.trim())
          .filter((handle): handle is string => Boolean(handle))
          .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      );
    };

    fetchSuggestions();
  }, [user]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase().replace(/^@/, "");
    if (!query) return suggestions.slice(0, 12);
    return suggestions
      .filter((handle) => handle.toLowerCase().replace(/^@/, "").includes(query))
      .slice(0, 12);
  }, [suggestions, value]);

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
      setOpen(false);
    } catch {
      // errors handled inside onAdd with toasts
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
      <div ref={wrapperRef} className="relative w-full flex-1 sm:max-w-[520px]">
        <Input
          placeholder="@username, URL ou influenciador da sua lista"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          className="h-12 rounded-[18px] border-[#ececeb] bg-white pl-4 pr-10 text-sm shadow-none"
        />
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a96]" />

        {open && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[18px] border border-[#ececeb] bg-white shadow-[0_18px_44px_-32px_rgba(15,23,42,0.18)]">
            <div className="max-h-72 overflow-y-auto py-2">
              {filteredSuggestions.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  onClick={() => {
                    setValue(handle.startsWith("@") ? handle : `@${handle}`);
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-[13px] text-[#1f1f1f] transition-colors hover:bg-[#f7f7f4]"
                >
                  {handle.startsWith("@") ? handle : `@${handle}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={loading || !value.trim()}
        className="h-11 rounded-full bg-[#1f1f1f] px-5 text-[13px] font-medium text-white hover:bg-[#111111] sm:shrink-0"
      >
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
