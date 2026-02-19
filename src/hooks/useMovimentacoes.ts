import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Movimentacao, Deposito } from "@/data/mockData";

function rowToMov(row: any): Movimentacao {
  return {
    id: row.id,
    data: typeof row.data === "string" ? row.data.slice(0, 10) : row.data,
    tipo: row.tipo,
    perfumeId: row.perfume_id,
    perfumeNome: row.perfume_nome,
    depositoOrigem: row.deposito_origem || undefined,
    depositoDestino: row.deposito_destino || undefined,
    deposito: row.deposito || undefined,
    quantidade: row.quantidade,
    observacao: row.observacao || undefined,
  };
}

export function useMovimentacoes() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToMov);
    },
  });

  const adicionarMovimentacao = useMutation({
    mutationFn: async (m: Movimentacao) => {
      const { error } = await supabase.from("movimentacoes").insert({
        data: m.data,
        tipo: m.tipo,
        perfume_id: m.perfumeId,
        perfume_nome: m.perfumeNome,
        deposito_origem: m.depositoOrigem || null,
        deposito_destino: m.depositoDestino || null,
        deposito: m.deposito || null,
        quantidade: m.quantidade,
        observacao: m.observacao || "",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    movimentacoes,
    isLoading,
    adicionarMovimentacao: adicionarMovimentacao.mutateAsync,
    setMovimentacoes: () => {},
  };
}
