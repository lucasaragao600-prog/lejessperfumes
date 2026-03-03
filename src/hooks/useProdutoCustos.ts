import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoCusto {
  id: string;
  produtoId: string;
  data: string;
  custoUnitario: number;
  origem: "nota" | "manual" | "ajuste";
  notaId?: string;
}

export function useProdutoCustos(produtoId?: string) {
  const queryClient = useQueryClient();

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["produto_custos", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_custos")
        .select("*")
        .eq("produto_id", produtoId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        produtoId: r.produto_id,
        data: r.data,
        custoUnitario: Number(r.custo_unitario),
        origem: r.origem as "nota" | "manual" | "ajuste",
        notaId: r.nota_id,
      }));
    },
  });

  const registrarCusto = useMutation({
    mutationFn: async (params: {
      produtoId: string;
      custoUnitario: number;
      origem: "nota" | "manual" | "ajuste";
      notaId?: string;
    }) => {
      const { error } = await supabase.from("produto_custos").insert({
        produto_id: params.produtoId,
        custo_unitario: params.custoUnitario,
        origem: params.origem,
        nota_id: params.notaId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_custos"] });
    },
  });

  // Calculate and update custo_medio on perfumes table
  const atualizarCustoMedio = async (
    produtoId: string,
    estoqueAtual: number,
    custoMedioAtual: number,
    qtdEntrada: number,
    novoCusto: number
  ) => {
    const estoqueTotal = estoqueAtual + qtdEntrada;
    const custoMedio = estoqueTotal > 0
      ? (estoqueAtual * custoMedioAtual + qtdEntrada * novoCusto) / estoqueTotal
      : novoCusto;

    const { error } = await supabase
      .from("perfumes")
      .update({
        custo_medio: custoMedio,
        ultimo_custo_em: new Date().toISOString(),
      })
      .eq("id", produtoId);
    if (error) throw error;

    await registrarCusto.mutateAsync({
      produtoId,
      custoUnitario: novoCusto,
      origem: "nota",
    });

    queryClient.invalidateQueries({ queryKey: ["perfumes"] });
  };

  return {
    historico,
    isLoading,
    registrarCusto: registrarCusto.mutateAsync,
    atualizarCustoMedio,
  };
}
