export interface KanbanCard {
  id: string;
  closer_id: string;
  instagram_url: string | null;
  instagram_username: string;
  display_name: string;
  status: string;
  valor_negociado: number | null;
  last_moved_at: string;
  created_at: string;
  updated_at: string;
  observacao: string | null;
}

export interface ColumnDef {
  id: string;
  color: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: "Fechar", color: "hsl(220 12% 15%)" },
  { id: "Negociando", color: "hsl(35 80% 50%)" },
  { id: "Positivo", color: "hsl(150 50% 40%)" },
  { id: "Empatando / Negociar", color: "hsl(25 70% 50%)" },
  { id: "Pausado", color: "hsl(220 10% 55%)" },
  { id: "Com a equipe", color: "hsl(200 60% 45%)" },
  { id: "Não posta mais", color: "hsl(0 65% 55%)" },
];
