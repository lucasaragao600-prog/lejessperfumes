import { supabase } from "@/integrations/supabase/client";

export type PerfilIA = { familia: string; saida: string; coracao: string; fundo: string; confianca: "alta" | "media" | "baixa" };

async function chamar<T>(body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("perfil-olfativo-ia", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* mantém */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export const sugerirPerfil = (marca: string, nome: string, concentracao?: string) =>
  chamar<{ resultados: PerfilIA[] }>({ modo: "sugerir", itens: [{ marca, nome, concentracao }] }).then((r) => r.resultados[0]);

/** Preenche em segundo plano produtos recém-cadastrados sem perfil (só campos vazios). */
export const preencherPorCodigos = (codigos: string[]) =>
  chamar<{ preenchidos: number }>({ modo: "codigos", codigos });

export const preencherLote = (ignorar: string[]) =>
  chamar<{ processados: number; preenchidos: number; ids: string[]; restantes: number }>({ modo: "lote", ignorar });
