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
      alertas_estoque: {
        Row: {
          criado_em: string
          id: string
          loja: string
          produto_id: string
          resolvido_em: string | null
          status: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          loja: string
          produto_id: string
          resolvido_em?: string | null
          status?: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          loja?: string
          produto_id?: string
          resolvido_em?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
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
      balanco_auditoria: {
        Row: {
          acao: string
          balanco_id: string
          created_at: string
          detalhes: Json
          id: string
          usuario: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          balanco_id: string
          created_at?: string
          detalhes?: Json
          id?: string
          usuario?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          balanco_id?: string
          created_at?: string
          detalhes?: Json
          id?: string
          usuario?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balanco_auditoria_balanco_id_fkey"
            columns: ["balanco_id"]
            isOneToOne: false
            referencedRelation: "balancos"
            referencedColumns: ["id"]
          },
        ]
      }
      balanco_itens: {
        Row: {
          ajuste_aplicado: boolean
          balanco_id: string
          conferido_em: string | null
          conferido_em_2: string | null
          conferido_por: string | null
          conferido_por_2: string | null
          created_at: string
          custo_unitario: number
          deposito: string
          diferenca: number
          divergencia_contadores: boolean
          estoque_sistema: number
          id: string
          impacto_financeiro: number
          justificativa: string
          marca: string
          movimentacao_id: string | null
          perfume_codigo: string
          perfume_id: string
          perfume_nome: string
          quantidade_contada: number | null
          quantidade_contada_2: number | null
          status: string
          updated_at: string
        }
        Insert: {
          ajuste_aplicado?: boolean
          balanco_id: string
          conferido_em?: string | null
          conferido_em_2?: string | null
          conferido_por?: string | null
          conferido_por_2?: string | null
          created_at?: string
          custo_unitario?: number
          deposito: string
          diferenca?: number
          divergencia_contadores?: boolean
          estoque_sistema?: number
          id?: string
          impacto_financeiro?: number
          justificativa?: string
          marca?: string
          movimentacao_id?: string | null
          perfume_codigo?: string
          perfume_id: string
          perfume_nome?: string
          quantidade_contada?: number | null
          quantidade_contada_2?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          ajuste_aplicado?: boolean
          balanco_id?: string
          conferido_em?: string | null
          conferido_em_2?: string | null
          conferido_por?: string | null
          conferido_por_2?: string | null
          created_at?: string
          custo_unitario?: number
          deposito?: string
          diferenca?: number
          divergencia_contadores?: boolean
          estoque_sistema?: number
          id?: string
          impacto_financeiro?: number
          justificativa?: string
          marca?: string
          movimentacao_id?: string | null
          perfume_codigo?: string
          perfume_id?: string
          perfume_nome?: string
          quantidade_contada?: number | null
          quantidade_contada_2?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balanco_itens_balanco_id_fkey"
            columns: ["balanco_id"]
            isOneToOne: false
            referencedRelation: "balancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_itens_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
        ]
      }
      balanco_leituras: {
        Row: {
          balanco_id: string
          codigo_lido: string
          contagem: number
          criado_em: string
          encontrado: boolean
          id: string
          origem: string
          perfume_id: string | null
          quantidade: number
          usuario: string
        }
        Insert: {
          balanco_id: string
          codigo_lido: string
          contagem?: number
          criado_em?: string
          encontrado?: boolean
          id?: string
          origem?: string
          perfume_id?: string | null
          quantidade?: number
          usuario?: string
        }
        Update: {
          balanco_id?: string
          codigo_lido?: string
          contagem?: number
          criado_em?: string
          encontrado?: boolean
          id?: string
          origem?: string
          perfume_id?: string | null
          quantidade?: number
          usuario?: string
        }
        Relationships: []
      }
      balancos: {
        Row: {
          ajustado_em: string | null
          ajustado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          concluido_em: string | null
          created_at: string
          depositos: string[]
          dupla_conferencia: boolean
          filtros: Json
          id: string
          iniciado_em: string
          modo_contagem: string
          motivo_cancelamento: string | null
          nome: string
          observacoes: string
          responsavel: string
          responsavel_id: string | null
          status: string
          tipo_contagem: string
          total_conferidos: number
          total_divergencias: number
          total_faltas: number
          total_itens: number
          total_sobras: number
          updated_at: string
          valor_divergencia: number
        }
        Insert: {
          ajustado_em?: string | null
          ajustado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          concluido_em?: string | null
          created_at?: string
          depositos?: string[]
          dupla_conferencia?: boolean
          filtros?: Json
          id?: string
          iniciado_em?: string
          modo_contagem?: string
          motivo_cancelamento?: string | null
          nome: string
          observacoes?: string
          responsavel?: string
          responsavel_id?: string | null
          status?: string
          tipo_contagem?: string
          total_conferidos?: number
          total_divergencias?: number
          total_faltas?: number
          total_itens?: number
          total_sobras?: number
          updated_at?: string
          valor_divergencia?: number
        }
        Update: {
          ajustado_em?: string | null
          ajustado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          concluido_em?: string | null
          created_at?: string
          depositos?: string[]
          dupla_conferencia?: boolean
          filtros?: Json
          id?: string
          iniciado_em?: string
          modo_contagem?: string
          motivo_cancelamento?: string | null
          nome?: string
          observacoes?: string
          responsavel?: string
          responsavel_id?: string | null
          status?: string
          tipo_contagem?: string
          total_conferidos?: number
          total_divergencias?: number
          total_faltas?: number
          total_itens?: number
          total_sobras?: number
          updated_at?: string
          valor_divergencia?: number
        }
        Relationships: []
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
          valor_abertura?: number
          valor_esperado?: number | null
          valor_fechamento?: number | null
        }
        Relationships: []
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
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
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
          updated_at?: string
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
          updated_at?: string
          venda_grupo_venda?: string
          xml_contingencia?: string | null
          xml_url?: string | null
        }
        Relationships: []
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
          xml_url?: string | null
        }
        Relationships: []
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
        ]
      }
      perfumes: {
        Row: {
          casa_sigla: string
          cfop: string
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
          cliente_id: string | null
          created_at: string
          data: string
          deposito: string
          desconto: number
          grupo_venda: string | null
          id: string
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
          vendedora: string
        }
        Insert: {
          bandeira?: string
          cliente_id?: string | null
          created_at?: string
          data?: string
          deposito: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
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
          vendedora?: string
        }
        Update: {
          bandeira?: string
          cliente_id?: string | null
          created_at?: string
          data?: string
          deposito?: string
          desconto?: number
          grupo_venda?: string | null
          id?: string
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
            foreignKeyName: "vendas_sessao_caixa_id_fkey"
            columns: ["sessao_caixa_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
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
