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
  apoios: string[] | null;
  classificacao: string | null;
}

export const CLASSIFICACAO_OPTIONS = [
  { value: "Forte", bg: "#DCFCE7", text: "#166534" },
  { value: "Média", bg: "#DBEAFE", text: "#1E40AF" },
  { value: "Fraca", bg: "#FEF9C3", text: "#854D0E" },
] as const;

export const CLASSIFICACAO_ORDER: Record<string, number> = {
  Forte: 0,
  Média: 1,
  Fraca: 2,
};

export interface ColumnDef {
  id: string;
  bg: string;
  accent: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: "Fechar", bg: "#F3E8FF", accent: "#7C3AED" },
  { id: "Negociando", bg: "#F3F4F6", accent: "#6B7280" },
  { id: "Positivo", bg: "#E0F2FE", accent: "#0284C7" },
  { id: "Empatando / Negociar", bg: "#FEF3C7", accent: "#D97706" },
  { id: "Pausado", bg: "#FEE2E2", accent: "#DC2626" },
  { id: "Com a equipe", bg: "#DCFCE7", accent: "#16A34A" },
  { id: "Não posta mais", bg: "#E5E7EB", accent: "#4B5563" },
];
