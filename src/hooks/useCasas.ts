import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Casa } from "@/data/mockData";

function rowToCasa(row: any): Casa {
  return {
    sigla: row.sigla,
    nome: row.nome,
    tipo: row.tipo,
  };
}

export function useCasas() {
  const queryClient = useQueryClient();

  const { data: casas = [], isLoading } = useQuery({
    queryKey: ["casas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []).map(rowToCasa);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["casas"] });

  const adicionarCasa = useMutation({
    mutationFn: async (casa: Casa) => {
      const { error } = await supabase.from("casas").insert({
        sigla: casa.sigla,
        nome: casa.nome,
        tipo: casa.tipo,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removerCasa = useMutation({
    mutationFn: async (sigla: string) => {
      const { error } = await supabase.from("casas").delete().eq("sigla", sigla);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    casas,
    isLoading,
    adicionarCasa: adicionarCasa.mutateAsync,
    removerCasa: removerCasa.mutateAsync,
    setCasas: () => {}, // backward compat
  };
}
