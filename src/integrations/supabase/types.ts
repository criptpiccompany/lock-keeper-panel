export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          action: string
          actor_email: string | null
          actor_nome: string | null
          actor_role: string | null
          actor_user_id: string | null
          audit_log_id: string | null
          created_at: string
          edit_reason: string
          entity_id: string | null
          entity_type: string
          field_changes: Json | null
          id: string
          influencer_handle: string | null
          recipient_admin_id: string | null
          review_status: Database["public"]["Enums"]["notification_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          action?: string
          actor_email?: string | null
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          audit_log_id?: string | null
          created_at?: string
          edit_reason: string
          entity_id?: string | null
          entity_type: string
          field_changes?: Json | null
          id?: string
          influencer_handle?: string | null
          recipient_admin_id?: string | null
          review_status?: Database["public"]["Enums"]["notification_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          audit_log_id?: string | null
          created_at?: string
          edit_reason?: string
          entity_id?: string | null
          entity_type?: string
          field_changes?: Json | null
          id?: string
          influencer_handle?: string | null
          recipient_admin_id?: string | null
          review_status?: Database["public"]["Enums"]["notification_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          descricao: string
          detalhes: Json | null
          id: string
          user_id: string
          user_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          descricao: string
          detalhes?: Json | null
          id?: string
          user_id: string
          user_nome: string
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string
          detalhes?: Json | null
          id?: string
          user_id?: string
          user_nome?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_nome: string | null
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          description: string | null
          edit_reason: string | null
          entity_id: string | null
          entity_type: string
          field_changes: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          description?: string | null
          edit_reason?: string | null
          entity_id?: string | null
          entity_type: string
          field_changes?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          description?: string | null
          edit_reason?: string | null
          entity_id?: string | null
          entity_type?: string
          field_changes?: Json | null
          id?: string
        }
        Relationships: []
      }
      close_events: {
        Row: {
          acao: string
          created_at: string
          feito_em: string
          feito_por_id: string
          feito_por_nome: string
          id: string
          influencer_handle: string
          influencer_id: string
          motivo: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          feito_em?: string
          feito_por_id: string
          feito_por_nome: string
          id?: string
          influencer_handle: string
          influencer_id: string
          motivo?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          feito_em?: string
          feito_por_id?: string
          feito_por_nome?: string
          id?: string
          influencer_handle?: string
          influencer_id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "close_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_influencer_records: {
        Row: {
          acumulado: number | null
          closer_id: string
          comprovante_url: string
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          faturamento: number | null
          id: string
          influencer_id: string
          observacao: string | null
          status: string | null
          updated_at: string
          valor_pago: number
        }
        Insert: {
          acumulado?: number | null
          closer_id: string
          comprovante_url: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          faturamento?: number | null
          id?: string
          influencer_id: string
          observacao?: string | null
          status?: string | null
          updated_at?: string
          valor_pago: number
        }
        Update: {
          acumulado?: number | null
          closer_id?: string
          comprovante_url?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          faturamento?: number | null
          id?: string
          influencer_id?: string
          observacao?: string | null
          status?: string | null
          updated_at?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_influencer_records_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sheets: {
        Row: {
          closer_id: string
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          month: string
        }
        Insert: {
          closer_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month: string
        }
        Update: {
          closer_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month?: string
        }
        Relationships: []
      }
      influencers: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          handle: string
          id: string
          last_closed_at: string | null
          notas: string | null
          owner_id: string | null
          owner_nome: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          handle: string
          id?: string
          last_closed_at?: string | null
          notas?: string | null
          owner_id?: string | null
          owner_nome?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          handle?: string
          id?: string
          last_closed_at?: string | null
          notas?: string | null
          owner_id?: string | null
          owner_nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_influencer_list: {
        Row: {
          closer_id: string
          created_at: string
          email_afiliado: string | null
          id: string
          influencer_handle: string
          influencer_id: string
          link_1: string | null
          link_2: string | null
          link_3: string | null
          month: string
          observacoes: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          closer_id: string
          created_at?: string
          email_afiliado?: string | null
          id?: string
          influencer_handle: string
          influencer_id: string
          link_1?: string | null
          link_2?: string | null
          link_3?: string | null
          month: string
          observacoes?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          closer_id?: string
          created_at?: string
          email_afiliado?: string | null
          id?: string
          influencer_handle?: string
          influencer_id?: string
          link_1?: string | null
          link_2?: string | null
          link_3?: string | null
          month?: string
          observacoes?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_influencers: {
        Args: never
        Returns: {
          ativo: boolean
          created_at: string
          handle: string
          id: string
          is_locked: boolean
          last_closed_at: string
          locked_until: string
          owner_nome: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "CLOSER" | "ADMIN"
      notification_review_status: "PENDENTE" | "REVISADO" | "SUSPEITO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["CLOSER", "ADMIN"],
      notification_review_status: ["PENDENTE", "REVISADO", "SUSPEITO"],
    },
  },
} as const
