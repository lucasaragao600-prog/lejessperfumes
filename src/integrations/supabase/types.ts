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
      ajuste_auditoria: {
        Row: {
          created_at: string
          deposito: string
          diferenca: number
          id: string
          motivo: string
          produto_id: string
          produto_nome: string
          quantidade_anterior: number
          quantidade_nova: number
          registrado_por: string
          unidade_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deposito: string
          diferenca: number
          id?: string
          motivo: string
          produto_id: string
          produto_nome: string
          quantidade_anterior: number
          quantidade_nova: number
          registrado_por: string
          unidade_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deposito?: string
          diferenca?: number
          id?: string
          motivo?: string
          produto_id?: string
          produto_nome?: string
          quantidade_anterior?: number
          quantidade_nova?: number
          registrado_por?: string
          unidade_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ajuste_auditoria_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_estoque: {
        Row: {
          criado_em: string
          id: string
          loja: string
          produto_id: string
          resolvido_em: string | null
          status: string
          tipo: string
          unidade_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          loja: string
          produto_id: string
          resolvido_em?: string | null
          status?: string
          tipo: string
          unidade_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          loja?: string
          produto_id?: string
          resolvido_em?: string | null
          status?: string
          tipo?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "alertas_estoque_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          ip: string
          unidade_id: string | null
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          ip?: string
          unidade_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          ip?: string
          unidade_id?: string | null
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_importacao: {
        Row: {
          arquivo_nome: string
          created_at: string
          data: string
          id: string
          resumo: string
          total_alterados: number
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          arquivo_nome?: string
          created_at?: string
          data?: string
          id?: string
          resumo?: string
          total_alterados?: number
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          arquivo_nome?: string
          created_at?: string
          data?: string
          id?: string
          resumo?: string
          total_alterados?: number
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: []
      }
      caixa_config_unidade: {
        Row: {
          configurado_por: string | null
          configurado_por_nome: string
          created_at: string
          diferenca_tolerada: number
          exige_motivo_sangria: boolean
          exige_valor_abertura: boolean
          id: string
          impressora_nome: string
          limite_sangria: number
          observacao: string
          permite_sangria: boolean
          permite_suprimento: boolean
          unidade_id: string
          updated_at: string
          valor_abertura_padrao: number
        }
        Insert: {
          configurado_por?: string | null
          configurado_por_nome?: string
          created_at?: string
          diferenca_tolerada?: number
          exige_motivo_sangria?: boolean
          exige_valor_abertura?: boolean
          id?: string
          impressora_nome?: string
          limite_sangria?: number
          observacao?: string
          permite_sangria?: boolean
          permite_suprimento?: boolean
          unidade_id: string
          updated_at?: string
          valor_abertura_padrao?: number
        }
        Update: {
          configurado_por?: string | null
          configurado_por_nome?: string
          created_at?: string
          diferenca_tolerada?: number
          exige_motivo_sangria?: boolean
          exige_valor_abertura?: boolean
          id?: string
          impressora_nome?: string
          limite_sangria?: number
          observacao?: string
          permite_sangria?: boolean
          permite_suprimento?: boolean
          unidade_id?: string
          updated_at?: string
          valor_abertura_padrao?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_config_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_movimentacoes: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          registrado_por: string
          sessao_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          registrado_por?: string
          sessao_id: string
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          registrado_por?: string
          sessao_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentacoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_sessoes: {
        Row: {
          aberto_em: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          loja: string
          observacao: string | null
          operador_id: string
          operador_nome: string
          status: string
          unidade_id: string | null
          valor_abertura: number
          valor_esperado: number | null
          valor_fechamento: number | null
        }
        Insert: {
          aberto_em?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          loja: string
          observacao?: string | null
          operador_id: string
          operador_nome?: string
          status?: string
          unidade_id?: string | null
          valor_abertura?: number
          valor_esperado?: number | null
          valor_fechamento?: number | null
        }
        Update: {
          aberto_em?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          loja?: string
          observacao?: string | null
          operador_id?: string
          operador_nome?: string
          status?: string
          unidade_id?: string | null
          valor_abertura?: number
          valor_esperado?: number | null
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sessoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
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
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          genero: string | null
          id: string
          logradouro: string | null
          nome: string
          nome_social: string | null
          numero: string | null
          observacoes: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          whatsapp?: string | null
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
      configuracoes_fiscais: {
        Row: {
          ambiente: string
          bairro: string
          cep: string
          certificado_digital_url: string
          certificado_senha: string
          cidade: string
          cnpj: string
          complemento: string
          csc_id: string
          csc_token: string
          endereco: string
          id: string
          inscricao_estadual: string
          logo_url: string
          nome_fantasia: string
          numero: string
          proximo_numero_nfce: number
          razao_social: string
          regime_tributario: string
          serie_nfce: number
          telefone: string
          uf: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          bairro?: string
          cep?: string
          certificado_digital_url?: string
          certificado_senha?: string
          cidade?: string
          cnpj?: string
          complemento?: string
          csc_id?: string
          csc_token?: string
          endereco?: string
          id?: string
          inscricao_estadual?: string
          logo_url?: string
          nome_fantasia?: string
          numero?: string
          proximo_numero_nfce?: number
          razao_social?: string
          regime_tributario?: string
          serie_nfce?: number
          telefone?: string
          uf?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          bairro?: string
          cep?: string
          certificado_digital_url?: string
          certificado_senha?: string
          cidade?: string
          cnpj?: string
          complemento?: string
          csc_id?: string
          csc_token?: string
          endereco?: string
          id?: string
          inscricao_estadual?: string
          logo_url?: string
          nome_fantasia?: string
          numero?: string
          proximo_numero_nfce?: number
          razao_social?: string
          regime_tributario?: string
          serie_nfce?: number
          telefone?: string
          uf?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_fiscais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      credito_cliente: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          saldo: number
          updated_at: string
          validade: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          validade?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credito_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      credito_movimentos: {
        Row: {
          cliente_id: string
          created_at: string
          devolucao_id: string | null
          grupo_venda: string | null
          id: string
          observacao: string
          registrado_por: string | null
          registrado_por_nome: string
          saldo_apos: number
          tipo: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          devolucao_id?: string | null
          grupo_venda?: string | null
          id?: string
          observacao?: string
          registrado_por?: string | null
          registrado_por_nome?: string
          saldo_apos: number
          tipo: string
          unidade_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          devolucao_id?: string | null
          grupo_venda?: string | null
          id?: string
          observacao?: string
          registrado_por?: string | null
          registrado_por_nome?: string
          saldo_apos?: number
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "credito_movimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credito_movimentos_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "devolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credito_movimentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_conferencias: {
        Row: {
          acao: string
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string
          created_at: string
          decisao_obs: string
          diferenca: number
          executado_por: string | null
          executado_por_nome: string
          frasco_id: string
          id: string
          justificativa: string
          saldo_fisico: number
          saldo_teorico: number
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          acao?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          created_at?: string
          decisao_obs?: string
          diferenca: number
          executado_por?: string | null
          executado_por_nome?: string
          frasco_id: string
          id?: string
          justificativa?: string
          saldo_fisico: number
          saldo_teorico: number
          status: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          acao?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          created_at?: string
          decisao_obs?: string
          diferenca?: number
          executado_por?: string | null
          executado_por_nome?: string
          frasco_id?: string
          id?: string
          justificativa?: string
          saldo_fisico?: number
          saldo_teorico?: number
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_conferencias_frasco_id_fkey"
            columns: ["frasco_id"]
            isOneToOne: false
            referencedRelation: "decant_frascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_conferencias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_estoque: {
        Row: {
          created_at: string
          custo_unit: number
          id: string
          lote_chave: string | null
          lote_id: string | null
          quantidade: number
          sku_id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unit?: number
          id?: string
          lote_chave?: string | null
          lote_id?: string | null
          quantidade?: number
          sku_id: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unit?: number
          id?: string
          lote_chave?: string | null
          lote_id?: string | null
          quantidade?: number
          sku_id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_estoque_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_estoque_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_estoque_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_fechados_mov: {
        Row: {
          created_at: string
          data_operacao: string
          frasco_id: string | null
          id: string
          idempotency_key: string | null
          observacao: string
          produto_id: string
          quantidade: number
          responsavel: string
          saldo_apos: number
          tipo: string
          unidade_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          data_operacao?: string
          frasco_id?: string | null
          id?: string
          idempotency_key?: string | null
          observacao?: string
          produto_id: string
          quantidade: number
          responsavel?: string
          saldo_apos: number
          tipo: string
          unidade_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          data_operacao?: string
          frasco_id?: string | null
          id?: string
          idempotency_key?: string | null
          observacao?: string
          produto_id?: string
          quantidade?: number
          responsavel?: string
          saldo_apos?: number
          tipo?: string
          unidade_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_fechados_mov_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_fechados_mov_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_fechados_mov_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_fechados_saldo: {
        Row: {
          produto_id: string
          quantidade: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          produto_id: string
          quantidade?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          produto_id?: string
          quantidade?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_fechados_saldo_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_fechados_saldo_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_fechados_saldo_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_frascos: {
        Row: {
          aberto_em: string
          aberto_por: string | null
          aberto_por_nome: string
          codigo: string
          created_at: string
          custo: number
          custo_ml: number
          id: string
          idempotency_key: string | null
          lote_fabricante: string
          observacao: string
          produto_id: string
          rendimento_util: number
          responsavel: string
          status: string
          unidade_id: string
          updated_at: string
          validade: string | null
          volume_inicial_ml: number
          volume_nominal_ml: number
        }
        Insert: {
          aberto_em?: string
          aberto_por?: string | null
          aberto_por_nome?: string
          codigo: string
          created_at?: string
          custo: number
          custo_ml: number
          id?: string
          idempotency_key?: string | null
          lote_fabricante?: string
          observacao?: string
          produto_id: string
          rendimento_util?: number
          responsavel?: string
          status?: string
          unidade_id: string
          updated_at?: string
          validade?: string | null
          volume_inicial_ml: number
          volume_nominal_ml: number
        }
        Update: {
          aberto_em?: string
          aberto_por?: string | null
          aberto_por_nome?: string
          codigo?: string
          created_at?: string
          custo?: number
          custo_ml?: number
          id?: string
          idempotency_key?: string | null
          lote_fabricante?: string
          observacao?: string
          produto_id?: string
          rendimento_util?: number
          responsavel?: string
          status?: string
          unidade_id?: string
          updated_at?: string
          validade?: string | null
          volume_inicial_ml?: number
          volume_nominal_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_frascos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_frascos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_frascos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_inventarios: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string
          contado: number
          created_at: string
          diferenca: number
          executado_por: string | null
          executado_por_nome: string
          id: string
          justificativa: string
          saldo_sistema: number
          sku_id: string
          status: string
          unidade_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          contado: number
          created_at?: string
          diferenca: number
          executado_por?: string | null
          executado_por_nome?: string
          id?: string
          justificativa?: string
          saldo_sistema: number
          sku_id: string
          status: string
          unidade_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          contado?: number
          created_at?: string
          diferenca?: number
          executado_por?: string | null
          executado_por_nome?: string
          id?: string
          justificativa?: string
          saldo_sistema?: number
          sku_id?: string
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_inventarios_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_inventarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_lote_eventos: {
        Row: {
          created_at: string
          dados: Json
          evento: string
          id: string
          lote_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          evento: string
          id?: string
          lote_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          dados?: Json
          evento?: string
          id?: string
          lote_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_lote_eventos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_lote_frascos: {
        Row: {
          custo_ml: number
          frasco_id: string
          id: string
          lote_id: string
          ml_consumido: number | null
          ml_reservado: number
          ordem_fifo: number
        }
        Insert: {
          custo_ml?: number
          frasco_id: string
          id?: string
          lote_id: string
          ml_consumido?: number | null
          ml_reservado: number
          ordem_fifo?: number
        }
        Update: {
          custo_ml?: number
          frasco_id?: string
          id?: string
          lote_id?: string
          ml_consumido?: number | null
          ml_reservado?: number
          ordem_fifo?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_lote_frascos_frasco_id_fkey"
            columns: ["frasco_id"]
            isOneToOne: false
            referencedRelation: "decant_frascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_lote_frascos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_lote_itens: {
        Row: {
          custo_insumo_unit: number
          custo_unitario: number
          diferenca: number | null
          id: string
          justificativa: string
          lote_id: string
          motivo: string
          qtd_fisica: number | null
          qtd_planejada: number
          sku_id: string
          tamanho_id: string
          volume_ml: number
        }
        Insert: {
          custo_insumo_unit?: number
          custo_unitario?: number
          diferenca?: number | null
          id?: string
          justificativa?: string
          lote_id: string
          motivo?: string
          qtd_fisica?: number | null
          qtd_planejada: number
          sku_id: string
          tamanho_id: string
          volume_ml: number
        }
        Update: {
          custo_insumo_unit?: number
          custo_unitario?: number
          diferenca?: number | null
          id?: string
          justificativa?: string
          lote_id?: string
          motivo?: string
          qtd_fisica?: number | null
          qtd_planejada?: number
          sku_id?: string
          tamanho_id?: string
          volume_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_lote_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_lote_itens_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_lote_itens_tamanho_id_fkey"
            columns: ["tamanho_id"]
            isOneToOne: false
            referencedRelation: "decant_tamanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_lotes: {
        Row: {
          codigo: string
          concluido_em: string | null
          conferido_em: string | null
          conferido_por: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string
          custo_insumos: number
          custo_liquido: number
          custo_total: number
          data_producao: string
          entrada_estoque_pendente: boolean
          fora_fifo: boolean
          id: string
          idempotency_key: string | null
          ml_consumido: number
          motivo_cancelamento: string
          observacao: string
          perdas_ml: number
          produto_id: string
          responsavel_conferencia: string
          responsavel_producao: string
          status: string
          unidade_id: string
          updated_at: string
          volume_total_ml: number
        }
        Insert: {
          codigo: string
          concluido_em?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          custo_insumos?: number
          custo_liquido?: number
          custo_total?: number
          data_producao?: string
          entrada_estoque_pendente?: boolean
          fora_fifo?: boolean
          id?: string
          idempotency_key?: string | null
          ml_consumido?: number
          motivo_cancelamento?: string
          observacao?: string
          perdas_ml?: number
          produto_id: string
          responsavel_conferencia?: string
          responsavel_producao?: string
          status?: string
          unidade_id: string
          updated_at?: string
          volume_total_ml: number
        }
        Update: {
          codigo?: string
          concluido_em?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          custo_insumos?: number
          custo_liquido?: number
          custo_total?: number
          data_producao?: string
          entrada_estoque_pendente?: boolean
          fora_fifo?: boolean
          id?: string
          idempotency_key?: string | null
          ml_consumido?: number
          motivo_cancelamento?: string
          observacao?: string
          perdas_ml?: number
          produto_id?: string
          responsavel_conferencia?: string
          responsavel_producao?: string
          status?: string
          unidade_id?: string
          updated_at?: string
          volume_total_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_lotes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_lotes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_ml_ledger: {
        Row: {
          created_at: string
          frasco_id: string
          id: string
          idempotency_key: string | null
          ml: number
          motivo: string
          referencia_id: string | null
          referencia_tipo: string
          saldo_apos: number
          tipo: string
          unidade_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          frasco_id: string
          id?: string
          idempotency_key?: string | null
          ml: number
          motivo?: string
          referencia_id?: string | null
          referencia_tipo?: string
          saldo_apos: number
          tipo: string
          unidade_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          frasco_id?: string
          id?: string
          idempotency_key?: string | null
          ml?: number
          motivo?: string
          referencia_id?: string | null
          referencia_tipo?: string
          saldo_apos?: number
          tipo?: string
          unidade_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_ml_ledger_frasco_id_fkey"
            columns: ["frasco_id"]
            isOneToOne: false
            referencedRelation: "decant_frascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_ml_ledger_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_perdas: {
        Row: {
          absorvida_custo: boolean
          chave: string
          created_at: string
          custo_ml: number
          frasco_id: string | null
          id: string
          justificativa: string
          lote_id: string | null
          ml: number
          origem: string
          produto_id: string
          sku_id: string | null
          tipo: string
          unidade_id: string
          usuario_id: string | null
          usuario_nome: string
          valor: number
        }
        Insert: {
          absorvida_custo?: boolean
          chave: string
          created_at?: string
          custo_ml?: number
          frasco_id?: string | null
          id?: string
          justificativa?: string
          lote_id?: string | null
          ml: number
          origem: string
          produto_id: string
          sku_id?: string | null
          tipo: string
          unidade_id: string
          usuario_id?: string | null
          usuario_nome?: string
          valor?: number
        }
        Update: {
          absorvida_custo?: boolean
          chave?: string
          created_at?: string
          custo_ml?: number
          frasco_id?: string | null
          id?: string
          justificativa?: string
          lote_id?: string | null
          ml?: number
          origem?: string
          produto_id?: string
          sku_id?: string | null
          tipo?: string
          unidade_id?: string
          usuario_id?: string | null
          usuario_nome?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_perdas_frasco_id_fkey"
            columns: ["frasco_id"]
            isOneToOne: false
            referencedRelation: "decant_frascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_perdas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_perdas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_perdas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_perdas_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_perdas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_perfume_config: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          created_at: string
          elegivel: boolean
          estoque_minimo_ml: number
          produto_id: string
          rendimento_util: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          elegivel?: boolean
          estoque_minimo_ml?: number
          produto_id: string
          rendimento_util?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          elegivel?: boolean
          estoque_minimo_ml?: number
          produto_id?: string
          rendimento_util?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_perfume_config_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_perfume_config_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      decant_quarentena: {
        Row: {
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          decidido_por_nome: string
          decisao_obs: string
          id: string
          lacrado: boolean | null
          motivo: string
          quantidade: number
          registrado_por: string | null
          registrado_por_nome: string
          sku_id: string
          status: string
          unidade_id: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decidido_por_nome?: string
          decisao_obs?: string
          id?: string
          lacrado?: boolean | null
          motivo?: string
          quantidade: number
          registrado_por?: string | null
          registrado_por_nome?: string
          sku_id: string
          status?: string
          unidade_id: string
          venda_id: string
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decidido_por_nome?: string
          decisao_obs?: string
          id?: string
          lacrado?: boolean | null
          motivo?: string
          quantidade?: number
          registrado_por?: string | null
          registrado_por_nome?: string
          sku_id?: string
          status?: string
          unidade_id?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_quarentena_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_quarentena_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_quarentena_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "decant_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_sku_unidade: {
        Row: {
          estoque_ideal: number
          estoque_minimo: number
          sku_id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          estoque_ideal?: number
          estoque_minimo?: number
          sku_id: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          estoque_ideal?: number
          estoque_minimo?: number
          sku_id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_sku_unidade_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_sku_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_skus: {
        Row: {
          ativo: boolean
          created_at: string
          custo_medio: number
          id: string
          preco_venda: number
          produto_id: string
          sku: string
          tamanho_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_medio?: number
          id?: string
          preco_venda?: number
          produto_id: string
          sku: string
          tamanho_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_medio?: number
          id?: string
          preco_venda?: number
          produto_id?: string
          sku?: string
          tamanho_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_skus_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_skus_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_skus_tamanho_id_fkey"
            columns: ["tamanho_id"]
            isOneToOne: false
            referencedRelation: "decant_tamanhos"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_tamanhos: {
        Row: {
          ativo: boolean
          created_at: string
          custo_adicional: number
          custo_atomizador: number
          custo_embalagem: number
          custo_etiqueta: number
          custo_frasco: number
          custo_mao_obra: number
          frasco_descricao: string
          id: string
          nome: string
          updated_at: string
          volume_ml: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_adicional?: number
          custo_atomizador?: number
          custo_embalagem?: number
          custo_etiqueta?: number
          custo_frasco?: number
          custo_mao_obra?: number
          frasco_descricao?: string
          id?: string
          nome?: string
          updated_at?: string
          volume_ml: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_adicional?: number
          custo_atomizador?: number
          custo_embalagem?: number
          custo_etiqueta?: number
          custo_frasco?: number
          custo_mao_obra?: number
          frasco_descricao?: string
          id?: string
          nome?: string
          updated_at?: string
          volume_ml?: number
        }
        Relationships: []
      }
      decant_transf_itens: {
        Row: {
          custo_unit: number
          diferenca: number | null
          frasco_id: string | null
          id: string
          produto_id: string | null
          qtd_recebida: number | null
          quantidade: number
          sku_id: string | null
          tipo: string
          transferencia_id: string
        }
        Insert: {
          custo_unit?: number
          diferenca?: number | null
          frasco_id?: string | null
          id?: string
          produto_id?: string | null
          qtd_recebida?: number | null
          quantidade: number
          sku_id?: string | null
          tipo: string
          transferencia_id: string
        }
        Update: {
          custo_unit?: number
          diferenca?: number | null
          frasco_id?: string | null
          id?: string
          produto_id?: string | null
          qtd_recebida?: number | null
          quantidade?: number
          sku_id?: string | null
          tipo?: string
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_transf_itens_frasco_id_fkey"
            columns: ["frasco_id"]
            isOneToOne: false
            referencedRelation: "decant_frascos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_transf_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_transf_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "decant_transf_itens_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_transf_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "decant_transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_transferencias: {
        Row: {
          codigo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string
          destino_id: string
          enviado_em: string | null
          finalizado_em: string | null
          id: string
          idempotency_key: string | null
          observacao: string
          origem_id: string
          recebido_em: string | null
          recebido_por_nome: string
          resolucao: string
          separado_em: string | null
          status: string
          transportador: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino_id: string
          enviado_em?: string | null
          finalizado_em?: string | null
          id?: string
          idempotency_key?: string | null
          observacao?: string
          origem_id: string
          recebido_em?: string | null
          recebido_por_nome?: string
          resolucao?: string
          separado_em?: string | null
          status?: string
          transportador?: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino_id?: string
          enviado_em?: string | null
          finalizado_em?: string | null
          id?: string
          idempotency_key?: string | null
          observacao?: string
          origem_id?: string
          recebido_em?: string | null
          recebido_por_nome?: string
          resolucao?: string
          separado_em?: string | null
          status?: string
          transportador?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_transferencias_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_transferencias_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_un_ledger: {
        Row: {
          canal: string
          created_at: string
          custo_unit: number
          destino_unidade_id: string | null
          id: string
          lote_id: string | null
          motivo: string
          origem_unidade_id: string | null
          preco_unit: number | null
          quantidade: number
          referencia_id: string | null
          referencia_tipo: string
          saldo_apos: number
          sku_id: string
          tipo: string
          unidade_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          canal?: string
          created_at?: string
          custo_unit?: number
          destino_unidade_id?: string | null
          id?: string
          lote_id?: string | null
          motivo?: string
          origem_unidade_id?: string | null
          preco_unit?: number | null
          quantidade: number
          referencia_id?: string | null
          referencia_tipo?: string
          saldo_apos: number
          sku_id: string
          tipo: string
          unidade_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          canal?: string
          created_at?: string
          custo_unit?: number
          destino_unidade_id?: string | null
          id?: string
          lote_id?: string | null
          motivo?: string
          origem_unidade_id?: string | null
          preco_unit?: number | null
          quantidade?: number
          referencia_id?: string | null
          referencia_tipo?: string
          saldo_apos?: number
          sku_id?: string
          tipo?: string
          unidade_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_un_ledger_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_un_ledger_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_un_ledger_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_venda_pagamentos: {
        Row: {
          created_at: string
          forma: string
          grupo_venda: string
          id: string
          unidade_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          forma: string
          grupo_venda: string
          id?: string
          unidade_id: string
          valor: number
        }
        Update: {
          created_at?: string
          forma?: string
          grupo_venda?: string
          id?: string
          unidade_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "decant_venda_pagamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      decant_vendas: {
        Row: {
          canal: string
          cancelada_em: string | null
          cliente_id: string | null
          created_at: string
          custo_unit: number
          grupo_venda: string
          id: string
          idempotency_key: string | null
          lote_producao_id: string | null
          motivo_cancelamento: string
          preco_unit: number
          qtd_devolvida: number
          quantidade: number
          sessao_caixa_id: string | null
          sku_id: string
          status: string
          total: number
          unidade_id: string
          usuario_id: string | null
          usuario_nome: string
          vendedora: string
        }
        Insert: {
          canal: string
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          custo_unit?: number
          grupo_venda: string
          id?: string
          idempotency_key?: string | null
          lote_producao_id?: string | null
          motivo_cancelamento?: string
          preco_unit: number
          qtd_devolvida?: number
          quantidade: number
          sessao_caixa_id?: string | null
          sku_id: string
          status: string
          total: number
          unidade_id: string
          usuario_id?: string | null
          usuario_nome?: string
          vendedora?: string
        }
        Update: {
          canal?: string
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          custo_unit?: number
          grupo_venda?: string
          id?: string
          idempotency_key?: string | null
          lote_producao_id?: string | null
          motivo_cancelamento?: string
          preco_unit?: number
          qtd_devolvida?: number
          quantidade?: number
          sessao_caixa_id?: string | null
          sku_id?: string
          status?: string
          total?: number
          unidade_id?: string
          usuario_id?: string | null
          usuario_nome?: string
          vendedora?: string
        }
        Relationships: [
          {
            foreignKeyName: "decant_vendas_lote_producao_id_fkey"
            columns: ["lote_producao_id"]
            isOneToOne: false
            referencedRelation: "decant_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_vendas_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "decant_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decant_vendas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_itens: {
        Row: {
          created_at: string
          destino: string
          devolucao_id: string
          id: string
          produto_id: string
          produto_nome: string
          quantidade: number
          updated_at: string
          valor_unitario: number
          venda_id: string
          volta_ao_estoque: boolean
        }
        Insert: {
          created_at?: string
          destino?: string
          devolucao_id: string
          id?: string
          produto_id: string
          produto_nome?: string
          quantidade: number
          updated_at?: string
          valor_unitario?: number
          venda_id: string
          volta_ao_estoque?: boolean
        }
        Update: {
          created_at?: string
          destino?: string
          devolucao_id?: string
          id?: string
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          updated_at?: string
          valor_unitario?: number
          venda_id?: string
          volta_ao_estoque?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_itens_devolucao_id_fkey"
            columns: ["devolucao_id"]
            isOneToOne: false
            referencedRelation: "devolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "devolucao_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucao_sequencias: {
        Row: {
          ano: number
          ultimo: number
          unidade_id: string
        }
        Insert: {
          ano: number
          ultimo?: number
          unidade_id: string
        }
        Update: {
          ano?: number
          ultimo?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolucao_sequencias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      devolucoes: {
        Row: {
          ano: number
          aprovado_por: string | null
          cliente_id: string | null
          created_at: string
          diferenca: number
          fora_do_prazo: boolean
          forma_reembolso: string | null
          grupo_venda_origem: string
          grupo_venda_troca: string | null
          id: string
          motivo: string
          numero: string
          registrado_por: string | null
          registrado_por_nome: string
          sessao_caixa_id: string | null
          status: string
          tipo: string
          unidade_id: string
          updated_at: string
          valor_total: number
          valor_troca: number
        }
        Insert: {
          ano: number
          aprovado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          diferenca?: number
          fora_do_prazo?: boolean
          forma_reembolso?: string | null
          grupo_venda_origem: string
          grupo_venda_troca?: string | null
          id?: string
          motivo: string
          numero: string
          registrado_por?: string | null
          registrado_por_nome?: string
          sessao_caixa_id?: string | null
          status?: string
          tipo: string
          unidade_id: string
          updated_at?: string
          valor_total?: number
          valor_troca?: number
        }
        Update: {
          ano?: number
          aprovado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          diferenca?: number
          fora_do_prazo?: boolean
          forma_reembolso?: string | null
          grupo_venda_origem?: string
          grupo_venda_troca?: string | null
          id?: string
          motivo?: string
          numero?: string
          registrado_por?: string | null
          registrado_por_nome?: string
          sessao_caixa_id?: string | null
          status?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
          valor_total?: number
          valor_troca?: number
        }
        Relationships: [
          {
            foreignKeyName: "devolucoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_sessao_caixa_id_fkey"
            columns: ["sessao_caixa_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolucoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_unidade: {
        Row: {
          created_at: string
          id: string
          implantacao_id: string | null
          ip: string
          local: string
          marca: string
          modelo: string
          numero_serie: string
          observacao: string
          patrimonio: string
          status: string
          tipo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          implantacao_id?: string | null
          ip?: string
          local?: string
          marca?: string
          modelo?: string
          numero_serie?: string
          observacao?: string
          patrimonio?: string
          status?: string
          tipo: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          implantacao_id?: string | null
          ip?: string
          local?: string
          marca?: string
          modelo?: string
          numero_serie?: string
          observacao?: string
          patrimonio?: string
          status?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_unidade_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_unidades: {
        Row: {
          created_at: string
          data_ultima_entrada: string | null
          data_ultima_saida: string | null
          estoque_maximo: number | null
          estoque_minimo: number
          id: string
          produto_id: string
          quantidade: number
          quantidade_reservada: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_ultima_entrada?: string | null
          data_ultima_saida?: string | null
          estoque_maximo?: number | null
          estoque_minimo?: number
          id?: string
          produto_id: string
          quantidade?: number
          quantidade_reservada?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_ultima_entrada?: string | null
          data_ultima_saida?: string | null
          estoque_maximo?: number | null
          estoque_minimo?: number
          id?: string
          produto_id?: string
          quantidade?: number
          quantidade_reservada?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_unidades_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_unidades_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "estoque_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_checklist: {
        Row: {
          anexo_url: string
          created_at: string
          data_conclusao: string | null
          data_prevista: string | null
          etapa_chave: string
          id: string
          implantacao_id: string
          item: string
          observacao: string
          ordem: number
          responsavel_id: string | null
          responsavel_nome: string
          status: string
          updated_at: string
        }
        Insert: {
          anexo_url?: string
          created_at?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          etapa_chave?: string
          id?: string
          implantacao_id: string
          item: string
          observacao?: string
          ordem?: number
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          updated_at?: string
        }
        Update: {
          anexo_url?: string
          created_at?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          etapa_chave?: string
          id?: string
          implantacao_id?: string
          item?: string
          observacao?: string
          ordem?: number
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacao_checklist_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_checklist_modelo: {
        Row: {
          ativo: boolean
          created_at: string
          etapa_chave: string
          id: string
          item: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          etapa_chave: string
          id?: string
          item: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          etapa_chave?: string
          id?: string
          item?: string
          ordem?: number
        }
        Relationships: []
      }
      implantacao_estoque_itens: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string
          categoria: string
          created_at: string
          custo_unitario: number
          fornecedor: string
          id: string
          implantacao_id: string
          lote: string
          motivo: string
          nota_data: string | null
          nota_numero: string
          observacao: string
          origem_unidade_id: string | null
          produto_id: string
          produto_nome: string
          quantidade_recebida: number
          quantidade_solicitada: number
          solicitado_por: string | null
          solicitado_por_nome: string
          status: string
          tipo: string
          transferencia_id: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          categoria?: string
          created_at?: string
          custo_unitario?: number
          fornecedor?: string
          id?: string
          implantacao_id: string
          lote?: string
          motivo?: string
          nota_data?: string | null
          nota_numero?: string
          observacao?: string
          origem_unidade_id?: string | null
          produto_id: string
          produto_nome?: string
          quantidade_recebida?: number
          quantidade_solicitada?: number
          solicitado_por?: string | null
          solicitado_por_nome?: string
          status?: string
          tipo?: string
          transferencia_id?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string
          categoria?: string
          created_at?: string
          custo_unitario?: number
          fornecedor?: string
          id?: string
          implantacao_id?: string
          lote?: string
          motivo?: string
          nota_data?: string | null
          nota_numero?: string
          observacao?: string
          origem_unidade_id?: string | null
          produto_id?: string
          produto_nome?: string
          quantidade_recebida?: number
          quantidade_solicitada?: number
          solicitado_por?: string | null
          solicitado_por_nome?: string
          status?: string
          tipo?: string
          transferencia_id?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacao_estoque_itens_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_estoque_itens_origem_unidade_id_fkey"
            columns: ["origem_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_estoque_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_estoque_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "implantacao_estoque_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_estoque_itens_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_etapas: {
        Row: {
          aplicavel: boolean
          chave: string
          concluida_em: string | null
          concluida_por: string | null
          concluida_por_nome: string
          created_at: string
          id: string
          implantacao_id: string
          nome: string
          numero: number
          observacao: string
          status: string
          updated_at: string
        }
        Insert: {
          aplicavel?: boolean
          chave: string
          concluida_em?: string | null
          concluida_por?: string | null
          concluida_por_nome?: string
          created_at?: string
          id?: string
          implantacao_id: string
          nome: string
          numero: number
          observacao?: string
          status?: string
          updated_at?: string
        }
        Update: {
          aplicavel?: boolean
          chave?: string
          concluida_em?: string | null
          concluida_por?: string | null
          concluida_por_nome?: string
          created_at?: string
          id?: string
          implantacao_id?: string
          nome?: string
          numero?: number
          observacao?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacao_etapas_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_pendencias: {
        Row: {
          created_at: string
          criticidade: string
          descricao: string
          etapa_chave: string
          id: string
          implantacao_id: string
          origem: string
          prazo: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          resolvido_por_nome: string
          responsavel_id: string | null
          responsavel_nome: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criticidade?: string
          descricao?: string
          etapa_chave?: string
          id?: string
          implantacao_id: string
          origem?: string
          prazo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resolvido_por_nome?: string
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criticidade?: string
          descricao?: string
          etapa_chave?: string
          id?: string
          implantacao_id?: string
          origem?: string
          prazo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resolvido_por_nome?: string
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacao_pendencias_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacoes: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string
          data_inauguracao: string | null
          data_prevista_inauguracao: string | null
          id: string
          liberado_em: string | null
          liberado_por: string | null
          liberado_por_nome: string
          observacoes: string
          progresso: number
          responsavel_id: string | null
          responsavel_nome: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          data_inauguracao?: string | null
          data_prevista_inauguracao?: string | null
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string
          observacoes?: string
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          data_inauguracao?: string | null
          data_prevista_inauguracao?: string | null
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string
          observacoes?: string
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          created_at: string
          data: string
          deposito: string | null
          deposito_destino: string | null
          deposito_origem: string | null
          id: string
          implantacao_id: string | null
          observacao: string | null
          perfume_id: string
          perfume_nome: string
          quantidade: number
          registrado_por: string
          tipo: string
          transferencia_id: string | null
          unidade_destino_id: string | null
          unidade_id: string | null
          unidade_origem_id: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          deposito?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          id?: string
          implantacao_id?: string | null
          observacao?: string | null
          perfume_id: string
          perfume_nome: string
          quantidade?: number
          registrado_por?: string
          tipo: string
          transferencia_id?: string | null
          unidade_destino_id?: string | null
          unidade_id?: string | null
          unidade_origem_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          deposito?: string | null
          deposito_destino?: string | null
          deposito_origem?: string | null
          id?: string
          implantacao_id?: string | null
          observacao?: string | null
          perfume_id?: string
          perfume_nome?: string
          quantidade?: number
          registrado_por?: string
          tipo?: string
          transferencia_id?: string | null
          unidade_destino_id?: string | null
          unidade_id?: string | null
          unidade_origem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "movimentacoes_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      nfce_emissoes: {
        Row: {
          chave_acesso: string | null
          contingencia: boolean | null
          created_at: string
          danfe_url: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          id: string
          motivo_cancelamento: string | null
          motivo_rejeicao: string | null
          numero_nfce: number | null
          protocolo_autorizacao: string | null
          serie: number | null
          status: string
          unidade_id: string | null
          updated_at: string
          venda_grupo_venda: string
          xml_contingencia: string | null
          xml_url: string | null
        }
        Insert: {
          chave_acesso?: string | null
          contingencia?: boolean | null
          created_at?: string
          danfe_url?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          numero_nfce?: number | null
          protocolo_autorizacao?: string | null
          serie?: number | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          venda_grupo_venda: string
          xml_contingencia?: string | null
          xml_url?: string | null
        }
        Update: {
          chave_acesso?: string | null
          contingencia?: boolean | null
          created_at?: string
          danfe_url?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          numero_nfce?: number | null
          protocolo_autorizacao?: string | null
          serie?: number | null
          status?: string
          unidade_id?: string | null
          updated_at?: string
          venda_grupo_venda?: string
          xml_contingencia?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_emissoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          cnpj: string
          conciliada_em: string | null
          conciliada_por: string | null
          created_at: string
          data_emissao: string | null
          deposito_destino: string | null
          fornecedor: string
          id: string
          numero: string
          status: string
          unidade_destino_id: string | null
          xml_url: string | null
        }
        Insert: {
          cnpj?: string
          conciliada_em?: string | null
          conciliada_por?: string | null
          created_at?: string
          data_emissao?: string | null
          deposito_destino?: string | null
          fornecedor?: string
          id?: string
          numero: string
          status?: string
          unidade_destino_id?: string | null
          xml_url?: string | null
        }
        Update: {
          cnpj?: string
          conciliada_em?: string | null
          conciliada_por?: string | null
          created_at?: string
          data_emissao?: string | null
          deposito_destino?: string | null
          fornecedor?: string
          id?: string
          numero?: string
          status?: string
          unidade_destino_id?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_itens: {
        Row: {
          codigo_xml: string | null
          created_at: string
          descricao_xml: string
          id: string
          nota_id: string
          perfume_id: string | null
          quantidade: number
          status_correspondencia: string
          valor_desconto_unit: number
          valor_frete_unit: number
          valor_icms_unit: number
          valor_ipi_unit: number
          valor_outros_unit: number
          valor_produto_unit: number
          valor_seguro_unit: number
          valor_unitario: number
        }
        Insert: {
          codigo_xml?: string | null
          created_at?: string
          descricao_xml?: string
          id?: string
          nota_id: string
          perfume_id?: string | null
          quantidade?: number
          status_correspondencia?: string
          valor_desconto_unit?: number
          valor_frete_unit?: number
          valor_icms_unit?: number
          valor_ipi_unit?: number
          valor_outros_unit?: number
          valor_produto_unit?: number
          valor_seguro_unit?: number
          valor_unitario?: number
        }
        Update: {
          codigo_xml?: string | null
          created_at?: string
          descricao_xml?: string
          id?: string
          nota_id?: string
          perfume_id?: string | null
          quantidade?: number
          status_correspondencia?: string
          valor_desconto_unit?: number
          valor_frete_unit?: number
          valor_icms_unit?: number
          valor_ipi_unit?: number
          valor_outros_unit?: number
          valor_produto_unit?: number
          valor_seguro_unit?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_itens_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      perfumes: {
        Row: {
          casa_sigla: string
          cfop: string
          classificacao: string
          codigo: string
          codigo_barras: string
          concentracao: string
          created_at: string
          cst_csosn: string
          custo: number
          custo_medio: number
          estoque_amazonas: number
          estoque_casa: number
          estoque_minimo: number
          estoque_sumauma: number
          id: string
          image_url: string | null
          marca: string
          ncm: string
          nome: string
          notas_coracao: string
          notas_fundo: string
          notas_saida: string
          perfil_olfativo: string
          preco_venda: number
          tamanho: string
          tipo: string
          ultimo_custo_em: string | null
          unidade_fiscal: string
          updated_at: string
          volume: number
        }
        Insert: {
          casa_sigla: string
          cfop?: string
          classificacao?: string
          codigo: string
          codigo_barras?: string
          concentracao: string
          created_at?: string
          cst_csosn?: string
          custo?: number
          custo_medio?: number
          estoque_amazonas?: number
          estoque_casa?: number
          estoque_minimo?: number
          estoque_sumauma?: number
          id?: string
          image_url?: string | null
          marca: string
          ncm?: string
          nome: string
          notas_coracao?: string
          notas_fundo?: string
          notas_saida?: string
          perfil_olfativo?: string
          preco_venda?: number
          tamanho: string
          tipo: string
          ultimo_custo_em?: string | null
          unidade_fiscal?: string
          updated_at?: string
          volume: number
        }
        Update: {
          casa_sigla?: string
          cfop?: string
          classificacao?: string
          codigo?: string
          codigo_barras?: string
          concentracao?: string
          created_at?: string
          cst_csosn?: string
          custo?: number
          custo_medio?: number
          estoque_amazonas?: number
          estoque_casa?: number
          estoque_minimo?: number
          estoque_sumauma?: number
          id?: string
          image_url?: string | null
          marca?: string
          ncm?: string
          nome?: string
          notas_coracao?: string
          notas_fundo?: string
          notas_saida?: string
          perfil_olfativo?: string
          preco_venda?: number
          tamanho?: string
          tipo?: string
          ultimo_custo_em?: string | null
          unidade_fiscal?: string
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
      permissoes_catalogo: {
        Row: {
          chave: string
          created_at: string
          descricao: string
          modulo: string
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string
          modulo: string
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string
          modulo?: string
        }
        Relationships: []
      }
      preco_historico: {
        Row: {
          alterado_por: string
          data: string
          id: string
          preco_antigo: number
          preco_novo: number
          produto_id: string
        }
        Insert: {
          alterado_por?: string
          data?: string
          id?: string
          preco_antigo?: number
          preco_novo?: number
          produto_id: string
        }
        Update: {
          alterado_por?: string
          data?: string
          id?: string
          preco_antigo?: number
          preco_novo?: number
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preco_historico_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preco_historico_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      produto_custos: {
        Row: {
          aliquota_icms: number
          aliquota_ipi: number
          created_at: string
          custo_unitario: number
          data: string
          id: string
          nota_id: string | null
          observacao: string
          origem: string
          produto_id: string
          quantidade: number
          valor_desconto: number
          valor_frete: number
          valor_icms: number
          valor_ipi: number
          valor_outros: number
          valor_produto: number
          valor_seguro: number
        }
        Insert: {
          aliquota_icms?: number
          aliquota_ipi?: number
          created_at?: string
          custo_unitario?: number
          data?: string
          id?: string
          nota_id?: string | null
          observacao?: string
          origem?: string
          produto_id: string
          quantidade?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_ipi?: number
          valor_outros?: number
          valor_produto?: number
          valor_seguro?: number
        }
        Update: {
          aliquota_icms?: number
          aliquota_ipi?: number
          created_at?: string
          custo_unitario?: number
          data?: string
          id?: string
          nota_id?: string | null
          observacao?: string
          origem?: string
          produto_id?: string
          quantidade?: number
          valor_desconto?: number
          valor_frete?: number
          valor_icms?: number
          valor_ipi?: number
          valor_outros?: number
          valor_produto?: number
          valor_seguro?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_custos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_custos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      produto_gtins: {
        Row: {
          criado_em: string
          criado_por: string
          gtin: string
          id: string
          principal: boolean
          produto_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string
          gtin: string
          id?: string
          principal?: boolean
          produto_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string
          gtin?: string
          id?: string
          principal?: boolean
          produto_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          loja: string
          nome: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja?: string
          nome?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja?: string
          nome?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicao_conferencias: {
        Row: {
          created_at: string
          id: string
          produto_id: string
          produto_nome: string
          quantidade: number
          reposicao_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          produto_id: string
          produto_nome: string
          quantidade?: number
          reposicao_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          id?: string
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          reposicao_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicao_conferencias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicao_conferencias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "reposicao_conferencias_reposicao_id_fkey"
            columns: ["reposicao_id"]
            isOneToOne: false
            referencedRelation: "reposicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicao_divergencias: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string | null
          created_at: string
          foto_url: string | null
          id: string
          justificativa: string
          produto_id: string | null
          produto_nome: string
          quantidade_esperada: number
          quantidade_recebida: number
          reposicao_id: string
          tipo: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          justificativa?: string
          produto_id?: string | null
          produto_nome?: string
          quantidade_esperada?: number
          quantidade_recebida?: number
          reposicao_id: string
          tipo: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          justificativa?: string
          produto_id?: string | null
          produto_nome?: string
          quantidade_esperada?: number
          quantidade_recebida?: number
          reposicao_id?: string
          tipo?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicao_divergencias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicao_divergencias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "reposicao_divergencias_reposicao_id_fkey"
            columns: ["reposicao_id"]
            isOneToOne: false
            referencedRelation: "reposicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicao_historico: {
        Row: {
          acao: string
          created_at: string
          detalhes: string
          id: string
          reposicao_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string
          id?: string
          reposicao_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string
          id?: string
          reposicao_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicao_historico_reposicao_id_fkey"
            columns: ["reposicao_id"]
            isOneToOne: false
            referencedRelation: "reposicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicao_itens: {
        Row: {
          categoria: string
          created_at: string
          id: string
          produto_id: string
          produto_nome: string
          quantidade_enviada: number | null
          quantidade_recebida: number | null
          quantidade_separada: number | null
          quantidade_solicitada: number
          reposicao_id: string
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          id?: string
          produto_id: string
          produto_nome: string
          quantidade_enviada?: number | null
          quantidade_recebida?: number | null
          quantidade_separada?: number | null
          quantidade_solicitada?: number
          reposicao_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          produto_id?: string
          produto_nome?: string
          quantidade_enviada?: number | null
          quantidade_recebida?: number | null
          quantidade_separada?: number | null
          quantidade_solicitada?: number
          reposicao_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicao_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "reposicao_itens_reposicao_id_fkey"
            columns: ["reposicao_id"]
            isOneToOne: false
            referencedRelation: "reposicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicoes: {
        Row: {
          cancelado_motivo: string | null
          codigo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string
          destino: string
          enviado_em: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          finalizado_em: string | null
          finalizado_por: string | null
          finalizado_por_nome: string | null
          id: string
          observacoes: string
          origem: string
          recebido_em: string | null
          recebido_por: string | null
          recebido_por_nome: string | null
          separado_em: string | null
          separado_por: string | null
          separado_por_nome: string | null
          status: string
          unidade_destino_id: string | null
          unidade_origem_id: string | null
          updated_at: string
        }
        Insert: {
          cancelado_motivo?: string | null
          codigo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          finalizado_por_nome?: string | null
          id?: string
          observacoes?: string
          origem: string
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          separado_em?: string | null
          separado_por?: string | null
          separado_por_nome?: string | null
          status?: string
          unidade_destino_id?: string | null
          unidade_origem_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelado_motivo?: string | null
          codigo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino?: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          finalizado_em?: string | null
          finalizado_por?: string | null
          finalizado_por_nome?: string | null
          id?: string
          observacoes?: string
          origem?: string
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          separado_em?: string | null
          separado_por?: string | null
          separado_por_nome?: string | null
          status?: string
          unidade_destino_id?: string | null
          unidade_origem_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposicoes_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicoes_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
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
          unidade_id: string | null
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
          unidade_id?: string | null
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
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "testers_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencia_eventos: {
        Row: {
          created_at: string
          dados: Json | null
          detalhes: string
          evento: string
          id: string
          transferencia_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          detalhes?: string
          evento: string
          id?: string
          transferencia_id: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          detalhes?: string
          evento?: string
          id?: string
          transferencia_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_eventos_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencia_itens: {
        Row: {
          created_at: string
          id: string
          produto_id: string
          produto_nome: string
          quantidade_enviada: number | null
          quantidade_recebida: number | null
          quantidade_separada: number | null
          quantidade_solicitada: number
          status: string
          transferencia_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          produto_id: string
          produto_nome?: string
          quantidade_enviada?: number | null
          quantidade_recebida?: number | null
          quantidade_separada?: number | null
          quantidade_solicitada: number
          status?: string
          transferencia_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          produto_id?: string
          produto_nome?: string
          quantidade_enviada?: number | null
          quantidade_recebida?: number | null
          quantidade_separada?: number | null
          quantidade_solicitada?: number
          status?: string
          transferencia_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "transferencia_itens_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencia_sequencias: {
        Row: {
          ano: number
          ultimo: number
        }
        Insert: {
          ano: number
          ultimo?: number
        }
        Update: {
          ano?: number
          ultimo?: number
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          ano: number
          cancelado_motivo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string
          destino_unidade_id: string
          enviado_em: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          implantacao_id: string | null
          numero: string
          observacao: string
          origem_unidade_id: string
          recebido_em: string | null
          recebido_por: string | null
          recebido_por_nome: string | null
          separado_em: string | null
          separado_por: string | null
          separado_por_nome: string | null
          status: string
          transportador: string
          updated_at: string
        }
        Insert: {
          ano?: number
          cancelado_motivo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino_unidade_id: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          implantacao_id?: string | null
          numero: string
          observacao?: string
          origem_unidade_id: string
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          separado_em?: string | null
          separado_por?: string | null
          separado_por_nome?: string | null
          status?: string
          transportador?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          cancelado_motivo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string
          destino_unidade_id?: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          implantacao_id?: string | null
          numero?: string
          observacao?: string
          origem_unidade_id?: string
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_nome?: string | null
          separado_em?: string | null
          separado_por?: string | null
          separado_por_nome?: string | null
          status?: string
          transportador?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_destino_unidade_id_fkey"
            columns: ["destino_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_origem_unidade_id_fkey"
            columns: ["origem_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          cnpj: string
          codigo: string
          codigo_legado: string | null
          complemento: string
          created_at: string
          data_inauguracao: string | null
          data_prevista_inauguracao: string | null
          email: string
          id: string
          inativada_em: string | null
          inscricao_estadual: string
          logradouro: string
          motivo_inativacao: string
          nome: string
          nome_exibicao: string
          numero: string
          ordem: number
          permite_estoque: boolean
          permite_transferencia: boolean
          permite_venda: boolean
          responsavel_id: string | null
          status: string
          telefone: string
          tipo: string
          uf: string
          updated_at: string
        }
        Insert: {
          bairro?: string
          cep?: string
          cidade?: string
          cnpj?: string
          codigo: string
          codigo_legado?: string | null
          complemento?: string
          created_at?: string
          data_inauguracao?: string | null
          data_prevista_inauguracao?: string | null
          email?: string
          id?: string
          inativada_em?: string | null
          inscricao_estadual?: string
          logradouro?: string
          motivo_inativacao?: string
          nome: string
          nome_exibicao?: string
          numero?: string
          ordem?: number
          permite_estoque?: boolean
          permite_transferencia?: boolean
          permite_venda?: boolean
          responsavel_id?: string | null
          status?: string
          telefone?: string
          tipo?: string
          uf?: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          cnpj?: string
          codigo?: string
          codigo_legado?: string | null
          complemento?: string
          created_at?: string
          data_inauguracao?: string | null
          data_prevista_inauguracao?: string | null
          email?: string
          id?: string
          inativada_em?: string | null
          inscricao_estadual?: string
          logradouro?: string
          motivo_inativacao?: string
          nome?: string
          nome_exibicao?: string
          numero?: string
          ordem?: number
          permite_estoque?: boolean
          permite_transferencia?: boolean
          permite_venda?: boolean
          responsavel_id?: string | null
          status?: string
          telefone?: string
          tipo?: string
          uf?: string
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
      usuario_unidade_permissoes: {
        Row: {
          concedido_por: string | null
          created_at: string
          id: string
          permissao: string
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          concedido_por?: string | null
          created_at?: string
          id?: string
          permissao: string
          unidade_id: string
          usuario_id: string
        }
        Update: {
          concedido_por?: string | null
          created_at?: string
          id?: string
          permissao?: string
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_unidade_permissoes_permissao_fkey"
            columns: ["permissao"]
            isOneToOne: false
            referencedRelation: "permissoes_catalogo"
            referencedColumns: ["chave"]
          },
          {
            foreignKeyName: "usuario_unidade_permissoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_unidades: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          perfil_id: string | null
          unidade_id: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          perfil_id?: string | null
          unidade_id: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          perfil_id?: string | null
          unidade_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_cancelamentos: {
        Row: {
          aprovado_por: string | null
          caixa_fechado: boolean
          cancelado_por: string | null
          cancelado_por_nome: string
          created_at: string
          grupo_venda: string
          id: string
          motivo: string
          sessao_caixa_ajuste_id: string | null
          unidade_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          aprovado_por?: string | null
          caixa_fechado?: boolean
          cancelado_por?: string | null
          cancelado_por_nome?: string
          created_at?: string
          grupo_venda: string
          id?: string
          motivo: string
          sessao_caixa_ajuste_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aprovado_por?: string | null
          caixa_fechado?: boolean
          cancelado_por?: string | null
          cancelado_por_nome?: string
          created_at?: string
          grupo_venda?: string
          id?: string
          motivo?: string
          sessao_caixa_ajuste_id?: string | null
          unidade_id?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "venda_cancelamentos_sessao_caixa_ajuste_id_fkey"
            columns: ["sessao_caixa_ajuste_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_cancelamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_pagamentos: {
        Row: {
          bandeira: string
          created_at: string
          grupo_venda: string
          id: string
          parcelas: number
          tipo_pagamento: string
          valor: number
          valor_parcela: number
        }
        Insert: {
          bandeira?: string
          created_at?: string
          grupo_venda: string
          id?: string
          parcelas?: number
          tipo_pagamento?: string
          valor?: number
          valor_parcela?: number
        }
        Update: {
          bandeira?: string
          created_at?: string
          grupo_venda?: string
          id?: string
          parcelas?: number
          tipo_pagamento?: string
          valor?: number
          valor_parcela?: number
        }
        Relationships: []
      }
      vendas: {
        Row: {
          bandeira: string
          cancelada: boolean
          cancelada_em: string | null
          cliente_id: string | null
          created_at: string
          data: string
          deposito: string
          desconto: number
          grupo_venda: string | null
          id: string
          is_teste: boolean
          nfce_chave: string | null
          nfce_status: string | null
          observacao: string
          perfume_id: string
          perfume_nome: string
          preco_unitario: number
          quantidade: number
          registrado_por: string
          sessao_caixa_id: string | null
          tipo_ajuste: string
          tipo_documento: string
          tipo_pagamento: string
          total: number
          unidade_id: string | null
          vendedora: string
        }
        Insert: {
          bandeira?: string
          cancelada?: boolean
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          deposito: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
          is_teste?: boolean
          nfce_chave?: string | null
          nfce_status?: string | null
          observacao?: string
          perfume_id: string
          perfume_nome: string
          preco_unitario?: number
          quantidade?: number
          registrado_por?: string
          sessao_caixa_id?: string | null
          tipo_ajuste?: string
          tipo_documento?: string
          tipo_pagamento?: string
          total?: number
          unidade_id?: string | null
          vendedora?: string
        }
        Update: {
          bandeira?: string
          cancelada?: boolean
          cancelada_em?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          deposito?: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
          is_teste?: boolean
          nfce_chave?: string | null
          nfce_status?: string | null
          observacao?: string
          perfume_id?: string
          perfume_nome?: string
          preco_unitario?: number
          quantidade?: number
          registrado_por?: string
          sessao_caixa_id?: string | null
          tipo_ajuste?: string
          tipo_documento?: string
          tipo_pagamento?: string
          total?: number
          unidade_id?: string | null
          vendedora?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_estoque_compat"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "vendas_sessao_caixa_id_fkey"
            columns: ["sessao_caixa_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      perfumes_estoque_compat: {
        Row: {
          disponivel_total: number | null
          estoque_amazonas: number | null
          estoque_casa: number | null
          estoque_sumauma: number | null
          estoque_total: number | null
          produto_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_master_exists: { Args: never; Returns: boolean }
      claim_first_master: { Args: { p_user_id: string }; Returns: boolean }
      fn__caixa_aberto: { Args: { _unidade: string }; Returns: string }
      fn__credito_entrada: {
        Args: {
          _cliente: string
          _devolucao: string
          _obs: string
          _unidade: string
          _valor: number
        }
        Returns: undefined
      }
      fn__decant_cfg: { Args: never; Returns: Json }
      fn__decant_dia: { Args: { ts: string }; Returns: string }
      fn__decant_exigir: {
        Args: { _perm: string; _unidade: string }
        Returns: undefined
      }
      fn__decant_exigir_leitura: { Args: { _perm: string }; Returns: undefined }
      fn__decant_lote_evento: {
        Args: { _dados: Json; _evento: string; _lote: string }
        Returns: undefined
      }
      fn__decant_perda_lote: { Args: { _lote_id: string }; Returns: undefined }
      fn__decant_perda_tipo_ml: {
        Args: { _ref: string; _tipo: string }
        Returns: string
      }
      fn__decant_rotulo: { Args: { p_produto: string }; Returns: string }
      fn__decant_un_mov: {
        Args: {
          _canal: string
          _custo: number
          _destino: string
          _lote: string
          _motivo: string
          _origem: string
          _preco: number
          _qtd: number
          _ref: string
          _ref_tipo: string
          _sku: string
          _tipo: string
          _unidade: string
        }
        Returns: number
      }
      fn__decant_vendas_liq: {
        Args: { p_fim: string; p_ini: string; p_unidade: string }
        Returns: {
          canal: string
          cmv: number
          custo_unit: number
          dia: string
          preco_unit: number
          produto_id: string
          qtd: number
          qtd_devolvida: number
          quantidade: number
          receita: number
          sku_id: string
          status: string
          tamanho_id: string
          unidade_id: string
          venda_id: string
          vendedora: string
          volume_ml: number
        }[]
      }
      fn__decant_ver_custos: { Args: never; Returns: boolean }
      fn__decant_ver_margem: { Args: never; Returns: boolean }
      fn__devolucao_core: {
        Args: {
          p_cliente: string
          p_forma: string
          p_grupo: string
          p_itens: Json
          p_motivo: string
          p_tipo: string
        }
        Returns: Record<string, unknown>
      }
      fn__devolucao_reembolso: {
        Args: { p_dev: string; p_forma: string; p_valor: number }
        Returns: undefined
      }
      fn__estoque_entrada: {
        Args: { _produto: string; _qtd: number; _unidade: string }
        Returns: undefined
      }
      fn__estoque_filtrado: {
        Args: { p: Json }
        Returns: {
          estoques: Json
          produto_id: string
          qtd: number
          tester_qtd: number
          testers: Json
        }[]
      }
      fn__fmt_ml: { Args: { _v: number }; Returns: string }
      fn__hoje_manaus: { Args: never; Returns: string }
      fn__nome_usuario: { Args: never; Returns: string }
      fn__pode: {
        Args: { _perm: string; _unidade_id: string }
        Returns: boolean
      }
      fn__vendas_filtradas: {
        Args: { p: Json }
        Returns: {
          bandeira: string
          cancelada: boolean
          cancelada_em: string | null
          cliente_id: string | null
          created_at: string
          data: string
          deposito: string
          desconto: number
          grupo_venda: string | null
          id: string
          is_teste: boolean
          nfce_chave: string | null
          nfce_status: string | null
          observacao: string
          perfume_id: string
          perfume_nome: string
          preco_unitario: number
          quantidade: number
          registrado_por: string
          sessao_caixa_id: string | null
          tipo_ajuste: string
          tipo_documento: string
          tipo_pagamento: string
          total: number
          unidade_id: string | null
          vendedora: string
        }[]
        SetofOptions: {
          from: "*"
          to: "vendas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_ajustar_saldo: {
        Args: {
          p_modo?: string
          p_produto_id: string
          p_quantidade: number
          p_unidade: string
        }
        Returns: number
      }
      fn_audit: {
        Args: {
          p_acao: string
          p_dados_anteriores?: Json
          p_dados_novos?: Json
          p_entidade?: string
          p_entidade_id?: string
          p_ip?: string
          p_unidade_id?: string
        }
        Returns: string
      }
      fn_baixar_venda: {
        Args: {
          p_is_teste?: boolean
          p_produto_id: string
          p_quantidade: number
          p_unidade: string
        }
        Returns: number
      }
      fn_config_fiscal_unidade_ler: {
        Args: { p_unidade_id: string }
        Returns: Json
      }
      fn_config_fiscal_unidade_salvar: {
        Args: {
          p_ambiente: string
          p_bairro: string
          p_cep: string
          p_certificado_digital_url?: string
          p_certificado_senha?: string
          p_cidade: string
          p_cnpj: string
          p_complemento: string
          p_csc_id: string
          p_csc_token?: string
          p_endereco: string
          p_inscricao_estadual: string
          p_nome_fantasia: string
          p_numero: string
          p_proximo_numero_nfce: number
          p_razao_social: string
          p_regime_tributario: string
          p_serie_nfce: number
          p_telefone: string
          p_uf: string
          p_unidade_id: string
        }
        Returns: string
      }
      fn_credito_usar: {
        Args: {
          p_cliente_id: string
          p_grupo_venda?: string
          p_unidade_id?: string
          p_valor: number
        }
        Returns: number
      }
      fn_decant_abrir_frasco: {
        Args: {
          p_idempotency_key: string
          p_lote_fabricante: string
          p_observacao: string
          p_produto_id: string
          p_responsavel: string
          p_unidade_id: string
          p_validade: string
          p_volume_inicial: number
        }
        Returns: Json
      }
      fn_decant_conferir: {
        Args: {
          p_acao: string
          p_frasco_id: string
          p_justificativa: string
          p_saldo_fisico: number
        }
        Returns: Json
      }
      fn_decant_custo_ml: {
        Args: { _custo: number; _rendimento: number; _volume: number }
        Returns: number
      }
      fn_decant_decidir_conferencia: {
        Args: {
          p_acao: string
          p_aprovar: boolean
          p_conferencia_id: string
          p_obs: string
        }
        Returns: Json
      }
      fn_decant_destinar: {
        Args: {
          p_data: string
          p_idempotency_key: string
          p_observacao: string
          p_produto_id: string
          p_quantidade: number
          p_responsavel: string
          p_unidade_id: string
        }
        Returns: Json
      }
      fn_decant_devolver: {
        Args: {
          p_estornar_dinheiro: boolean
          p_motivo: string
          p_quantidade: number
          p_venda_id: string
        }
        Returns: Json
      }
      fn_decant_disponivel_frasco: {
        Args: { p_frasco_id: string }
        Returns: number
      }
      fn_decant_estoque_listar: {
        Args: { p_unidade_id: string }
        Returns: Json
      }
      fn_decant_fichas_listar: {
        Args: { p_produto_id?: string }
        Returns: Json
      }
      fn_decant_frascos_disponiveis: {
        Args: { p_produto_id: string; p_unidade_id: string }
        Returns: Json
      }
      fn_decant_frascos_listar: {
        Args: { p_unidade_id: string }
        Returns: Json
      }
      fn_decant_inventario_contar: {
        Args: {
          p_contado: number
          p_justificativa: string
          p_sku: string
          p_unidade: string
        }
        Returns: Json
      }
      fn_decant_inventario_decidir: {
        Args: { p_aprovar: boolean; p_id: string }
        Returns: Json
      }
      fn_decant_lote_cancelar: {
        Args: { p_lote_id: string; p_motivo: string }
        Returns: Json
      }
      fn_decant_lote_conferir: {
        Args: { p_itens: Json; p_lote_id: string; p_responsavel: string }
        Returns: Json
      }
      fn_decant_lote_criar: {
        Args: {
          p_frascos: Json
          p_idempotency_key: string
          p_itens: Json
          p_observacao: string
          p_produto_id: string
          p_responsavel: string
          p_unidade_id: string
        }
        Returns: Json
      }
      fn_decant_lote_editar: {
        Args: {
          p_lote_id: string
          p_motivo: string
          p_observacao: string
          p_responsavel_producao: string
        }
        Returns: Json
      }
      fn_decant_lote_finalizar: {
        Args: { p_consumo: Json; p_lote_id: string }
        Returns: Json
      }
      fn_decant_lote_iniciar: { Args: { p_lote_id: string }; Returns: Json }
      fn_decant_lotes_listar: {
        Args: {
          p_limite?: number
          p_offset?: number
          p_status?: string
          p_unidade_id: string
        }
        Returns: Json
      }
      fn_decant_movimentacoes_listar: {
        Args: { p: Json; p_limite?: number; p_offset?: number }
        Returns: Json
      }
      fn_decant_pdv_catalogo: { Args: { p_unidade_id: string }; Returns: Json }
      fn_decant_perdas_painel: {
        Args: { p_fim: string; p_ini: string; p_unidade: string }
        Returns: Json
      }
      fn_decant_quarentena_decidir: {
        Args: {
          p_acao: string
          p_id: string
          p_lacrado: boolean
          p_obs: string
        }
        Returns: Json
      }
      fn_decant_registrar_perda: {
        Args: {
          p_frasco_id: string
          p_idempotency_key: string
          p_justificativa: string
          p_ml: number
          p_tipo: string
        }
        Returns: Json
      }
      fn_decant_registrar_saida: {
        Args: {
          p_frasco_id: string
          p_idempotency_key: string
          p_ml: number
          p_motivo: string
          p_tipo: string
        }
        Returns: Json
      }
      fn_decant_reservado_frasco: {
        Args: { p_excluir_lote?: string; p_frasco_id: string }
        Returns: number
      }
      fn_decant_saldo_frasco: { Args: { p_frasco_id: string }; Returns: number }
      fn_decant_saldo_sku: {
        Args: { p_sku: string; p_unidade: string }
        Returns: number
      }
      fn_decant_sku_codigo: {
        Args: { _codigo_perfume: string; _volume: number }
        Returns: string
      }
      fn_decant_sku_salvar: {
        Args: {
          p_ativo: boolean
          p_preco: number
          p_produto_id: string
          p_sku: string
          p_tamanho_id: string
        }
        Returns: Json
      }
      fn_decant_sku_unidade_salvar: {
        Args: {
          p_ideal: number
          p_minimo: number
          p_sku: string
          p_unidade: string
        }
        Returns: undefined
      }
      fn_decant_transf_cancelar: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      fn_decant_transf_criar: {
        Args: {
          p_destino: string
          p_idempotency_key: string
          p_itens: Json
          p_observacao: string
          p_origem: string
        }
        Returns: Json
      }
      fn_decant_transf_enviar: {
        Args: { p_id: string; p_transportador: string }
        Returns: Json
      }
      fn_decant_transf_listar: { Args: { p_unidade_id: string }; Returns: Json }
      fn_decant_transf_receber: {
        Args: { p_conferencias: Json; p_id: string }
        Returns: Json
      }
      fn_decant_transf_resolver: {
        Args: { p_id: string; p_justificativa: string; p_resolucao: string }
        Returns: Json
      }
      fn_decant_transf_separar: { Args: { p_id: string }; Returns: Json }
      fn_decant_venda_cancelar: {
        Args: { p_grupo: string; p_motivo: string }
        Returns: Json
      }
      fn_decant_vendas_listar: {
        Args: { p: Json; p_limite?: number; p_offset?: number }
        Returns: Json
      }
      fn_decant_vender: {
        Args: {
          p_canal: string
          p_cliente_id: string
          p_idempotency_key: string
          p_itens: Json
          p_pagamentos: Json
          p_unidade_id: string
          p_vendedora: string
        }
        Returns: Json
      }
      fn_devolucao_registrar: {
        Args: {
          p_cliente_id?: string
          p_forma_reembolso: string
          p_grupo_venda: string
          p_itens: Json
          p_motivo: string
        }
        Returns: Json
      }
      fn_estoque_listar: {
        Args: { p_filtros?: Json; p_limite?: number; p_offset?: number }
        Returns: Json
      }
      fn_estoque_resumo: { Args: { p_filtros?: Json }; Returns: Json }
      fn_implantacao_carga_manual_aprovar: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      fn_implantacao_criar: {
        Args: {
          p_data_prevista?: string
          p_observacoes?: string
          p_responsavel_nome?: string
          p_unidade_id: string
        }
        Returns: string
      }
      fn_implantacao_entrada_fornecedor: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      fn_implantacao_estoque_sincronizar: {
        Args: { p_implantacao_id: string }
        Returns: Json
      }
      fn_implantacao_gerar_transferencias: {
        Args: { p_implantacao_id: string }
        Returns: number
      }
      fn_implantacao_iniciar_testes: {
        Args: { p_implantacao_id: string }
        Returns: undefined
      }
      fn_implantacao_liberar: {
        Args: { p_data_inauguracao?: string; p_implantacao_id: string }
        Returns: undefined
      }
      fn_implantacao_prontidao: {
        Args: { p_implantacao_id: string }
        Returns: Json
      }
      fn_implantacao_recalcular_progresso: {
        Args: { p_id: string }
        Returns: number
      }
      fn_proximo_numero_transferencia: { Args: never; Returns: string }
      fn_saida_tester: {
        Args: {
          p_baixar_estoque?: boolean
          p_observacao?: string
          p_produto_id: string
          p_quantidade: number
          p_registrado_por?: string
          p_unidade: string
        }
        Returns: Json
      }
      fn_sync_estoque_legado: {
        Args: { _produto_id: string; _unidade_id: string }
        Returns: undefined
      }
      fn_transf_concluir_interna: {
        Args: { p_id: string; p_modo: string }
        Returns: undefined
      }
      fn_transf_evento: {
        Args: {
          p_dados?: Json
          p_detalhes?: string
          p_evento: string
          p_transferencia_id: string
        }
        Returns: undefined
      }
      fn_transf_validar_rota: {
        Args: { p_destino: string; p_origem: string }
        Returns: undefined
      }
      fn_transferencia_cancelar: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      fn_transferencia_confirmar: { Args: { p_id: string }; Returns: undefined }
      fn_transferencia_criar: {
        Args: {
          p_destino: string
          p_implantacao_id?: string
          p_itens: Json
          p_observacao?: string
          p_origem: string
        }
        Returns: string
      }
      fn_transferencia_enviar: {
        Args: { p_id: string; p_observacao?: string; p_transportador?: string }
        Returns: undefined
      }
      fn_transferencia_finalizar_separacao: {
        Args: { p_id: string }
        Returns: undefined
      }
      fn_transferencia_iniciar_conferencia: {
        Args: { p_id: string }
        Returns: undefined
      }
      fn_transferencia_receber: {
        Args: { p_conferencias: Json; p_id: string }
        Returns: string
      }
      fn_transferencia_resolver_divergencia: {
        Args: { p_id: string; p_justificativa: string; p_resolucao: string }
        Returns: string
      }
      fn_transferencia_separar_item: {
        Args: {
          p_autorizado?: boolean
          p_item_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      fn_transferir: {
        Args: {
          p_destino: string
          p_origem: string
          p_produto_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      fn_troca_registrar: {
        Args: {
          p_cliente_id?: string
          p_forma_diferenca?: string
          p_grupo_venda: string
          p_itens_devolvidos: Json
          p_itens_novos: Json
          p_motivo: string
          p_pagamentos?: Json
          p_vendedora?: string
        }
        Returns: Json
      }
      fn_unidade_por_texto: {
        Args: { _txt: string }
        Returns: {
          bairro: string
          cep: string
          cidade: string
          cnpj: string
          codigo: string
          codigo_legado: string | null
          complemento: string
          created_at: string
          data_inauguracao: string | null
          data_prevista_inauguracao: string | null
          email: string
          id: string
          inativada_em: string | null
          inscricao_estadual: string
          logradouro: string
          motivo_inativacao: string
          nome: string
          nome_exibicao: string
          numero: string
          ordem: number
          permite_estoque: boolean
          permite_transferencia: boolean
          permite_venda: boolean
          responsavel_id: string | null
          status: string
          telefone: string
          tipo: string
          uf: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "unidades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_validar_operacao_unidade: {
        Args: { _operacao: string; _unidade_id: string }
        Returns: undefined
      }
      fn_venda_cancelar: {
        Args: { p_grupo_venda: string; p_motivo: string }
        Returns: Json
      }
      fn_vendas_listar: {
        Args: { p: Json; p_limit?: number; p_offset?: number }
        Returns: {
          bandeira: string
          cancelada: boolean
          cancelada_em: string | null
          cliente_id: string | null
          created_at: string
          data: string
          deposito: string
          desconto: number
          grupo_venda: string | null
          id: string
          is_teste: boolean
          nfce_chave: string | null
          nfce_status: string | null
          observacao: string
          perfume_id: string
          perfume_nome: string
          preco_unitario: number
          quantidade: number
          registrado_por: string
          sessao_caixa_id: string | null
          tipo_ajuste: string
          tipo_documento: string
          tipo_pagamento: string
          total: number
          unidade_id: string | null
          vendedora: string
        }[]
        SetofOptions: {
          from: "*"
          to: "vendas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_vendas_resumo: {
        Args: { p: Json }
        Returns: {
          grupos: number
          itens: number
          qtd: number
          valor: number
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_tem_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_unidade: {
        Args: { _unidade_id: string }
        Returns: boolean
      }
      usuario_tem_permissao: {
        Args: { _permissao: string; _unidade_id: string }
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
      app_role: ["master", "vendedor"],
    },
  },
} as const
