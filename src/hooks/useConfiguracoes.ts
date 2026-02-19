import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_PERFUME, CONCENTRACOES, VOLUMES_PADRAO } from "@/data/mockData";

export function useConfiguracoes() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["configuracoes"] });

  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((r) => { map[r.chave] = r.valor; });
      return map;
    },
  });

  const tiposPerfumeConfig: Record<string, string> = (data?.tipos_perfume as Record<string, string>) || (TIPOS_PERFUME as Record<string, string>);
  const concentracoesConfig: Record<string, string> = (data?.concentracoes as Record<string, string>) || (CONCENTRACOES as Record<string, string>);
  const volumesPadrao: number[] = (data?.volumes_padrao as number[]) || VOLUMES_PADRAO;

  const atualizarConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: any }) => {
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor })
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setTiposPerfumeConfig = (updater: React.SetStateAction<Record<string, string>>) => {
    const newVal = typeof updater === "function" ? updater(tiposPerfumeConfig) : updater;
    atualizarConfig.mutate({ chave: "tipos_perfume", valor: newVal });
  };

  const setConcentracoesConfig = (updater: React.SetStateAction<Record<string, string>>) => {
    const newVal = typeof updater === "function" ? updater(concentracoesConfig) : updater;
    atualizarConfig.mutate({ chave: "concentracoes", valor: newVal });
  };

  const setVolumesPadrao = (updater: React.SetStateAction<number[]>) => {
    const newVal = typeof updater === "function" ? updater(volumesPadrao) : updater;
    atualizarConfig.mutate({ chave: "volumes_padrao", valor: newVal });
  };

  return {
    tiposPerfumeConfig,
    concentracoesConfig,
    volumesPadrao,
    isLoading,
    setTiposPerfumeConfig,
    setConcentracoesConfig,
    setVolumesPadrao,
  };
}
