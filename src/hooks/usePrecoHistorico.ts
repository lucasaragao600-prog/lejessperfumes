import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrecoHistorico {
  id: string;
  produtoId: string;
  precoAntigo: number;
  precoNovo: number;
  alteradoPor: string;
  data: string;
}

export function usePrecoHistorico(produtoId?: string) {
  const queryClient = useQueryClient();

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["preco_historico", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preco_historico")
        .select("*")
        .eq("produto_id", produtoId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        produtoId: r.produto_id,
        precoAntigo: Number(r.preco_antigo),
        precoNovo: Number(r.preco_novo),
        alteradoPor: r.alterado_por,
        data: r.data,
      }));
    },
  });

  const registrar = useMutation({
    mutationFn: async (params: {
      produtoId: string;
      precoAntigo: number;
      precoNovo: number;
      alteradoPor: string;
    }) => {
      const { error } = await supabase.from("preco_historico").insert({
        produto_id: params.produtoId,
        preco_antigo: params.precoAntigo,
        preco_novo: params.precoNovo,
        alterado_por: params.alteradoPor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preco_historico"] });
    },
  });

  return {
    historico,
    isLoading,
    registrar: registrar.mutateAsync,
  };
}
