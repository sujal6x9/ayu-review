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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: string
          id: string
          paper_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: string
          id?: string
          paper_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: string
          id?: string
          paper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anchor: Json
          author_id: string
          body: string
          created_at: string
          id: string
          mark: Database["public"]["Enums"]["mark_status"]
          paper_id: string
          parent_id: string | null
          question_ref: string
          status: Database["public"]["Enums"]["comment_status"]
          suggested_correction: string
          updated_at: string
        }
        Insert: {
          anchor?: Json
          author_id: string
          body: string
          created_at?: string
          id?: string
          mark?: Database["public"]["Enums"]["mark_status"]
          paper_id: string
          parent_id?: string | null
          question_ref?: string
          status?: Database["public"]["Enums"]["comment_status"]
          suggested_correction?: string
          updated_at?: string
        }
        Update: {
          anchor?: Json
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          mark?: Database["public"]["Enums"]["mark_status"]
          paper_id?: string
          parent_id?: string | null
          question_ref?: string
          status?: Database["public"]["Enums"]["comment_status"]
          suggested_correction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          created_at: string
          exam_name: string
          file_name: string | null
          file_path: string | null
          file_type: string | null
          id: string
          paper_code: string
          review_cycle: number
          reviewer_id: string | null
          status: Database["public"]["Enums"]["paper_status"]
          subject: string
          test_number: string
          title: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          exam_name?: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          paper_code?: string
          review_cycle?: number
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["paper_status"]
          subject?: string
          test_number?: string
          title: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          exam_name?: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          paper_code?: string
          review_cycle?: number
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["paper_status"]
          subject?: string
          test_number?: string
          title?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_access_paper: { Args: { _paper_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "uploader" | "reviewer"
      comment_status: "open" | "resolved"
      mark_status:
        | "none"
        | "correct"
        | "incorrect"
        | "needs_improvement"
        | "corrected"
        | "approved"
      paper_status:
        | "draft"
        | "uploaded"
        | "assigned"
        | "under_review"
        | "changes_requested"
        | "corrections_in_progress"
        | "resubmitted"
        | "approved"
        | "finalized"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "uploader", "reviewer"],
      comment_status: ["open", "resolved"],
      mark_status: [
        "none",
        "correct",
        "incorrect",
        "needs_improvement",
        "corrected",
        "approved",
      ],
      paper_status: [
        "draft",
        "uploaded",
        "assigned",
        "under_review",
        "changes_requested",
        "corrections_in_progress",
        "resubmitted",
        "approved",
        "finalized",
      ],
    },
  },
} as const
