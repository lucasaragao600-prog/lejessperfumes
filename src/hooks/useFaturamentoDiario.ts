import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { limparFiltrosVendas, type FiltrosVendas } from "@/hooks/useVendasLista";

export interface FaturamentoDia {
  dia: string;
  bruto: number;
  devolvido: number;
  liquido: number;
  itens: number;
  qtd: number;
  pedidos: number;
}

/** Faturamento agregado por dia, calculado no servidor respeitando o acesso por unidade. */
export function useFaturamentoDiario(filtros: FiltrosVendas) {
  const f = limparFiltrosVendas(filtros);
  if (f.deposito === "todos") delete f.deposito;
  return useQuery({
    queryKey: ["faturamento_diario", f],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_faturamento_diario" as any, { p: f as any });
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        dia: String(r.dia),
        bruto: Number(r.bruto || 0),
        devolvido: Number(r.devolvido || 0),
        liquido: Number(r.liquido || 0),
        itens: Number(r.itens || 0),
        qtd: Number(r.qtd || 0),
        pedidos: Number(r.pedidos || 0),
      })) as FaturamentoDia[];
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
