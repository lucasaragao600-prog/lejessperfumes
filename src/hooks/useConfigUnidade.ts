import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConfigFiscalUnidade {
  id: string;
  unidade_id: string;
  cnpj: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  regime_tributario: string;
  ambiente: "homologacao" | "producao";
  serie_nfce: number;
  proximo_numero_nfce: number;
  csc_id: string;
  logo_url: string;
  certificado_digital_url: string;
  csc_token_configurado: boolean;
  certificado_configurado: boolean;
  certificado_senha_configurada: boolean;
}

export interface SalvarFiscalParams {
  cnpj: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  regime_tributario: string;
  ambiente: "homologacao" | "producao";
  serie_nfce: number;
  proximo_numero_nfce: number;
  csc_id: string;
  csc_token?: string;
  certificado_senha?: string;
}

export function useConfigFiscalUnidade(unidadeId?: string) {
  const qc = useQueryClient();
  const chave = ["config-fiscal-unidade", unidadeId];

  const { data, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_config_fiscal_unidade_ler", {
        p_unidade_id: unidadeId!,
      });
      if (error) throw error;
      return (data as unknown as ConfigFiscalUnidade | null) ?? null;
    },
  });

  const salvar = useMutation({
    mutationFn: async (p: SalvarFiscalParams) => {
      const { error } = await supabase.rpc("fn_config_fiscal_unidade_salvar", {
        p_unidade_id: unidadeId!,
        p_cnpj: p.cnpj,
        p_inscricao_estadual: p.inscricao_estadual,
        p_razao_social: p.razao_social,
        p_nome_fantasia: p.nome_fantasia,
        p_endereco: p.endereco,
        p_numero: p.numero,
        p_complemento: p.complemento,
        p_bairro: p.bairro,
        p_cidade: p.cidade,
        p_uf: p.uf,
        p_cep: p.cep,
        p_telefone: p.telefone,
        p_regime_tributario: p.regime_tributario,
        p_ambiente: p.ambiente,
        p_serie_nfce: p.serie_nfce,
        p_proximo_numero_nfce: p.proximo_numero_nfce,
        p_csc_id: p.csc_id,
        p_csc_token: p.csc_token || "",
        p_certificado_senha: p.certificado_senha || "",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  });

  return { config: data ?? null, isLoading, salvar: salvar.mutateAsync };
}

export interface ConfigCaixaUnidade {
  id: string;
  unidade_id: string;
  valor_abertura_padrao: number;
  exige_valor_abertura: boolean;
  permite_sangria: boolean;
  permite_suprimento: boolean;
  limite_sangria: number;
  exige_motivo_sangria: boolean;
  diferenca_tolerada: number;
  impressora_nome: string;
  observacao: string;
}

export function useConfigCaixaUnidade(unidadeId?: string) {
  const qc = useQueryClient();
  const chave = ["config-caixa-unidade", unidadeId];

  const { data, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_config_unidade")
        .select("*")
        .eq("unidade_id", unidadeId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ConfigCaixaUnidade | null) ?? null;
    },
  });

  const salvar = useMutation({
    mutationFn: async (p: Partial<ConfigCaixaUnidade> & { configurado_por_nome?: string }) => {
      const { error } = await supabase
        .from("caixa_config_unidade")
        .upsert({ ...p, unidade_id: unidadeId! } as never, { onConflict: "unidade_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
  });

  return { config: data ?? null, isLoading, salvar: salvar.mutateAsync };
}
