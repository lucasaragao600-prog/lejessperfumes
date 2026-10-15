import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Movimentacao, Deposito } from "@/data/mockData";

export function rowToMov(row: any): Movimentacao {
  return {
    id: row.id,
    data: typeof row.data === "string" ? row.data.slice(0, 10) : row.data,
    tipo: row.tipo,
    perfumeId: row.perfume_id,
    perfumeNome: row.perfume_nome,
    depositoOrigem: row.deposito_origem || undefined,
    depositoDestino: row.deposito_destino || undefined,
    deposito: row.deposito || undefined,
    quantidade: row.quantidade,
    observacao: row.observacao || undefined,
    registradoPor: row.registrado_por || "",
    criadoEm: row.created_at || undefined,
  };
}

export function useMovimentacoes() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async () => {
      const allRows: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("movimentacoes")
          .select("*")
          .order("data", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allRows.push(...(data || []));
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allRows.map(rowToMov);
    },
  });

  const adicionarMovimentacao = useMutation({
    mutationFn: async (m: Movimentacao) => {
      const { error } = await supabase.from("movimentacoes").insert({
        data: m.data,
        tipo: m.tipo,
        perfume_id: m.perfumeId,
        perfume_nome: m.perfumeNome,
        deposito_origem: m.depositoOrigem || null,
        deposito_destino: m.depositoDestino || null,
        deposito: m.deposito || null,
        quantidade: m.quantidade,
        observacao: m.observacao || "",
        registrado_por: m.registradoPor || "",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    movimentacoes,
    isLoading,
    adicionarMovimentacao: adicionarMovimentacao.mutateAsync,
    setMovimentacoes: () => {},
  };
}

export const MOV_PAGINA = 30;
export interface FiltrosMov { tipo?: string; busca?: string; ordem?: "recente" | "antiga" }

/** Movimentações paginadas no servidor (RLS por unidade aplicada no banco). */
export function useMovimentacoesLista(filtros: FiltrosMov) {
  const f: Record<string, string> = {};
  if (filtros.tipo && filtros.tipo !== "Todos") f.tipo = filtros.tipo;
  if (filtros.busca?.trim()) f.busca = filtros.busca.trim();
  if (filtros.ordem === "antiga") f.ordem = "antiga";
  return useInfiniteQuery({
    queryKey: ["movimentacoes", "lista", f],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("fn_movimentacoes_listar" as any, { p: f as any, p_limit: MOV_PAGINA, p_offset: pageParam as number });
      if (error) throw error;
      const d = (data || {}) as any;
      const asc = f.ordem === "antiga";
      const itens = ((d.itens as any[]) || []).map(rowToMov).sort((a, b) => {
        const k = (a.data + (a.criadoEm || "")).localeCompare(b.data + (b.criadoEm || ""));
        return asc ? k : -k;
      });
      return { total: Number(d.total || 0), itens, offset: pageParam as number };
    },
    getNextPageParam: (last) => last.offset + last.itens.length < last.total ? last.offset + MOV_PAGINA : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
