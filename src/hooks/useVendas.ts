import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Venda, Deposito, TipoPagamento, Bandeira, TipoAjusteValor } from "@/data/mockData";

function rowToVenda(row: any): Venda {
  return {
    id: row.id,
    data: typeof row.data === "string" ? row.data.slice(0, 10) : row.data,
    perfumeId: row.perfume_id,
    perfumeNome: row.perfume_nome,
    deposito: row.deposito as Deposito,
    quantidade: row.quantidade,
    precoUnitario: Number(row.preco_unitario),
    tipoAjuste: row.tipo_ajuste as TipoAjusteValor,
    desconto: Number(row.desconto),
    total: Number(row.total),
    vendedora: row.vendedora,
    tipoPagamento: row.tipo_pagamento as TipoPagamento,
    bandeira: row.bandeira as Bandeira,
    observacao: row.observacao,
  };
}

export function useVendas() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vendas"] });

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToVenda);
    },
  });

  const adicionarVenda = useMutation({
    mutationFn: async (v: Venda) => {
      const { error } = await supabase.from("vendas").insert({
        perfume_id: v.perfumeId,
        perfume_nome: v.perfumeNome,
        deposito: v.deposito,
        quantidade: v.quantidade,
        preco_unitario: v.precoUnitario,
        tipo_ajuste: v.tipoAjuste,
        desconto: v.desconto,
        total: v.total,
        vendedora: v.vendedora,
        tipo_pagamento: v.tipoPagamento,
        bandeira: v.bandeira,
        observacao: v.observacao,
        data: v.data,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    vendas,
    isLoading,
    adicionarVenda: adicionarVenda.mutateAsync,
    setVendas: () => {},
  };
}
