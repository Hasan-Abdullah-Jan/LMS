export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string;
          read_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          announcement_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          announcement_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'announcement_reads_announcement_id_fkey';
            columns: ['announcement_id'];
            isOneToOne: false;
            referencedRelation: 'announcements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcement_reads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          author_id: string;
          body: string;
          course_id: string | null;
          created_at: string;
          id: string;
          is_pinned: boolean;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          course_id?: string | null;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          course_id?: string | null;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
        ];
      };
      assignments: {
        Row: {
          allow_late: boolean;
          attachment_name: string | null;
          attachment_path: string | null;
          course_id: string;
          created_at: string;
          created_by: string;
          due_at: string;
          id: string;
          instructions: string;
          max_marks: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allow_late?: boolean;
          attachment_name?: string | null;
          attachment_path?: string | null;
          course_id: string;
          created_at?: string;
          created_by: string;
          due_at: string;
          id?: string;
          instructions: string;
          max_marks: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          allow_late?: boolean;
          attachment_name?: string | null;
          attachment_path?: string | null;
          course_id?: string;
          created_at?: string;
          created_by?: string;
          due_at?: string;
          id?: string;
          instructions?: string;
          max_marks?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          at: string;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          at?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          at?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          course_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          sender_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          course_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          sender_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          course_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          sender_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_messages_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      complaints: {
        Row: {
          admin_response: string | null;
          attachment_name: string | null;
          attachment_path: string | null;
          category: string;
          course_id: string | null;
          created_at: string;
          description: string;
          follow_up: string | null;
          follow_up_at: string | null;
          id: string;
          raised_by: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['complaint_status'];
          subject: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_response?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          category: string;
          course_id?: string | null;
          created_at?: string;
          description: string;
          follow_up?: string | null;
          follow_up_at?: string | null;
          id?: string;
          raised_by: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['complaint_status'];
          subject: string;
          updated_at?: string;
        };
        Update: {
          admin_response?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          category?: string;
          course_id?: string | null;
          created_at?: string;
          description?: string;
          follow_up?: string | null;
          follow_up_at?: string | null;
          id?: string;
          raised_by?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['complaint_status'];
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'complaints_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'complaints_raised_by_fkey';
            columns: ['raised_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'complaints_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      course_teachers: {
        Row: {
          course_id: string;
          created_at: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          created_at?: string;
          teacher_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'course_teachers_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'course_teachers_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      courses: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_archived: boolean;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_archived?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          course_id: string;
          created_at: string;
          enrolled_at: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          created_at?: string;
          enrolled_at?: string;
          student_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          enrolled_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'enrollments_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'enrollments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          must_change_password: boolean;
          role: Database['public']['Enums']['user_role'];
          roll_no: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          must_change_password?: boolean;
          role: Database['public']['Enums']['user_role'];
          roll_no?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          must_change_password?: boolean;
          role?: Database['public']['Enums']['user_role'];
          roll_no?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_answers: {
        Row: {
          correct_option_ids: string[];
          created_at: string;
          question_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct_option_ids: string[];
          created_at?: string;
          question_id: string;
        };
        Update: {
          correct_option_ids?: string[];
          created_at?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quiz_answers_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: true;
            referencedRelation: 'quiz_questions';
            referencedColumns: ['id'];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          answers: NonNullable<Json>;
          created_at: string;
          expires_at: string;
          id: string;
          question_order: string[];
          quiz_id: string;
          score: number | null;
          started_at: string;
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answers?: NonNullable<Json>;
          created_at?: string;
          expires_at: string;
          id?: string;
          question_order?: string[];
          quiz_id: string;
          score?: number | null;
          started_at?: string;
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          created_at?: string;
          expires_at?: string;
          id?: string;
          question_order?: string[];
          quiz_id?: string;
          score?: number | null;
          started_at?: string;
          student_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quiz_attempts_quiz_id_fkey';
            columns: ['quiz_id'];
            isOneToOne: false;
            referencedRelation: 'quizzes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quiz_attempts_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      quiz_questions: {
        Row: {
          created_at: string;
          id: string;
          marks: number;
          options: NonNullable<Json>;
          position: number;
          prompt: string;
          quiz_id: string;
          type: Database['public']['Enums']['question_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          marks?: number;
          options: NonNullable<Json>;
          position: number;
          prompt: string;
          quiz_id: string;
          type: Database['public']['Enums']['question_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          marks?: number;
          options?: NonNullable<Json>;
          position?: number;
          prompt?: string;
          quiz_id?: string;
          type?: Database['public']['Enums']['question_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quiz_questions_quiz_id_fkey';
            columns: ['quiz_id'];
            isOneToOne: false;
            referencedRelation: 'quizzes';
            referencedColumns: ['id'];
          },
        ];
      };
      quizzes: {
        Row: {
          closes_at: string;
          course_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_published: boolean;
          opens_at: string;
          shuffle_questions: boolean;
          time_limit_minutes: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          closes_at: string;
          course_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_published?: boolean;
          opens_at: string;
          shuffle_questions?: boolean;
          time_limit_minutes: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          closes_at?: string;
          course_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_published?: boolean;
          opens_at?: string;
          shuffle_questions?: boolean;
          time_limit_minutes?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quizzes_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quizzes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      resources: {
        Row: {
          course_id: string;
          created_at: string;
          description: string | null;
          file_name: string;
          file_path: string;
          id: string;
          mime_type: string;
          size_bytes: number;
          title: string;
          uploaded_by: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          created_at?: string;
          description?: string | null;
          file_name: string;
          file_path: string;
          id?: string;
          mime_type: string;
          size_bytes: number;
          title: string;
          uploaded_by: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          description?: string | null;
          file_name?: string;
          file_path?: string;
          id?: string;
          mime_type?: string;
          size_bytes?: number;
          title?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resources_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          assignment_id: string;
          created_at: string;
          feedback: string | null;
          file_name: string | null;
          file_path: string | null;
          graded_at: string | null;
          graded_by: string | null;
          id: string;
          is_late: boolean;
          marks_obtained: number | null;
          student_id: string;
          submitted_at: string;
          text_answer: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          feedback?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          is_late?: boolean;
          marks_obtained?: number | null;
          student_id: string;
          submitted_at?: string;
          text_answer?: string | null;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          feedback?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          is_late?: boolean;
          marks_obtained?: number | null;
          student_id?: string;
          submitted_at?: string;
          text_answer?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_graded_by_fkey';
            columns: ['graded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_student_marks: {
        Row: {
          course_id: string | null;
          graded_at: string | null;
          item_id: string | null;
          kind: string | null;
          max: number | null;
          obtained: number | null;
          source_id: string | null;
          student_id: string | null;
          title: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      can_view_profile: { Args: { target_profile_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_course_member: { Args: { target_course_id: string }; Returns: boolean };
      is_enrolled: { Args: { target_course_id: string }; Returns: boolean };
      quiz_has_attempts: { Args: { target_quiz_id: string }; Returns: boolean };
      revoke_user_sessions: {
        Args: { keep_session_id?: string; target_user_id: string };
        Returns: undefined;
      };
      teaches: { Args: { target_course_id: string }; Returns: boolean };
    };
    Enums: {
      complaint_status: 'open' | 'in_review' | 'resolved' | 'rejected';
      question_type: 'mcq_single' | 'mcq_multi' | 'true_false';
      user_role: 'admin' | 'teacher' | 'student';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      complaint_status: ['open', 'in_review', 'resolved', 'rejected'],
      question_type: ['mcq_single', 'mcq_multi', 'true_false'],
      user_role: ['admin', 'teacher', 'student'],
    },
  },
} as const;
