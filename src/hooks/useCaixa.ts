import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CaixaSessao {
  id: string;
  operadorId: string;
  operadorNome: string;
  loja: string;
  valorAbertura: number;
  valorFechamento: number | null;
  valorEsperado: number | null;
  diferenca: number | null;
  status: "aberto" | "fechado";
  abertoEm: string;
  fechadoEm: string | null;
  observacao: string;
}

export interface CaixaMovimentacao {
  id: string;
  sessaoId: string;
  tipo: "sangria" | "suprimento";
  valor: number;
  motivo: string;
  registradoPor: string;
  createdAt: string;
}

function rowToSessao(row: any): CaixaSessao {
  return {
    id: row.id,
    operadorId: row.operador_id,
    operadorNome: row.operador_nome,
    loja: row.loja,
    valorAbertura: Number(row.valor_abertura),
    valorFechamento: row.valor_fechamento != null ? Number(row.valor_fechamento) : null,
    valorEsperado: row.valor_esperado != null ? Number(row.valor_esperado) : null,
    diferenca: row.diferenca != null ? Number(row.diferenca) : null,
    status: row.status as "aberto" | "fechado",
    abertoEm: row.aberto_em,
    fechadoEm: row.fechado_em,
    observacao: row.observacao || "",
  };
}

function rowToMovimentacao(row: any): CaixaMovimentacao {
  return {
    id: row.id,
    sessaoId: row.sessao_id,
    tipo: row.tipo as "sangria" | "suprimento",
    valor: Number(row.valor),
    motivo: row.motivo || "",
    registradoPor: row.registrado_por || "",
    createdAt: row.created_at,
  };
}

export function useCaixa() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["caixa_sessoes"] });
    queryClient.invalidateQueries({ queryKey: ["caixa_movimentacoes"] });
  };

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ["caixa_sessoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_sessoes")
        .select("*")
        .order("aberto_em", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToSessao);
    },
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["caixa_movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToMovimentacao);
    },
  });

  const abrirCaixa = useMutation({
    mutationFn: async (params: { operadorId: string; operadorNome: string; loja: string; valorAbertura: number }) => {
      const { data, error } = await supabase
        .from("caixa_sessoes")
        .insert({
          operador_id: params.operadorId,
          operador_nome: params.operadorNome,
          loja: params.loja,
          valor_abertura: params.valorAbertura,
          status: "aberto",
        })
        .select()
        .single();
      if (error) throw error;
      return rowToSessao(data);
    },
    onSuccess: invalidate,
  });

  const fecharCaixa = useMutation({
    mutationFn: async (params: { sessaoId: string; valorFechamento: number; valorEsperado: number; observacao?: string }) => {
      const { error } = await supabase
        .from("caixa_sessoes")
        .update({
          valor_fechamento: params.valorFechamento,
          valor_esperado: params.valorEsperado,
          diferenca: params.valorFechamento - params.valorEsperado,
          status: "fechado",
          fechado_em: new Date().toISOString(),
          observacao: params.observacao || "",
        })
        .eq("id", params.sessaoId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const registrarMovimentacao = useMutation({
    mutationFn: async (params: { sessaoId: string; tipo: "sangria" | "suprimento"; valor: number; motivo: string; registradoPor: string }) => {
      const { error } = await supabase
        .from("caixa_movimentacoes")
        .insert({
          sessao_id: params.sessaoId,
          tipo: params.tipo,
          valor: params.valor,
          motivo: params.motivo,
          registrado_por: params.registradoPor,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const sessaoAberta = sessoes.find(s => s.status === "aberto") || null;

  return {
    sessoes,
    movimentacoes,
    sessaoAberta,
    isLoading,
    abrirCaixa: abrirCaixa.mutateAsync,
    fecharCaixa: fecharCaixa.mutateAsync,
    registrarMovimentacao: registrarMovimentacao.mutateAsync,
  };
}
