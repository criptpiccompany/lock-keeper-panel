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
}
