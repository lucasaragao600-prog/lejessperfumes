import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVendedoras() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vendedoras"] });

  const { data: vendedoras = [], isLoading } = useQuery({
    queryKey: ["vendedoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedoras")
        .select("nome")
        .order("nome");
      if (error) throw error;
      return (data || []).map((r) => r.nome);
    },
  });

  const adicionar = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("vendedoras").insert({ nome });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remover = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("vendedoras").delete().eq("nome", nome);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    vendedoras,
    isLoading,
    adicionarVendedora: adicionar.mutateAsync,
    removerVendedora: remover.mutateAsync,
    setVendedoras: () => {},
  };
}
