import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rowToVenda, rowToPagamento, type VendaPagamento } from "@/hooks/useVendas";
import type { Venda } from "@/data/mockData";

export const VENDAS_PAGINA = 30;

export interface FiltrosVendas {
  deposito?: string;
  vendedora?: string;
  busca?: string;
  data_ini?: string;
  data_fim?: string;
  ordem?: "recente" | "antiga";
}

export function limparFiltrosVendas(f: FiltrosVendas): FiltrosVendas {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t || t === "Todos" || t === "Todas") continue;
    if (k === "ordem" && t === "recente") continue;
    out[k] = t;
  }
  return out as FiltrosVendas;
}

/** Agrupa itens por grupo_venda preservando a ordem de chegada. */
export function agruparVendas(itens: Venda[]) {
  const grupos = new Map<string, Venda[]>();
  for (const v of itens) {
    const k = v.grupoVenda || v.id;
    const arr = grupos.get(k);
    if (arr) arr.push(v); else grupos.set(k, [v]);
  }
  return Array.from(grupos, ([grupoVenda, itens]) => ({ grupoVenda, itens }));
}

const ORIGEM = ["vendas", "venda_pagamentos", "devolucoes"];

export function useVendasLista(filtros: FiltrosVendas) {
  const qc = useQueryClient();
  useEffect(() => qc.getQueryCache().subscribe((ev: any) => {
    if (ev?.type !== "updated" || ev?.action?.type !== "invalidate") return;
    const k = ev.query?.queryKey?.[0];
    if (typeof k === "string" && ORIGEM.includes(k)) {
      qc.invalidateQueries({ queryKey: ["vendas_lista"] });
      qc.invalidateQueries({ queryKey: ["vendas_resumo"] });
    }
  }), [qc]);

  const f = limparFiltrosVendas(filtros);
  return useInfiniteQuery({
    queryKey: ["vendas_lista", f],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("fn_vendas_listar" as any, {
        p: f as any, p_limit: VENDAS_PAGINA, p_offset: pageParam as number,
      });
      if (error) throw error;
      const itens = ((data as any[]) || []).map(rowToVenda);
      const grupos = [...new Set(itens.map((v) => v.grupoVenda).filter(Boolean))];
      let pagamentos: VendaPagamento[] = [];
      if (grupos.length) {
        const { data: pg, error: e2 } = await supabase.from("venda_pagamentos").select("*").in("grupo_venda", grupos);
        if (e2) throw e2;
        pagamentos = (pg || []).map(rowToPagamento);
      }
      return { itens, pagamentos, offset: pageParam as number };
    },
    getNextPageParam: (last) => last.itens.length < VENDAS_PAGINA ? undefined : last.offset + VENDAS_PAGINA,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useVendasResumo(filtros: FiltrosVendas) {
  const f = limparFiltrosVendas({ ...filtros, ordem: undefined });
  return useQuery({
    queryKey: ["vendas_resumo", f],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_vendas_resumo" as any, { p: f as any });
      if (error) throw error;
      const r = ((data as any[]) || [])[0] || {};
      return { valor: Number(r.valor || 0), itens: Number(r.itens || 0), qtd: Number(r.qtd || 0), grupos: Number(r.grupos || 0) };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
