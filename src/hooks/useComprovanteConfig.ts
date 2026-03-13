import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlocoComprovante {
  id: string;
  label: string;
  ativo: boolean;
  alinhamento: "left" | "center" | "right";
  fontSize: number;
  fontWeight: "normal" | "bold";
  uppercase: boolean;
  italic: boolean;
  underline: boolean;
  espacamento: number;
}

export interface ComprovanteConfig {
  // Seção 1 - Gerais
  impressaoAutomatica: boolean;
  tipoComprovante: "recibo" | "cupom_fiscal" | "nota_venda" | "ordem_servico";
  formatoPapel: "58mm" | "80mm" | "A4";
  margens: { top: number; bottom: number; left: number; right: number };
  espacamentoLinhas: number;
  alinhamentoPadrao: "left" | "center" | "right";

  // Seção 2 - Blocos do layout
  blocos: BlocoComprovante[];

  // Seção 3 - Fontes
  fontFamily: string;
  fontProfiles: {
    cabecalho: { size: number; weight: string; letterSpacing: number; lineHeight: number };
    corpo: { size: number; weight: string; letterSpacing: number; lineHeight: number };
    total: { size: number; weight: string; letterSpacing: number; lineHeight: number };
    rodape: { size: number; weight: string; letterSpacing: number; lineHeight: number };
  };

  // Seção 5 - Logo
  logoLargura: number;
  logoAltura: number;
  logoAlinhamento: "left" | "center" | "right";
  logoMono: boolean;

  // Seção 6 - Mensagens
  msgAgradecimento: string;
  msgPromocional: string;
  msgLegal: string;
  msgObservacao: string;

  // Seção 9 - Avançadas
  cortarPapel: boolean;
  abrirGaveta: boolean;
  densidadeImpressao: number;
  velocidadeImpressao: number;
  codificacao: string;
}

const DEFAULT_BLOCOS: BlocoComprovante[] = [
  { id: "logo", label: "Logo da Empresa", ativo: true, alinhamento: "center", fontSize: 16, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "nome_empresa", label: "Nome da Empresa", ativo: true, alinhamento: "center", fontSize: 15, fontWeight: "bold", uppercase: true, italic: false, underline: false, espacamento: 0 },
  { id: "cnpj", label: "CNPJ / CPF", ativo: true, alinhamento: "center", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "endereco", label: "Endereço", ativo: true, alinhamento: "center", fontSize: 14, fontWeight: "normal", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "telefone", label: "Telefone / WhatsApp", ativo: true, alinhamento: "center", fontSize: 14, fontWeight: "normal", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "data_hora", label: "Data e Hora", ativo: true, alinhamento: "left", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "num_pedido", label: "Número do Pedido", ativo: true, alinhamento: "left", fontSize: 15, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "vendedor", label: "Nome do Vendedor", ativo: true, alinhamento: "left", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "lista_produtos", label: "Lista de Produtos", ativo: true, alinhamento: "left", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "subtotal", label: "Subtotal", ativo: true, alinhamento: "right", fontSize: 15, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "desconto", label: "Desconto", ativo: true, alinhamento: "right", fontSize: 15, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "total", label: "Total", ativo: true, alinhamento: "right", fontSize: 18, fontWeight: "bold", uppercase: true, italic: false, underline: false, espacamento: 0 },
  { id: "forma_pagamento", label: "Forma de Pagamento", ativo: true, alinhamento: "left", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "msg_agradecimento", label: "Mensagem de Agradecimento", ativo: true, alinhamento: "center", fontSize: 14, fontWeight: "bold", uppercase: false, italic: false, underline: false, espacamento: 0 },
  { id: "rodape", label: "Rodapé", ativo: true, alinhamento: "center", fontSize: 13, fontWeight: "normal", uppercase: false, italic: false, underline: false, espacamento: 0 },
];

export const DEFAULT_CONFIG: ComprovanteConfig = {
  impressaoAutomatica: false,
  tipoComprovante: "recibo",
  formatoPapel: "80mm",
  margens: { top: 2, bottom: 2, left: 2, right: 2 },
  espacamentoLinhas: 1.6,
  alinhamentoPadrao: "left",
  blocos: DEFAULT_BLOCOS,
  fontFamily: "Courier New",
  fontProfiles: {
    cabecalho: { size: 15, weight: "bold", letterSpacing: 0.3, lineHeight: 1.4 },
    corpo: { size: 14, weight: "bold", letterSpacing: 0.3, lineHeight: 1.4 },
    total: { size: 18, weight: "bold", letterSpacing: 0.3, lineHeight: 1.6 },
    rodape: { size: 13, weight: "normal", letterSpacing: 0.3, lineHeight: 1.4 },
  },
  logoLargura: 70,
  logoAltura: 80,
  logoAlinhamento: "center",
  logoMono: false,
  msgAgradecimento: "Obrigada pela preferência!",
  msgPromocional: "",
  msgLegal: "",
  msgObservacao: "",
  cortarPapel: false,
  abrirGaveta: false,
  densidadeImpressao: 3,
  velocidadeImpressao: 3,
  codificacao: "UTF-8",
};

export function useComprovanteConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["comprovante_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "comprovante_config")
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(data.valor as any) } as ComprovanteConfig;
    },
  });

  const salvar = useMutation({
    mutationFn: async (newConfig: ComprovanteConfig) => {
      const { data: existing } = await supabase
        .from("configuracoes")
        .select("id")
        .eq("chave", "comprovante_config")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("configuracoes")
          .update({ valor: newConfig as any })
          .eq("chave", "comprovante_config");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes")
          .insert({ chave: "comprovante_config", valor: newConfig as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comprovante_config"] });
    },
  });

  return {
    config: config || DEFAULT_CONFIG,
    isLoading,
    salvarConfig: salvar.mutateAsync,
    isSaving: salvar.isPending,
  };
}
