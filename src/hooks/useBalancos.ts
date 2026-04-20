import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Deposito } from "@/data/mockData";

export type BalancoStatus = "rascunho" | "em_andamento" | "concluido" | "ajustado" | "cancelado";
export type ItemStatus = "pendente" | "sem_divergencia" | "sobra" | "falta";

export interface Balanco {
  id: string;
  nome: string;
  depositos: string[];
  status: BalancoStatus;
  responsavel: string;
  responsavel_id?: string | null;
  observacoes: string;
  filtros: Record<string, any>;
  iniciado_em: string;
  concluido_em?: string | null;
  ajustado_em?: string | null;
  ajustado_por?: string | null;
  cancelado_em?: string | null;
  cancelado_por?: string | null;
  motivo_cancelamento?: string | null;
  total_itens: number;
  total_conferidos: number;
  total_divergencias: number;
  total_sobras: number;
  total_faltas: number;
  valor_divergencia: number;
  created_at: string;
  updated_at: string;
}

export interface BalancoItem {
  id: string;
  balanco_id: string;
  perfume_id: string;
  perfume_codigo: string;
  perfume_nome: string;
  marca: string;
  deposito: string;
  estoque_sistema: number;
  quantidade_contada: number | null;
  diferenca: number;
  custo_unitario: number;
  impacto_financeiro: number;
  status: ItemStatus;
  justificativa: string;
  conferido_por?: string | null;
  conferido_em?: string | null;
  ajuste_aplicado: boolean;
  movimentacao_id?: string | null;
}

export interface BalancoAuditoria {
  id: string;
  balanco_id: string;
  acao: string;
  usuario: string;
  detalhes: Record<string, any>;
  created_at: string;
}

const depCol: Record<string, string> = {
  Casa: "estoque_casa",
  "Sumaúma": "estoque_sumauma",
  Amazonas: "estoque_amazonas",
};

export function useBalancos() {
  const qc = useQueryClient();

  const { data: balancos = [], isLoading } = useQuery({
    queryKey: ["balancos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balancos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Balanco[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["balancos"] });

  const log = async (balanco_id: string, acao: string, usuario: string, detalhes: any = {}) => {
    await supabase.from("balanco_auditoria").insert({
      balanco_id,
      acao,
      usuario,
      detalhes,
    });
  };

  const criarBalanco = useMutation({
    mutationFn: async (input: {
      nome: string;
      depositos: Deposito[];
      responsavel: string;
      observacoes?: string;
      filtros?: { marca?: string; tipo?: string; comEstoque?: boolean };
    }) => {
      // Buscar perfumes que casam com filtros
      const { data: perfumes, error: perr } = await supabase
        .from("perfumes")
        .select("*");
      if (perr) throw perr;

      let lista = perfumes || [];
      if (input.filtros?.marca) lista = lista.filter((p) => p.marca === input.filtros!.marca);
      if (input.filtros?.tipo) lista = lista.filter((p) => p.tipo === input.filtros!.tipo);

      // Criar snapshot por (perfume × depósito)
      const itens: any[] = [];
      for (const p of lista) {
        for (const dep of input.depositos) {
          const col = depCol[dep];
          const estoque = (p as any)[col] ?? 0;
          if (input.filtros?.comEstoque && estoque <= 0) continue;
          itens.push({
            perfume_id: p.id,
            perfume_codigo: p.codigo,
            perfume_nome: p.nome,
            marca: p.marca,
            deposito: dep,
            estoque_sistema: estoque,
            custo_unitario: Number(p.custo_medio) || Number(p.custo) || 0,
          });
        }
      }

      // Inserir balanço
      const { data: bal, error: berr } = await supabase
        .from("balancos")
        .insert({
          nome: input.nome,
          depositos: input.depositos,
          responsavel: input.responsavel,
          observacoes: input.observacoes || "",
          filtros: input.filtros || {},
          status: "em_andamento",
          total_itens: itens.length,
        })
        .select()
        .single();
      if (berr) throw berr;

      if (itens.length > 0) {
        const { error: ierr } = await supabase
          .from("balanco_itens")
          .insert(itens.map((i) => ({ ...i, balanco_id: bal.id })));
        if (ierr) throw ierr;
      }

      await log(bal.id, "criado", input.responsavel, {
        depositos: input.depositos,
        total_itens: itens.length,
      });

      return bal as Balanco;
    },
    onSuccess: invalidate,
  });

  const atualizarItem = useMutation({
    mutationFn: async (input: {
      itemId: string;
      quantidade_contada: number;
      justificativa?: string;
      conferido_por: string;
      estoque_sistema: number;
      custo_unitario: number;
    }) => {
      const diff = input.quantidade_contada - input.estoque_sistema;
      const status: ItemStatus =
        diff === 0 ? "sem_divergencia" : diff > 0 ? "sobra" : "falta";
      const { error } = await supabase
        .from("balanco_itens")
        .update({
          quantidade_contada: input.quantidade_contada,
          diferenca: diff,
          status,
          justificativa: input.justificativa || "",
          conferido_por: input.conferido_por,
          conferido_em: new Date().toISOString(),
          impacto_financeiro: Math.abs(diff) * input.custo_unitario,
        })
        .eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balanco-itens"] });
    },
  });

  const recalcularTotais = async (balancoId: string) => {
    const { data: itens } = await supabase
      .from("balanco_itens")
      .select("*")
      .eq("balanco_id", balancoId);
    const list = (itens || []) as BalancoItem[];
    const conferidos = list.filter((i) => i.status !== "pendente").length;
    const divergencias = list.filter(
      (i) => i.status === "sobra" || i.status === "falta"
    ).length;
    const sobras = list.filter((i) => i.status === "sobra").length;
    const faltas = list.filter((i) => i.status === "falta").length;
    const valor = list.reduce((s, i) => s + Number(i.impacto_financeiro || 0), 0);
    await supabase
      .from("balancos")
      .update({
        total_conferidos: conferidos,
        total_divergencias: divergencias,
        total_sobras: sobras,
        total_faltas: faltas,
        valor_divergencia: valor,
      })
      .eq("id", balancoId);
    invalidate();
  };

  const concluirBalanco = useMutation({
    mutationFn: async (input: { balancoId: string; usuario: string }) => {
      await recalcularTotais(input.balancoId);
      const { error } = await supabase
        .from("balancos")
        .update({
          status: "concluido",
          concluido_em: new Date().toISOString(),
        })
        .eq("id", input.balancoId);
      if (error) throw error;
      await log(input.balancoId, "concluido", input.usuario);
    },
    onSuccess: invalidate,
  });

  const aplicarAjustes = useMutation({
    mutationFn: async (input: { balancoId: string; usuario: string }) => {
      const { data: itens, error } = await supabase
        .from("balanco_itens")
        .select("*")
        .eq("balanco_id", input.balancoId)
        .in("status", ["sobra", "falta"])
        .eq("ajuste_aplicado", false);
      if (error) throw error;

      for (const item of (itens || []) as BalancoItem[]) {
        if (item.diferenca === 0) continue;
        const col = depCol[item.deposito];
        if (!col) continue;

        // Atualizar estoque do perfume
        const { data: perfRow } = await supabase
          .from("perfumes")
          .select(col)
          .eq("id", item.perfume_id)
          .single();
        const atual = (perfRow as any)?.[col] ?? 0;
        const novo = Math.max(0, atual + item.diferenca);
        await supabase
          .from("perfumes")
          .update({ [col]: novo })
          .eq("id", item.perfume_id);

        // Registrar movimentação
        const tipo = item.diferenca > 0 ? "Ajuste de Balanço (Entrada)" : "Ajuste de Balanço (Saída)";
        const { data: mov } = await supabase
          .from("movimentacoes")
          .insert({
            tipo,
            perfume_id: item.perfume_id,
            perfume_nome: item.perfume_nome,
            deposito: item.deposito,
            quantidade: Math.abs(item.diferenca),
            observacao: `Balanço: ${item.justificativa || "—"}`,
            registrado_por: input.usuario,
          })
          .select("id")
          .single();

        await supabase
          .from("balanco_itens")
          .update({
            ajuste_aplicado: true,
            movimentacao_id: mov?.id || null,
          })
          .eq("id", item.id);
      }

      await supabase
        .from("balancos")
        .update({
          status: "ajustado",
          ajustado_em: new Date().toISOString(),
          ajustado_por: input.usuario,
        })
        .eq("id", input.balancoId);

      await log(input.balancoId, "ajuste_aplicado", input.usuario, {
        total: (itens || []).length,
      });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["perfumes"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
  });

  const cancelarBalanco = useMutation({
    mutationFn: async (input: { balancoId: string; motivo: string; usuario: string }) => {
      const { error } = await supabase
        .from("balancos")
        .update({
          status: "cancelado",
          cancelado_em: new Date().toISOString(),
          cancelado_por: input.usuario,
          motivo_cancelamento: input.motivo,
        })
        .eq("id", input.balancoId);
      if (error) throw error;
      await log(input.balancoId, "cancelado", input.usuario, { motivo: input.motivo });
    },
    onSuccess: invalidate,
  });

  const excluirBalanco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("balancos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    balancos,
    isLoading,
    criarBalanco: criarBalanco.mutateAsync,
    atualizarItem: atualizarItem.mutateAsync,
    concluirBalanco: concluirBalanco.mutateAsync,
    aplicarAjustes: aplicarAjustes.mutateAsync,
    cancelarBalanco: cancelarBalanco.mutateAsync,
    excluirBalanco: excluirBalanco.mutateAsync,
    recalcularTotais,
  };
}

export function useBalancoItens(balancoId: string | null) {
  return useQuery({
    queryKey: ["balanco-itens", balancoId],
    enabled: !!balancoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balanco_itens")
        .select("*")
        .eq("balanco_id", balancoId!)
        .order("perfume_nome");
      if (error) throw error;
      return (data || []) as BalancoItem[];
    },
  });
}

export function useBalancoAuditoria(balancoId: string | null) {
  return useQuery({
    queryKey: ["balanco-auditoria", balancoId],
    enabled: !!balancoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balanco_auditoria")
        .select("*")
        .eq("balanco_id", balancoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BalancoAuditoria[];
    },
  });
}
