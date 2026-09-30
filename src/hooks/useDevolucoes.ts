import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface ItemVendaGrupo {
  id: string;
  perfumeId: string;
  perfumeNome: string;
  quantidade: number;
  total: number;
  jaDevolvido: number;
}

export interface GrupoVendaDetalhe {
  grupoVenda: string;
  data: string;
  deposito: string;
  unidadeId: string | null;
  clienteId: string | null;
  vendedora: string;
  cancelada: boolean;
  itens: ItemVendaGrupo[];
  devolucoes: { id: string; numero: string; tipo: string; valor_total: number; created_at: string }[];
}

export function invalidarVendasRelacionadas(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["vendas", "venda_pagamentos", "perfumes", "estoque_unidades", "movimentacoes", "testers",
    "caixa_sessoes", "caixa_movimentacoes", "devolucoes", "credito_cliente", "grupo_venda", "devolucoes_resumo"]) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

export function useGrupoVenda(grupoVenda: string | null) {
  return useQuery({
    queryKey: ["grupo_venda", grupoVenda],
    enabled: !!grupoVenda,
    queryFn: async (): Promise<GrupoVendaDetalhe> => {
      const { data: rows, error } = await db.from("vendas").select("*").eq("grupo_venda", grupoVenda).order("created_at");
      if (error) throw error;
      if (!rows?.length) throw new Error("Venda não encontrada");
      const ids = rows.map((r: any) => r.id);
      const [{ data: devItens, error: e2 }, { data: devs, error: e3 }] = await Promise.all([
        db.from("devolucao_itens").select("venda_id, quantidade").in("venda_id", ids),
        db.from("devolucoes").select("id, numero, tipo, valor_total, created_at").eq("grupo_venda_origem", grupoVenda).order("created_at"),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      const ja = new Map<string, number>();
      (devItens || []).forEach((d: any) => ja.set(d.venda_id, (ja.get(d.venda_id) || 0) + d.quantidade));
      const f = rows[0];
      return {
        grupoVenda: grupoVenda!,
        data: String(f.data).slice(0, 10),
        deposito: f.deposito,
        unidadeId: f.unidade_id,
        clienteId: f.cliente_id,
        vendedora: f.vendedora,
        cancelada: rows.some((r: any) => r.cancelada),
        itens: rows.map((r: any) => ({
          id: r.id, perfumeId: r.perfume_id, perfumeNome: r.perfume_nome,
          quantidade: r.quantidade, total: Number(r.total), jaDevolvido: ja.get(r.id) || 0,
        })),
        devolucoes: devs || [],
      };
    },
  });
}

export function usePrazoDevolucao() {
  return useQuery({
    queryKey: ["configuracoes", "devolucao_prazo_dias"],
    queryFn: async () => {
      const { data } = await db.from("configuracoes").select("valor").eq("chave", "devolucao_prazo_dias").maybeSingle();
      return Number(data?.valor ?? 30) || 30;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreditoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["credito_cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await db.from("credito_cliente").select("saldo, validade").eq("cliente_id", clienteId).maybeSingle();
      if (error) throw error;
      return { saldo: Number(data?.saldo || 0), validade: (data?.validade as string | null) ?? null };
    },
  });
}

/** Totais de devoluções e cancelamentos por período (para vendas líquidas). */
export function useDevolucoesResumo(params: { desde: string; ate: string }) {
  return useQuery({
    queryKey: ["devolucoes_resumo", params.desde, params.ate],
    queryFn: async () => {
      const ini = `${params.desde}T04:00:00Z`;
      const fimD = new Date(`${params.ate}T04:00:00Z`);
      fimD.setUTCDate(fimD.getUTCDate() + 1);
      const { data, error } = await db.from("devolucoes").select("id, numero, tipo, valor_total, unidade_id, sessao_caixa_id, created_at")
        .gte("created_at", ini).lt("created_at", fimD.toISOString());
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, valor_total: Number(d.valor_total) })) as
        { id: string; numero: string; tipo: string; valor_total: number; unidade_id: string; sessao_caixa_id: string | null; created_at: string }[];
    },
  });
}

export function useAcoesVenda() {
  const qc = useQueryClient();
  const onSuccess = () => invalidarVendasRelacionadas(qc);

  const cancelar = useMutation({
    mutationFn: async (p: { grupoVenda: string; motivo: string }) => {
      const { data, error } = await db.rpc("fn_venda_cancelar", { p_grupo_venda: p.grupoVenda, p_motivo: p.motivo });
      if (error) throw error;
      return data as { id: string; valor: number; caixa_fechado: boolean };
    },
    onSuccess,
  });

  const devolver = useMutation({
    mutationFn: async (p: { grupoVenda: string; itens: { venda_id: string; quantidade: number; destino: string }[]; motivo: string; forma: string; clienteId?: string | null }) => {
      const { data, error } = await db.rpc("fn_devolucao_registrar", {
        p_grupo_venda: p.grupoVenda, p_itens: p.itens, p_motivo: p.motivo, p_forma_reembolso: p.forma, p_cliente_id: p.clienteId ?? null,
      });
      if (error) throw error;
      return data as { id: string; numero: string; valor: number };
    },
    onSuccess,
  });

  const trocar = useMutation({
    mutationFn: async (p: {
      grupoVenda: string; itensDevolvidos: { venda_id: string; quantidade: number; destino: string }[];
      itensNovos: { produto_id: string; quantidade: number; preco_unitario: number }[]; motivo: string;
      pagamentos: { tipo_pagamento: string; bandeira: string; valor: number }[]; formaDiferenca: string | null; clienteId?: string | null;
    }) => {
      const { data, error } = await db.rpc("fn_troca_registrar", {
        p_grupo_venda: p.grupoVenda, p_itens_devolvidos: p.itensDevolvidos, p_itens_novos: p.itensNovos, p_motivo: p.motivo,
        p_pagamentos: p.pagamentos, p_forma_diferenca: p.formaDiferenca, p_cliente_id: p.clienteId ?? null, p_vendedora: "",
      });
      if (error) throw error;
      return data as { id: string; numero: string; valor_devolvido: number; valor_novo: number; diferenca: number };
    },
    onSuccess,
  });

  return { cancelar, devolver, trocar };
}

export async function usarCredito(clienteId: string, valor: number, unidadeId?: string | null) {
  const { data, error } = await db.rpc("fn_credito_usar", { p_cliente_id: clienteId, p_valor: valor, p_grupo_venda: null, p_unidade_id: unidadeId ?? null });
  if (error) throw error;
  return Number(data);
}
