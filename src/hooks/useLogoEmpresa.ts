import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoPadrao from "@/assets/logo-le-jess.png";

const CHAVE = "lejess_logo_url";

/** Logo atual da empresa (Configurações). Sem logo cadastrada, usa a logo padrão Le Jess. */
export async function buscarLogoEmpresa(): Promise<string> {
  const { data } = await supabase.from("configuracoes_fiscais").select("logo_url").limit(1).maybeSingle();
  const url = (data as any)?.logo_url || "";
  try { url ? localStorage.setItem(CHAVE, url) : localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
  return url;
}

export function logoEmCache(): string {
  try { return localStorage.getItem(CHAVE) || ""; } catch { return ""; }
}

export function useLogoEmpresa() {
  const { data } = useQuery({
    queryKey: ["logo_empresa"],
    queryFn: buscarLogoEmpresa,
    initialData: logoEmCache,
    staleTime: 60_000,
  });
  const personalizada = !!data;
  return { src: data || logoPadrao, personalizada };
}

export { logoPadrao };
