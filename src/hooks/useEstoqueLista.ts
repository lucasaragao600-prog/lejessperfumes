import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Perfume } from "@/data/mockData";
import { rowToPerfume } from "@/hooks/usePerfumes";

export const ESTOQUE_PAGINA = 30;

export interface FiltrosEstoque {
  busca?: string;
  unidade?: string;
  tipo?: string;
  classificacao?: string;
  custo_min?: string;
  custo_max?: string;
  venda_min?: string;
  venda_max?: string;
  estoque_min?: string;
  estoque_max?: string;
  alertas?: boolean;
  ordem?: "none" | "asc" | "desc";
  especial?: "sem_barcode" | "sem_tester";
}

export interface ItemEstoque extends Perfume {
  qtd: number;
  testerQtd: number;
  testers: Record<string, number>;
}

export interface ResumoEstoque {
  total: number;
  unidades: number;
  custo: number;
  venda: number;
  por_unidade: Record<string, number>;
  alertas: number;
  sem_barcode: number;
  sem_tester: number;
}

/** Remove filtros vazios para a chave de cache e o envio ao banco. */
export function limparFiltros(f: FiltrosEstoque): FiltrosEstoque {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (k === "ordem" && v === "none") continue;
    if ((k === "unidade" || k === "tipo" || k === "classificacao") && v === "Todos") continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out as FiltrosEstoque;
}

export function rowToItemEstoque(row: any, chaves: string[]): ItemEstoque {
  const base = rowToPerfume(row);
  const estoques: Record<string, number> = {};
  for (const c of chaves) estoques[c] = Number(row.estoques?.[c] ?? 0);
  for (const [k, v] of Object.entries(row.estoques || {})) if (!(k in estoques)) estoques[k] = Number(v);
  return {
    ...base,
    estoques: estoques as Perfume["estoques"],
    qtd: Number(row.qtd ?? 0),
    testerQtd: Number(row.tester_qtd ?? 0),
    testers: Object.fromEntries(Object.entries(row.testers || {}).map(([k, v]) => [k, Number(v)])),
  };
}

export async function buscarEstoque(filtros: FiltrosEstoque, limite: number, offset: number, chaves: string[]) {
  const { data, error } = await supabase.rpc("fn_estoque_listar" as any, {
    p_filtros: limparFiltros(filtros) as any,
    p_limite: limite,
    p_offset: offset,
  });
  if (error) throw error;
  const d = data as any;
  return { total: Number(d?.total ?? 0), itens: ((d?.itens as any[]) || []).map((r) => rowToItemEstoque(r, chaves)) };
}

const CHAVES_ORIGEM = ["perfumes", "estoque_unidades", "testers", "movimentacoes", "vendas", "reposicoes", "transferencias"];

/** Recarrega a lista quando qualquer ação de estoque invalida os dados antigos. */
function useInvalidacaoEstoque() {
  const qc = useQueryClient();
  useEffect(() => {
    return qc.getQueryCache().subscribe((ev: any) => {
      if (ev?.type !== "updated" || ev?.action?.type !== "invalidate") return;
      const k = ev.query?.queryKey?.[0];
      if (typeof k === "string" && CHAVES_ORIGEM.includes(k)) {
        qc.invalidateQueries({ queryKey: ["estoque_lista"] });
        qc.invalidateQueries({ queryKey: ["estoque_resumo"] });
      }
    });
  }, [qc]);
}

export function useEstoqueLista(filtros: FiltrosEstoque, chaves: string[]) {
  useInvalidacaoEstoque();
  const f = limparFiltros(filtros);
  return useInfiniteQuery({
    queryKey: ["estoque_lista", f, chaves],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => buscarEstoque(f, ESTOQUE_PAGINA, pageParam as number, chaves),
    getNextPageParam: (last, pages) => {
      const carregados = pages.reduce((a, p) => a + p.itens.length, 0);
      return carregados < last.total ? carregados : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useEstoqueResumo(filtros: FiltrosEstoque) {
  const f = limparFiltros({ ...filtros, ordem: "none" });
  return useQuery({
    queryKey: ["estoque_resumo", f],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_estoque_resumo" as any, { p_filtros: f as any });
      if (error) throw error;
      const d = (data || {}) as any;
      return {
        total: Number(d.total || 0),
        unidades: Number(d.unidades || 0),
        custo: Number(d.custo || 0),
        venda: Number(d.venda || 0),
        por_unidade: d.por_unidade || {},
        alertas: Number(d.alertas || 0),
        sem_barcode: Number(d.sem_barcode || 0),
        sem_tester: Number(d.sem_tester || 0),
      } as ResumoEstoque;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
