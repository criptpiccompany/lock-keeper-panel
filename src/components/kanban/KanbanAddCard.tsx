import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface KanbanAddCardProps {
  onAdd: (instagramUrl: string) => Promise<void>;
}

export function KanbanAddCard({ onAdd }: KanbanAddCardProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    await onAdd(value);
    setValue("");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        placeholder="Instagram URL ou @username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-sm"
      />
      <Button type="submit" size="sm" disabled={loading || !value.trim()}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar
      </Button>
    </form>
  );
}
