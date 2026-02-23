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
      casas: {
        Row: {
          created_at: string
          id: string
          nome: string
          sigla: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          sigla: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          sigla?: string
          tipo?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          created_at: string
          data: string
          deposito: string | null
          deposito_destino: string | null
          deposito_origem: string | null
          id: string
          observacao: string | null
          perfume_id: string
          perfume_nome: string
          quantidade: number
          registrado_por: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data?: string
          deposito?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          id?: string
          observacao?: string | null
          perfume_id: string
          perfume_nome: string
          quantidade?: number
          registrado_por?: string
          tipo: string
        }
        Update: {
          created_at?: string
          data?: string
          deposito?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          id?: string
          observacao?: string | null
          perfume_id?: string
          perfume_nome?: string
          quantidade?: number
          registrado_por?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfumes: {
        Row: {
          casa_sigla: string
          codigo: string
          concentracao: string
          created_at: string
          custo: number
          estoque_amazonas: number
          estoque_casa: number
          estoque_minimo: number
          estoque_sumauma: number
          id: string
          marca: string
          nome: string
          preco_venda: number
          tamanho: string
          tipo: string
          updated_at: string
          volume: number
        }
        Insert: {
          casa_sigla: string
          codigo: string
          concentracao: string
          created_at?: string
          custo?: number
          estoque_amazonas?: number
          estoque_casa?: number
          estoque_minimo?: number
          estoque_sumauma?: number
          id?: string
          marca: string
          nome: string
          preco_venda?: number
          tamanho: string
          tipo: string
          updated_at?: string
          volume: number
        }
        Update: {
          casa_sigla?: string
          codigo?: string
          concentracao?: string
          created_at?: string
          custo?: number
          estoque_amazonas?: number
          estoque_casa?: number
          estoque_minimo?: number
          estoque_sumauma?: number
          id?: string
          marca?: string
          nome?: string
          preco_venda?: number
          tamanho?: string
          tipo?: string
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "perfumes_casa_sigla_fkey"
            columns: ["casa_sigla"]
            isOneToOne: false
            referencedRelation: "casas"
            referencedColumns: ["sigla"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          loja: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja?: string
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      testers: {
        Row: {
          created_at: string
          custo: number
          deposito: string
          id: string
          marca: string
          perfume_id: string
          perfume_nome: string
          quantidade: number
          registrado_por: string
        }
        Insert: {
          created_at?: string
          custo?: number
          deposito: string
          id?: string
          marca: string
          perfume_id: string
          perfume_nome: string
          quantidade?: number
          registrado_por?: string
        }
        Update: {
          created_at?: string
          custo?: number
          deposito?: string
          id?: string
          marca?: string
          perfume_id?: string
          perfume_nome?: string
          quantidade?: number
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "testers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
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
      venda_pagamentos: {
        Row: {
          bandeira: string
          created_at: string
          grupo_venda: string
          id: string
          tipo_pagamento: string
          valor: number
        }
        Insert: {
          bandeira?: string
          created_at?: string
          grupo_venda: string
          id?: string
          tipo_pagamento?: string
          valor?: number
        }
        Update: {
          bandeira?: string
          created_at?: string
          grupo_venda?: string
          id?: string
          tipo_pagamento?: string
          valor?: number
        }
        Relationships: []
      }
      vendas: {
        Row: {
          bandeira: string
          created_at: string
          data: string
          deposito: string
          desconto: number
          grupo_venda: string | null
          id: string
          observacao: string
          perfume_id: string
          perfume_nome: string
          preco_unitario: number
          quantidade: number
          registrado_por: string
          tipo_ajuste: string
          tipo_pagamento: string
          total: number
          vendedora: string
        }
        Insert: {
          bandeira?: string
          created_at?: string
          data?: string
          deposito: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
          observacao?: string
          perfume_id: string
          perfume_nome: string
          preco_unitario?: number
          quantidade?: number
          registrado_por?: string
          tipo_ajuste?: string
          tipo_pagamento?: string
          total?: number
          vendedora?: string
        }
        Update: {
          bandeira?: string
          created_at?: string
          data?: string
          deposito?: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
          observacao?: string
          perfume_id?: string
          perfume_nome?: string
          preco_unitario?: number
          quantidade?: number
          registrado_por?: string
          tipo_ajuste?: string
          tipo_pagamento?: string
          total?: number
          vendedora?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedoras: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_master_exists: { Args: never; Returns: boolean }
      claim_first_master: { Args: { p_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master" | "vendedor"
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
      app_role: ["master", "vendedor"],
    },
  },
} as const
