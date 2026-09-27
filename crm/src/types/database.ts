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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          contact_id: string
          content: string | null
          created_at: string
          id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          contact_id: string
          content?: string | null
          created_at?: string
          id?: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          contact_id?: string
          content?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          lost_reason: string | null
          name: string
          phone: string | null
          source: Database["public"]["Enums"]["contact_source"]
          stage: Database["public"]["Enums"]["contact_stage"]
          tier: Database["public"]["Enums"]["contact_tier"]
          updated_at: string
          value_gbp: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          phone?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          stage?: Database["public"]["Enums"]["contact_stage"]
          tier?: Database["public"]["Enums"]["contact_tier"]
          updated_at?: string
          value_gbp?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          phone?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          stage?: Database["public"]["Enums"]["contact_stage"]
          tier?: Database["public"]["Enums"]["contact_tier"]
          updated_at?: string
          value_gbp?: number | null
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          sequence_id: string
          status: Database["public"]["Enums"]["email_send_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          provider_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          sequence_id: string
          status?: Database["public"]["Enums"]["email_send_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sequence_id?: string
          status?: Database["public"]["Enums"]["email_send_status"]
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          active: boolean
          body_template: string
          created_at: string
          delay_hours: number
          id: string
          name: string
          subject: string
          tier: Database["public"]["Enums"]["contact_tier"]
          trigger_stage: Database["public"]["Enums"]["contact_stage"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_template: string
          created_at?: string
          delay_hours?: number
          id?: string
          name: string
          subject: string
          tier: Database["public"]["Enums"]["contact_tier"]
          trigger_stage: Database["public"]["Enums"]["contact_stage"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_template?: string
          created_at?: string
          delay_hours?: number
          id?: string
          name?: string
          subject?: string
          tier?: Database["public"]["Enums"]["contact_tier"]
          trigger_stage?: Database["public"]["Enums"]["contact_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          contact_id: string
          created_at: string
          due_date: string | null
          id: string
          title: string
        }
        Insert: {
          completed?: boolean
          contact_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          title: string
        }
        Update: {
          completed?: boolean
          contact_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type: "note" | "email" | "call" | "stage_change"
      contact_source: "organic" | "referral" | "paid" | "dm" | "other"
      contact_stage:
        | "lead"
        | "contacted"
        | "call_booked"
        | "call_done"
        | "proposal_sent"
        | "won"
        | "lost"
      contact_tier: "high_ticket" | "standard"
      email_send_status: "pending" | "sent" | "failed"
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
      activity_type: ["note", "email", "call", "stage_change"],
      contact_source: ["organic", "referral", "paid", "dm", "other"],
      contact_stage: [
        "lead",
        "contacted",
        "call_booked",
        "call_done",
        "proposal_sent",
        "won",
        "lost",
      ],
      contact_tier: ["high_ticket", "standard"],
      email_send_status: ["pending", "sent", "failed"],
    },
  },
} as const
