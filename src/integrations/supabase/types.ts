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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_conflicts: {
        Row: {
          affiliate_email: string | null
          created_at: string
          handle: string | null
          id: string
          meta: Json | null
          month_key: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          type: string
          users_involved: Json
        }
        Insert: {
          affiliate_email?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          meta?: Json | null
          month_key: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          type: string
          users_involved?: Json
        }
        Update: {
          affiliate_email?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          meta?: Json | null
          month_key?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          type?: string
          users_involved?: Json
        }
        Relationships: []
      }
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
          team_id: string | null
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
          team_id?: string | null
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
          team_id?: string | null
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
          team_id: string | null
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
          team_id?: string | null
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
          team_id?: string | null
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
      commission_tiers: {
        Row: {
          created_at: string
          id: string
          percentage: number
          team_id: string
          threshold_result: number
          tier_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          percentage: number
          team_id?: string
          threshold_result: number
          tier_order: number
        }
        Update: {
          created_at?: string
          id?: string
          percentage?: number
          team_id?: string
          threshold_result?: number
          tier_order?: number
        }
        Relationships: []
      }
      daily_influencer_records: {
        Row: {
          acumulado: number | null
          closer_id: string
          comprovante_url: string | null
          comprovante_url_2: string | null
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          faturamento: number | null
          id: string
          influencer_id: string
          is_shared: boolean
          observacao: string | null
          shared_note: string | null
          status: string | null
          team_id: string | null
          updated_at: string
          valor_pago: number
        }
        Insert: {
          acumulado?: number | null
          closer_id: string
          comprovante_url?: string | null
          comprovante_url_2?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          faturamento?: number | null
          id?: string
          influencer_id: string
          is_shared?: boolean
          observacao?: string | null
          shared_note?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string
          valor_pago: number
        }
        Update: {
          acumulado?: number | null
          closer_id?: string
          comprovante_url?: string | null
          comprovante_url_2?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          faturamento?: number | null
          id?: string
          influencer_id?: string
          is_shared?: boolean
          observacao?: string | null
          shared_note?: string | null
          status?: string | null
          team_id?: string | null
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
          {
            foreignKeyName: "daily_influencer_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_receipt_uploads: {
        Row: {
          closer_id: string
          created_at: string
          daily_record_id: string | null
          date: string
          deleted_at: string | null
          deleted_by: string | null
          file_type: string | null
          file_url: string
          id: string
          parse_status: string | null
          parsed_at: string | null
          parsed_data: Json | null
          team_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          closer_id: string
          created_at?: string
          daily_record_id?: string | null
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          parse_status?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          team_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          closer_id?: string
          created_at?: string
          daily_record_id?: string | null
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          parse_status?: string | null
          parsed_at?: string | null
          parsed_data?: Json | null
          team_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_receipt_uploads_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_receipt_uploads_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_influencer_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_receipt_uploads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_receipt_uploads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_receipt_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_record_shared_partners: {
        Row: {
          created_at: string
          id: string
          partner_nome: string | null
          partner_user_id: string | null
          record_id: string
          share_amount: number | null
          share_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          partner_nome?: string | null
          partner_user_id?: string | null
          record_id: string
          share_amount?: number | null
          share_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          partner_nome?: string | null
          partner_user_id?: string | null
          record_id?: string
          share_amount?: number | null
          share_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_record_shared_partners_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "daily_influencer_records"
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
          team_id: string | null
        }
        Insert: {
          closer_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month: string
          team_id?: string | null
        }
        Update: {
          closer_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sheets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      influboard_lock_history: {
        Row: {
          created_at: string
          first_locked_at: string
          handle: string
          handle_normalized: string
          last_closer_name: string | null
          last_expires_at: string | null
          last_locked_at: string
          last_team_name: string | null
          lock_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_locked_at?: string
          handle: string
          handle_normalized: string
          last_closer_name?: string | null
          last_expires_at?: string | null
          last_locked_at?: string
          last_team_name?: string | null
          lock_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_locked_at?: string
          handle?: string
          handle_normalized?: string
          last_closer_name?: string | null
          last_expires_at?: string | null
          last_locked_at?: string
          last_team_name?: string | null
          lock_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      influboard_locked_cache: {
        Row: {
          closer_name: string | null
          external_id: number | null
          fetched_at: string
          handle: string
          handle_normalized: string
          id: number
          instagram_url: string | null
          lock_expires_at: string | null
          team_name: string | null
        }
        Insert: {
          closer_name?: string | null
          external_id?: number | null
          fetched_at?: string
          handle: string
          handle_normalized: string
          id?: never
          instagram_url?: string | null
          lock_expires_at?: string | null
          team_name?: string | null
        }
        Update: {
          closer_name?: string | null
          external_id?: number | null
          fetched_at?: string
          handle?: string
          handle_normalized?: string
          id?: never
          instagram_url?: string | null
          lock_expires_at?: string | null
          team_name?: string | null
        }
        Relationships: []
      }
      influboard_sync_meta: {
        Row: {
          id: number
          last_count: number | null
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
        }
        Insert: {
          id?: number
          last_count?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
        }
        Update: {
          id?: number
          last_count?: number | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
        }
        Relationships: []
      }
      influencer_locks: {
        Row: {
          created_at: string
          handle_normalized: string
          id: string
          influencer_id: string | null
          last_activity_at: string
          locked_by_nome: string | null
          locked_by_user_id: string
          locked_until: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle_normalized: string
          id?: string
          influencer_id?: string | null
          last_activity_at?: string
          locked_by_nome?: string | null
          locked_by_user_id: string
          locked_until: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle_normalized?: string
          id?: string
          influencer_id?: string | null
          last_activity_at?: string
          locked_by_nome?: string | null
          locked_by_user_id?: string
          locked_until?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_locks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
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
          team_id: string | null
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
          team_id?: string | null
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
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          role_to_assign: Database["public"]["Enums"]["app_role"] | null
          team_id: string | null
          token: string
          use_count: number
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          max_uses?: number
          role_to_assign?: Database["public"]["Enums"]["app_role"] | null
          team_id?: string | null
          token?: string
          use_count?: number
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          role_to_assign?: Database["public"]["Enums"]["app_role"] | null
          team_id?: string | null
          token?: string
          use_count?: number
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_influencers: {
        Row: {
          apoios: string[] | null
          archived: boolean
          archived_at: string | null
          archived_from_status: string | null
          classificacao: string | null
          closer_id: string
          created_at: string
          display_name: string
          id: string
          instagram_url: string | null
          instagram_username: string
          last_moved_at: string
          observacao: string | null
          status: string
          team_id: string | null
          updated_at: string
          valor_negociado: number | null
        }
        Insert: {
          apoios?: string[] | null
          archived?: boolean
          archived_at?: string | null
          archived_from_status?: string | null
          classificacao?: string | null
          closer_id: string
          created_at?: string
          display_name: string
          id?: string
          instagram_url?: string | null
          instagram_username: string
          last_moved_at?: string
          observacao?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          valor_negociado?: number | null
        }
        Update: {
          apoios?: string[] | null
          archived?: boolean
          archived_at?: string | null
          archived_from_status?: string | null
          classificacao?: string | null
          closer_id?: string
          created_at?: string
          display_name?: string
          id?: string
          instagram_url?: string | null
          instagram_username?: string
          last_moved_at?: string
          observacao?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          valor_negociado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_influencers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_influencer_list: {
        Row: {
          casa_1_email: string | null
          casa_1_valor: number | null
          casa_2_email: string | null
          casa_2_valor: number | null
          casa_3_email: string | null
          casa_3_valor: number | null
          closer_id: string
          created_at: string
          id: string
          influencer_handle: string
          influencer_id: string
          month: string
          observacoes: string | null
          team_id: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          casa_1_email?: string | null
          casa_1_valor?: number | null
          casa_2_email?: string | null
          casa_2_valor?: number | null
          casa_3_email?: string | null
          casa_3_valor?: number | null
          closer_id: string
          created_at?: string
          id?: string
          influencer_handle: string
          influencer_id: string
          month: string
          observacoes?: string | null
          team_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          casa_1_email?: string | null
          casa_1_valor?: number | null
          casa_2_email?: string | null
          casa_2_valor?: number | null
          casa_3_email?: string | null
          casa_3_valor?: number | null
          closer_id?: string
          created_at?: string
          id?: string
          influencer_handle?: string
          influencer_id?: string
          month?: string
          observacoes?: string | null
          team_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_influencer_list_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_platform_names: {
        Row: {
          closer_id: string
          created_at: string
          id: string
          month: string
          platform_1_name: string | null
          platform_2_name: string | null
          platform_3_name: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          closer_id: string
          created_at?: string
          id?: string
          month: string
          platform_1_name?: string | null
          platform_2_name?: string | null
          platform_3_name?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          closer_id?: string
          created_at?: string
          id?: string
          month?: string
          platform_1_name?: string | null
          platform_2_name?: string | null
          platform_3_name?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_platform_names_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_rate: number
          created_at: string
          id: string
          nome: string
          rejection_reason: string | null
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_rate?: number
          created_at?: string
          id: string
          nome: string
          rejection_reason?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          nome?: string
          rejection_reason?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_shared_board: {
        Row: {
          apoios: string[] | null
          archived: boolean
          archived_at: string | null
          archived_from_status: string | null
          assigned_to: string | null
          classificacao: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          instagram_url: string | null
          instagram_username: string
          last_moved_at: string
          observacao: string | null
          outreach_count: number
          status: string
          team_id: string | null
          updated_at: string
          valor_negociado: number | null
        }
        Insert: {
          apoios?: string[] | null
          archived?: boolean
          archived_at?: string | null
          archived_from_status?: string | null
          assigned_to?: string | null
          classificacao?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          display_name: string
          id?: string
          instagram_url?: string | null
          instagram_username: string
          last_moved_at?: string
          observacao?: string | null
          outreach_count?: number
          status?: string
          team_id?: string | null
          updated_at?: string
          valor_negociado?: number | null
        }
        Update: {
          apoios?: string[] | null
          archived?: boolean
          archived_at?: string | null
          archived_from_status?: string | null
          assigned_to?: string | null
          classificacao?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          instagram_url?: string | null
          instagram_username?: string
          last_moved_at?: string
          observacao?: string | null
          outreach_count?: number
          status?: string
          team_id?: string | null
          updated_at?: string
          valor_negociado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_shared_board_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_shared_board_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          taxa_operacional: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          taxa_operacional?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          taxa_operacional?: number
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
      admin_move_user_team: {
        Args: { _new_team_id: string; _target_user_id: string }
        Returns: undefined
      }
      consume_invite_token: {
        Args: { _token: string; _user_id: string }
        Returns: undefined
      }
      get_approved_closers: {
        Args: never
        Returns: {
          id: string
          nome: string
        }[]
      }
      get_global_daily_revenue: {
        Args: { _end: string; _start: string }
        Returns: number
      }
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
      get_shared_board_users: {
        Args: never
        Returns: {
          id: string
          nome: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_global_viewer: { Args: { _user_id: string }; Returns: boolean }
      is_same_team: {
        Args: { _user_id_a: string; _user_id_b: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { _admin_id: string; _target_id: string }
        Returns: boolean
      }
      sync_influencer_to_closer: {
        Args: { _closer_id: string; _handle: string }
        Returns: undefined
      }
      validate_invite_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role: "CLOSER" | "ADMIN" | "SUBADMIN" | "FINANCEIRO"
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
      app_role: ["CLOSER", "ADMIN", "SUBADMIN", "FINANCEIRO"],
      notification_review_status: ["PENDENTE", "REVISADO", "SUSPEITO"],
    },
  },
} as const
