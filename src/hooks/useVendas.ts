import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Venda, Deposito, TipoPagamento, Bandeira, TipoAjusteValor, NfceStatus } from "@/data/mockData";

export interface VendaPagamento {
  id?: string;
  grupoVenda: string;
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  valor: number;
}

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
    registradoPor: row.registrado_por || "",
    grupoVenda: row.grupo_venda || "",
    clienteId: row.cliente_id || null,
    nfceStatus: (row.nfce_status as NfceStatus) || "pendente",
    nfceChave: row.nfce_chave || "",
  };
}

function rowToPagamento(row: any): VendaPagamento {
  return {
    id: row.id,
    grupoVenda: row.grupo_venda,
    tipoPagamento: row.tipo_pagamento as TipoPagamento,
    bandeira: row.bandeira as Bandeira,
    valor: Number(row.valor),
  };
}

export function useVendas() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vendas"] });
    queryClient.invalidateQueries({ queryKey: ["venda_pagamentos"] });
  };

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

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["venda_pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_pagamentos")
        .select("*");
      if (error) throw error;
      return (data || []).map(rowToPagamento);
    },
  });

  const adicionarVendaMulti = useMutation({
    mutationFn: async ({
      itens,
      pagamentosVenda,
    }: {
      itens: Venda[];
      pagamentosVenda: Omit<VendaPagamento, "id">[];
    }) => {
      const grupoVenda = crypto.randomUUID();

      // Insert all items with same grupo_venda
      const rows = itens.map((v) => ({
        perfume_id: v.perfumeId,
        perfume_nome: v.perfumeNome,
        deposito: v.deposito,
        quantidade: v.quantidade,
        preco_unitario: v.precoUnitario,
        tipo_ajuste: v.tipoAjuste,
        desconto: v.desconto,
        total: v.total,
        vendedora: v.vendedora,
        tipo_pagamento: pagamentosVenda[0]?.tipoPagamento || "Pix",
        bandeira: pagamentosVenda[0]?.bandeira || "N/A",
        observacao: v.observacao,
        data: v.data,
        registrado_por: v.registradoPor || "",
        grupo_venda: grupoVenda,
      }));

      const { error: errV } = await supabase.from("vendas").insert(rows);
      if (errV) throw errV;

      // Insert payments
      const pagRows = pagamentosVenda.map((p) => ({
        grupo_venda: grupoVenda,
        tipo_pagamento: p.tipoPagamento,
        bandeira: p.bandeira,
        valor: p.valor,
      }));

      const { error: errP } = await supabase.from("venda_pagamentos").insert(pagRows);
      if (errP) throw errP;
    },
    onSuccess: invalidate,
  });

  const adicionarVenda = useMutation({
    mutationFn: async (v: Venda) => {
      const grupoVenda = crypto.randomUUID();
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
        registrado_por: v.registradoPor || "",
        grupo_venda: grupoVenda,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirVenda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizarNfceStatus = useMutation({
    mutationFn: async (params: { grupoVenda: string; nfceStatus: string; nfceChave?: string }) => {
      const updates: any = { nfce_status: params.nfceStatus };
      if (params.nfceChave) updates.nfce_chave = params.nfceChave;
      const { error } = await supabase
        .from("vendas")
        .update(updates)
        .eq("grupo_venda", params.grupoVenda);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    vendas,
    pagamentos,
    isLoading,
    adicionarVenda: adicionarVenda.mutateAsync,
    adicionarVendaMulti: adicionarVendaMulti.mutateAsync,
    excluirVenda: excluirVenda.mutateAsync,
    atualizarNfceStatus: atualizarNfceStatus.mutateAsync,
    setVendas: () => {},
  };
}
