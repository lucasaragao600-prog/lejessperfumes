import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tester, Deposito } from "@/data/mockData";

function rowToTester(row: any): Tester {
  return {
    id: row.id,
    perfumeId: row.perfume_id,
    perfumeNome: row.perfume_nome,
    marca: row.marca,
    deposito: row.deposito as Deposito,
    quantidade: row.quantidade,
    custo: Number(row.custo),
  };
}

export function useTesters() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["testers"] });

  const { data: testers = [], isLoading } = useQuery({
    queryKey: ["testers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testers")
        .select("*")
        .order("perfume_nome");
      if (error) throw error;
      return (data || []).map(rowToTester);
    },
  });

  const adicionarTester = useMutation({
    mutationFn: async (t: { perfumeId: string; perfumeNome: string; marca: string; deposito: Deposito; quantidade: number; custo: number }) => {
      // Check if tester exists for this perfume+deposito
      const { data: existing } = await supabase
        .from("testers")
        .select("id, quantidade")
        .eq("perfume_id", t.perfumeId)
        .eq("deposito", t.deposito)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("testers")
          .update({ quantidade: existing.quantidade + t.quantidade })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("testers").insert({
          perfume_id: t.perfumeId,
          perfume_nome: t.perfumeNome,
          marca: t.marca,
          deposito: t.deposito,
          quantidade: t.quantidade,
          custo: t.custo,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const removerTester = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    testers,
    isLoading,
    adicionarTester: adicionarTester.mutateAsync,
    removerTester: removerTester.mutateAsync,
    setTesters: () => {},
  };
}
