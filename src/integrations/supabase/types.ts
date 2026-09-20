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
      fn_proximo_numero_transferencia: { Args: never; Returns: string }
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
