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
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          sent_by: string | null
          sent_to: string
          status: string
          task_id: string
          template: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          sent_by?: string | null
          sent_to: string
          status: string
          task_id: string
          template?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          sent_by?: string | null
          sent_to?: string
          status?: string
          task_id?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_with_score"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          accuracy_pct: number
          actual_impact_usd: number
          created_at: string
          doing_count: number
          done_count: number
          estimated_impact_usd: number
          gap_usd: number
          id: string
          margin_impact_pct: number
          overdue_count: number
          scope: Database["public"]["Enums"]["snapshot_scope"]
          snapshot_date: string
          todo_count: number
          total_tasks: number
          user_id: string | null
        }
        Insert: {
          accuracy_pct?: number
          actual_impact_usd?: number
          created_at?: string
          doing_count?: number
          done_count?: number
          estimated_impact_usd?: number
          gap_usd?: number
          id?: string
          margin_impact_pct?: number
          overdue_count?: number
          scope: Database["public"]["Enums"]["snapshot_scope"]
          snapshot_date: string
          todo_count?: number
          total_tasks?: number
          user_id?: string | null
        }
        Update: {
          accuracy_pct?: number
          actual_impact_usd?: number
          created_at?: string
          doing_count?: number
          done_count?: number
          estimated_impact_usd?: number
          gap_usd?: number
          id?: string
          margin_impact_pct?: number
          overdue_count?: number
          scope?: Database["public"]["Enums"]["snapshot_scope"]
          snapshot_date?: string
          todo_count?: number
          total_tasks?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_impact_usd: number | null
          assignee_id: string
          blocked_reason: string | null
          completed_at: string | null
          confidence: number
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          estimated_hours: number | null
          estimated_impact_usd: number
          expected_output: string | null
          id: string
          impact_type: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin: boolean
          is_blocked: boolean
          needs_review: boolean
          position: number
          recurrence: Database["public"]["Enums"]["task_recurrence"]
          review_status: Database["public"]["Enums"]["review_status"]
          reviewer_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["task_urgency"]
        }
        Insert: {
          actual_impact_usd?: number | null
          assignee_id: string
          blocked_reason?: string | null
          completed_at?: string | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_impact_usd?: number
          expected_output?: string | null
          id?: string
          impact_type?: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin?: boolean
          is_blocked?: boolean
          needs_review?: boolean
          position?: number
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
        }
        Update: {
          actual_impact_usd?: number | null
          assignee_id?: string
          blocked_reason?: string | null
          completed_at?: string | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_impact_usd?: number
          expected_output?: string | null
          id?: string
          impact_type?: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin?: boolean
          is_blocked?: boolean
          needs_review?: boolean
          position?: number
          recurrence?: Database["public"]["Enums"]["task_recurrence"]
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["task_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      tasks_with_score: {
        Row: {
          actual_impact_usd: number | null
          assignee_id: string | null
          blocked_reason: string | null
          completed_at: string | null
          confidence: number | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          estimated_hours: number | null
          estimated_impact_usd: number | null
          expected_output: string | null
          id: string | null
          impact_type: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin: boolean | null
          is_blocked: boolean | null
          is_overdue: boolean | null
          needs_review: boolean | null
          position: number | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          reviewer_id: string | null
          s_confidence_n: number | null
          s_deadline_mult: number | null
          s_effort: number | null
          s_impact_norm: number | null
          s_reach: number | null
          s_urgency_mult: number | null
          score: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string | null
          updated_at: string | null
          urgency: Database["public"]["Enums"]["task_urgency"] | null
        }
        Insert: {
          actual_impact_usd?: number | null
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_impact_usd?: number | null
          expected_output?: string | null
          id?: string | null
          impact_type?: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin?: boolean | null
          is_blocked?: boolean | null
          is_overdue?: never
          needs_review?: boolean | null
          position?: number | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewer_id?: string | null
          s_confidence_n?: never
          s_deadline_mult?: never
          s_effort?: never
          s_impact_norm?: never
          s_reach?: never
          s_urgency_mult?: never
          score?: never
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["task_urgency"] | null
        }
        Update: {
          actual_impact_usd?: number | null
          assignee_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          estimated_impact_usd?: number | null
          expected_output?: string | null
          id?: string | null
          impact_type?: Database["public"]["Enums"]["impact_type"] | null
          impacts_margin?: boolean | null
          is_blocked?: boolean | null
          is_overdue?: never
          needs_review?: boolean | null
          position?: number | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewer_id?: string | null
          s_confidence_n?: never
          s_deadline_mult?: never
          s_effort?: never
          s_impact_norm?: never
          s_reach?: never
          s_urgency_mult?: never
          score?: never
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["task_urgency"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      impact_type: "revenue" | "cost_reduction" | "margin_pct"
      review_status: "pending" | "requested" | "approved" | "changes_requested"
      snapshot_scope: "team" | "user"
      task_recurrence: "one_off" | "daily" | "weekly" | "monthly"
      task_status: "todo" | "doing" | "done"
      task_urgency: "low" | "medium" | "high" | "critical"
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
      app_role: ["admin", "member"],
      impact_type: ["revenue", "cost_reduction", "margin_pct"],
      review_status: ["pending", "requested", "approved", "changes_requested"],
      snapshot_scope: ["team", "user"],
      task_recurrence: ["one_off", "daily", "weekly", "monthly"],
      task_status: ["todo", "doing", "done"],
      task_urgency: ["low", "medium", "high", "critical"],
    },
  },
} as const
