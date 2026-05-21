import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Deposito } from "@/data/mockData";
import { resolverCodigoProduto } from "./useProdutoGtins";
import { registrarLeitura } from "./useBalancoLeituras";

export type BalancoStatus = "rascunho" | "em_andamento" | "concluido" | "ajustado" | "cancelado";
export type ItemStatus = "pendente" | "sem_divergencia" | "sobra" | "falta";
export type TipoContagem = "normal" | "cega";
export type ModoContagem = "codigo_barras" | "manual";

export interface Balanco {
  id: string;
  nome: string;
  depositos: string[];
  status: BalancoStatus;
  responsavel: string;
  responsavel_id?: string | null;
  observacoes: string;
  filtros: Record<string, any>;
  tipo_contagem: TipoContagem;
  modo_contagem: ModoContagem;
  dupla_conferencia: boolean;
  areas_split: boolean;
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

export type Area = "deposito" | "salao";

export interface BalancoItem {
  id: string;
  balanco_id: string;
  perfume_id: string;
  perfume_codigo: string;
  perfume_nome: string;
  marca: string;
  casa_sigla?: string | null;
  concentracao?: string | null;
  volume?: number | null;
  tamanho?: string | null;
  codigo_barras?: string | null;
  image_url?: string | null;
  deposito: string;
  estoque_sistema: number;
  quantidade_contada: number | null;
  quantidade_contada_2: number | null;
  quantidade_deposito: number | null;
  quantidade_salao: number | null;
  vendas_durante: number;
  diferenca: number;
  custo_unitario: number;
  impacto_financeiro: number;
  status: ItemStatus;
  justificativa: string;
  conferido_por?: string | null;
  conferido_em?: string | null;
  conferido_por_2?: string | null;
  conferido_em_2?: string | null;
  divergencia_contadores: boolean;
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
  const invalidateItens = () => qc.invalidateQueries({ queryKey: ["balanco-itens"] });

  const log = async (balanco_id: string, acao: string, usuario: string, detalhes: any = {}) => {
    await supabase.from("balanco_auditoria").insert({ balanco_id, acao, usuario, detalhes });
  };

  const criarBalanco = useMutation({
    mutationFn: async (input: {
      nome: string;
      depositos: Deposito[];
      responsavel: string;
      observacoes?: string;
      tipo_contagem: TipoContagem;
      modo_contagem: ModoContagem;
      dupla_conferencia: boolean;
      areas_split?: boolean;
      filtros?: { marca?: string; tipo?: string; comEstoque?: boolean };
    }) => {
      // paginação para >1000 produtos
      const todos: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("perfumes")
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        todos.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      let lista = todos;
      if (input.filtros?.marca) lista = lista.filter((p) => p.marca === input.filtros!.marca);
      if (input.filtros?.tipo) lista = lista.filter((p) => p.tipo === input.filtros!.tipo);

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

      const { data: bal, error: berr } = await supabase
        .from("balancos")
        .insert({
          nome: input.nome,
          depositos: input.depositos,
          responsavel: input.responsavel,
          observacoes: input.observacoes || "",
          filtros: input.filtros || {},
          tipo_contagem: input.tipo_contagem,
          modo_contagem: input.modo_contagem,
          dupla_conferencia: input.dupla_conferencia,
          areas_split: !!input.areas_split,
          status: "em_andamento",
          total_itens: itens.length,
        })
        .select()
        .single();
      if (berr) throw berr;

      // inserir em chunks
      const CHUNK = 500;
      for (let i = 0; i < itens.length; i += CHUNK) {
        const slice = itens.slice(i, i + CHUNK).map((x) => ({ ...x, balanco_id: bal.id }));
        const { error: ierr } = await supabase.from("balanco_itens").insert(slice);
        if (ierr) throw ierr;
      }

      await log(bal.id, "criado", input.responsavel, {
        depositos: input.depositos,
        total_itens: itens.length,
        tipo_contagem: input.tipo_contagem,
        modo_contagem: input.modo_contagem,
        areas_split: !!input.areas_split,
      });

      return bal as Balanco;
    },
    onSuccess: invalidate,
  });


  /** Atualiza item (1ª ou 2ª contagem) e recalcula campos derivados */
  const atualizarItem = useMutation({
    mutationFn: async (input: {
      itemId: string;
      quantidade_contada: number;
      contagem?: 1 | 2;
      justificativa?: string;
      conferido_por: string;
      estoque_sistema: number;
      custo_unitario: number;
    }) => {
      const contagem = input.contagem ?? 1;
      const diff = input.quantidade_contada - input.estoque_sistema;
      const status: ItemStatus =
        diff === 0 ? "sem_divergencia" : diff > 0 ? "sobra" : "falta";
      const now = new Date().toISOString();

      const patch: Record<string, any> =
        contagem === 1
          ? {
              quantidade_contada: input.quantidade_contada,
              diferenca: diff,
              status,
              justificativa: input.justificativa ?? undefined,
              conferido_por: input.conferido_por,
              conferido_em: now,
              impacto_financeiro: Math.abs(diff) * input.custo_unitario,
            }
          : {
              quantidade_contada_2: input.quantidade_contada,
              conferido_por_2: input.conferido_por,
              conferido_em_2: now,
            };

      // Calcular divergência entre contadores
      if (contagem === 2) {
        const { data: row } = await supabase
          .from("balanco_itens")
          .select("quantidade_contada")
          .eq("id", input.itemId)
          .maybeSingle();
        const c1 = row?.quantidade_contada;
        if (c1 != null) {
          patch.divergencia_contadores = c1 !== input.quantidade_contada;
        }
      }

      const { error } = await supabase.from("balanco_itens").update(patch).eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: invalidateItens,
  });

  /**
   * Bipa um código durante contagem por código de barras.
   * - Procura GTIN, depois SKU
   * - Se achar produto E item existente no balanço → +qtd na contagem (1 ou 2)
   * - Se achar produto mas item não existir (ex: balanço filtrou por marca) → erro tipo "produto_fora_balanco"
   * - Se não achar → registra leitura como não-encontrada e devolve 'nao_encontrado'
   */
  const bipar = async (input: {
    balancoId: string;
    codigo: string;
    quantidade?: number;
    deposito?: string;
    contagem?: 1 | 2;
    usuario: string;
  }): Promise<
    | { tipo: "ok"; item: BalancoItem; origem: "gtin" | "sku"; novaQtd: number }
    | { tipo: "produto_fora_balanco"; perfumeId: string }
    | { tipo: "nao_encontrado" }
  > => {
    const qtd = input.quantidade ?? 1;
    const contagem = input.contagem ?? 1;
    const resolvido = await resolverCodigoProduto(input.codigo);

    if (!resolvido) {
      await registrarLeitura({
        balanco_id: input.balancoId,
        perfume_id: null,
        codigo_lido: input.codigo,
        encontrado: false,
        origem: "manual",
        quantidade: qtd,
        contagem,
        usuario: input.usuario,
      });
      return { tipo: "nao_encontrado" };
    }

    // Buscar item correspondente no balanço (mesmo perfume, depósito opcional)
    let q = supabase
      .from("balanco_itens")
      .select("*")
      .eq("balanco_id", input.balancoId)
      .eq("perfume_id", resolvido.perfumeId);
    if (input.deposito) q = q.eq("deposito", input.deposito);
    const { data: itens } = await q;

    if (!itens || itens.length === 0) {
      await registrarLeitura({
        balanco_id: input.balancoId,
        perfume_id: resolvido.perfumeId,
        codigo_lido: input.codigo,
        encontrado: false,
        origem: resolvido.origem,
        quantidade: qtd,
        contagem,
        usuario: input.usuario,
      });
      return { tipo: "produto_fora_balanco", perfumeId: resolvido.perfumeId };
    }

    // Se há múltiplos depósitos no balanço e usuário não filtrou: usar o primeiro com pendência ou o primeiro
    const item = (itens.find((i: any) =>
      contagem === 1 ? i.quantidade_contada == null : i.quantidade_contada_2 == null
    ) || itens[0]) as BalancoItem;

    const atualCount =
      contagem === 1
        ? Number(item.quantidade_contada ?? 0)
        : Number(item.quantidade_contada_2 ?? 0);
    const novaQtd = atualCount + qtd;

    await atualizarItem.mutateAsync({
      itemId: item.id,
      quantidade_contada: novaQtd,
      contagem,
      conferido_por: input.usuario,
      estoque_sistema: item.estoque_sistema,
      custo_unitario: item.custo_unitario,
      justificativa: item.justificativa,
    });

    await registrarLeitura({
      balanco_id: input.balancoId,
      perfume_id: resolvido.perfumeId,
      codigo_lido: input.codigo,
      encontrado: true,
      origem: resolvido.origem,
      quantidade: qtd,
      contagem,
      usuario: input.usuario,
    });

    return { tipo: "ok", item: { ...item, quantidade_contada: novaQtd }, origem: resolvido.origem, novaQtd };
  };

  const recalcularTotais = async (balancoId: string) => {
    const list: BalancoItem[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("balanco_itens")
        .select("*")
        .eq("balanco_id", balancoId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data || []) as BalancoItem[];
      list.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    const conferidos = list.filter((i) => i.status !== "pendente").length;
    const divergencias = list.filter((i) => i.status === "sobra" || i.status === "falta").length;
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
        .update({ status: "concluido", concluido_em: new Date().toISOString() })
        .eq("id", input.balancoId);
      if (error) throw error;
      await log(input.balancoId, "concluido", input.usuario);
    },
    onSuccess: invalidate,
  });

  const aplicarAjustes = useMutation({
    mutationFn: async (input: { balancoId: string; usuario: string }) => {
      const itens: BalancoItem[] = [];
      const PAGE = 1000;
      let pageFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from("balanco_itens")
          .select("*")
          .eq("balanco_id", input.balancoId)
          .in("status", ["sobra", "falta"])
          .eq("ajuste_aplicado", false)
          .range(pageFrom, pageFrom + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as BalancoItem[];
        itens.push(...rows);
        if (rows.length < PAGE) break;
        pageFrom += PAGE;
      }

      for (const item of itens) {

        if (item.diferenca === 0) continue;
        const col = depCol[item.deposito];
        if (!col) continue;

        const { data: perfRow } = await supabase
          .from("perfumes")
          .select(col)
          .eq("id", item.perfume_id)
          .single();
        const atual = (perfRow as any)?.[col] ?? 0;
        const novo = Math.max(0, atual + item.diferenca);
        await supabase.from("perfumes").update({ [col]: novo }).eq("id", item.perfume_id);

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
          .update({ ajuste_aplicado: true, movimentacao_id: mov?.id || null })
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

      await log(input.balancoId, "ajuste_aplicado", input.usuario, { total: itens.length });
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
    bipar,
    concluirBalanco: concluirBalanco.mutateAsync,
    aplicarAjustes: aplicarAjustes.mutateAsync,
    cancelarBalanco: cancelarBalanco.mutateAsync,
    excluirBalanco: excluirBalanco.mutateAsync,
    recalcularTotais,
  };
}

export function useBalancoItens(balancoId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!balancoId) return;
    const channel = supabase
      .channel(`balanco-itens-${balancoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balanco_itens", filter: `balanco_id=eq.${balancoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["balanco-itens", balancoId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "balancos", filter: `id=eq.${balancoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["balancos"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [balancoId, qc]);

  return useQuery({
    queryKey: ["balanco-itens", balancoId],
    enabled: !!balancoId,
    queryFn: async () => {
      const all: any[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("balanco_itens")
          .select("*, perfumes(image_url, casa_sigla, concentracao, volume, tamanho, codigo_barras)")
          .eq("balanco_id", balancoId!)
          .order("perfume_nome")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }

      return all.map((row: any) => {

        const perfume = row.perfumes || {};
        const { perfumes, ...item } = row;
        return {
          ...item,
          image_url: perfume.image_url || null,
          casa_sigla: perfume.casa_sigla || null,
          concentracao: perfume.concentracao || null,
          volume: perfume.volume ?? null,
          tamanho: perfume.tamanho || null,
          codigo_barras: perfume.codigo_barras || null,
        } as BalancoItem;
      });
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
