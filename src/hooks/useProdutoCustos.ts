import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoCusto {
  id: string;
  produtoId: string;
  data: string;
  custoUnitario: number;
  origem: "nota" | "manual" | "ajuste";
  notaId?: string;
  quantidade: number;
  valorProduto: number;
  valorIcms: number;
  valorIpi: number;
  valorFrete: number;
  valorSeguro: number;
  valorOutros: number;
  valorDesconto: number;
  observacao: string;
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
        quantidade: Number(r.quantidade ?? 0),
        valorProduto: Number(r.valor_produto ?? 0),
        valorIcms: Number(r.valor_icms ?? 0),
        valorIpi: Number(r.valor_ipi ?? 0),
        valorFrete: Number(r.valor_frete ?? 0),
        valorSeguro: Number(r.valor_seguro ?? 0),
        valorOutros: Number(r.valor_outros ?? 0),
        valorDesconto: Number(r.valor_desconto ?? 0),
        observacao: String(r.observacao ?? ""),
      }));
    },
  });

  const registrarCusto = useMutation({
    mutationFn: async (params: {
      produtoId: string;
      custoUnitario: number;
      origem: "nota" | "manual" | "ajuste";
      notaId?: string;
      quantidade?: number;
      valorProduto?: number;
      valorIcms?: number;
      valorIpi?: number;
      valorFrete?: number;
      valorSeguro?: number;
      valorOutros?: number;
      valorDesconto?: number;
      observacao?: string;
    }) => {
      const { error } = await supabase.from("produto_custos").insert({
        produto_id: params.produtoId,
        custo_unitario: params.custoUnitario,
        origem: params.origem,
        nota_id: params.notaId || null,
        quantidade: params.quantidade ?? 0,
        valor_produto: params.valorProduto ?? 0,
        valor_icms: params.valorIcms ?? 0,
        valor_ipi: params.valorIpi ?? 0,
        valor_frete: params.valorFrete ?? 0,
        valor_seguro: params.valorSeguro ?? 0,
        valor_outros: params.valorOutros ?? 0,
        valor_desconto: params.valorDesconto ?? 0,
        observacao: params.observacao ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_custos"] });
    },
  });

  // Atualiza custo médio + custo padrão do produto e registra histórico discriminado
  const atualizarCustoMedio = async (
    produtoId: string,
    estoqueAtual: number,
    custoMedioAtual: number,
    qtdEntrada: number,
    novoCusto: number,
    detalhes?: {
      notaId?: string;
      valorProduto?: number;
      valorIcms?: number;
      valorIpi?: number;
      valorFrete?: number;
      valorSeguro?: number;
      valorOutros?: number;
      valorDesconto?: number;
      observacao?: string;
    }
  ) => {
    const estoqueTotal = estoqueAtual + qtdEntrada;
    const custoMedio = estoqueTotal > 0
      ? (estoqueAtual * custoMedioAtual + qtdEntrada * novoCusto) / estoqueTotal
      : novoCusto;

    // Atualiza custo padrão (custo) com o último custo real e o custo médio ponderado
    const { error } = await supabase
      .from("perfumes")
      .update({
        custo: novoCusto,
        custo_medio: custoMedio,
        ultimo_custo_em: new Date().toISOString(),
      })
      .eq("id", produtoId);
    if (error) throw error;

    await registrarCusto.mutateAsync({
      produtoId,
      custoUnitario: novoCusto,
      origem: "nota",
      notaId: detalhes?.notaId,
      quantidade: qtdEntrada,
      valorProduto: detalhes?.valorProduto,
      valorIcms: detalhes?.valorIcms,
      valorIpi: detalhes?.valorIpi,
      valorFrete: detalhes?.valorFrete,
      valorSeguro: detalhes?.valorSeguro,
      valorOutros: detalhes?.valorOutros,
      valorDesconto: detalhes?.valorDesconto,
      observacao: detalhes?.observacao,
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
