import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReposicaoStatus =
  | "rascunho"
  | "em_separacao"
  | "pronta_envio"
  | "em_transito"
  | "aguardando_conferencia"
  | "em_conferencia"
  | "com_divergencia"
  | "conferida"
  | "finalizada"
  | "cancelada";

export const STATUS_META: Record<ReposicaoStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  em_separacao: { label: "Em separação", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  pronta_envio: { label: "Pronta para envio", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  em_transito: { label: "Em trânsito", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  aguardando_conferencia: { label: "Aguardando conferência", className: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  em_conferencia: { label: "Em conferência", className: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  com_divergencia: { label: "Com divergência", className: "bg-destructive/10 text-destructive border-destructive/30" },
  conferida: { label: "Conferida", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  finalizada: { label: "Finalizada", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

export const TIPOS_DIVERGENCIA = [
  "Produto faltando",
  "Quantidade menor",
  "Quantidade maior",
  "Produto não enviado",
  "Produto incorreto",
  "Produto danificado",
  "Produto sem cadastro",
  "Outro",
] as const;

export interface Reposicao {
  id: string;
  codigo: string;
  origem: string;
  destino: string;
  status: ReposicaoStatus;
  observacoes: string;
  criado_por: string | null;
  criado_por_nome: string;
  separado_por_nome: string | null;
  separado_em: string | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  recebido_por_nome: string | null;
  recebido_em: string | null;
  finalizado_por_nome: string | null;
  finalizado_em: string | null;
  cancelado_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReposicaoItem {
  id: string;
  reposicao_id: string;
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade_solicitada: number;
  quantidade_separada: number | null;
  quantidade_enviada: number | null;
  quantidade_recebida: number | null;
  status: string;
}

export interface ReposicaoConferencia {
  id: string;
  reposicao_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  usuario_nome: string;
  created_at: string;
}

export interface ReposicaoDivergencia {
  id: string;
  reposicao_id: string;
  produto_id: string | null;
  produto_nome: string;
  tipo: string;
  quantidade_esperada: number;
  quantidade_recebida: number;
  justificativa: string;
  foto_url: string | null;
  usuario_nome: string;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  created_at: string;
}

export interface ReposicaoHistorico {
  id: string;
  reposicao_id: string;
  usuario_nome: string;
  acao: string;
  detalhes: string;
  created_at: string;
}

async function fetchAll<T>(table: string, order: string, asc = false): Promise<T[]> {
  const all: unknown[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order(order, { ascending: asc })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if ((data?.length || 0) < PAGE) break;
    from += PAGE;
  }
  return all as T[];
}

export function useReposicao() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reposicoes"] });
    qc.invalidateQueries({ queryKey: ["reposicao_itens"] });
    qc.invalidateQueries({ queryKey: ["reposicao_conferencias"] });
    qc.invalidateQueries({ queryKey: ["reposicao_divergencias"] });
    qc.invalidateQueries({ queryKey: ["reposicao_historico"] });
    qc.invalidateQueries({ queryKey: ["perfumes"] });
    qc.invalidateQueries({ queryKey: ["estoque_unidades"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
  };

  const { data: reposicoes = [], isLoading } = useQuery({
    queryKey: ["reposicoes"],
    queryFn: () => fetchAll<Reposicao>("reposicoes", "created_at"),
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["reposicao_itens"],
    queryFn: () => fetchAll<ReposicaoItem>("reposicao_itens", "created_at", true),
  });

  const { data: conferencias = [] } = useQuery({
    queryKey: ["reposicao_conferencias"],
    queryFn: () => fetchAll<ReposicaoConferencia>("reposicao_conferencias", "created_at", true),
  });

  const { data: divergencias = [] } = useQuery({
    queryKey: ["reposicao_divergencias"],
    queryFn: () => fetchAll<ReposicaoDivergencia>("reposicao_divergencias", "created_at", true),
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["reposicao_historico"],
    queryFn: () => fetchAll<ReposicaoHistorico>("reposicao_historico", "created_at", true),
  });

  const log = async (reposicaoId: string, usuario: { id?: string | null; nome: string }, acao: string, detalhes = "") => {
    await supabase.from("reposicao_historico").insert({
      reposicao_id: reposicaoId,
      usuario_id: usuario.id ?? null,
      usuario_nome: usuario.nome,
      acao,
      detalhes,
    });
  };

  const criar = useMutation({
    mutationFn: async (p: {
      origem: string;
      destino: string;
      observacoes?: string;
      usuario: { id?: string | null; nome: string };
      itens: { produto_id: string; produto_nome: string; categoria: string; quantidade: number }[];
    }) => {
      if (p.origem === p.destino) throw new Error("Origem e destino não podem ser iguais.");
      const { data, error } = await supabase
        .from("reposicoes")
        .insert({
          origem: p.origem,
          destino: p.destino,
          observacoes: p.observacoes || "",
          criado_por: p.usuario.id ?? null,
          criado_por_nome: p.usuario.nome,
          status: "em_separacao",
        })
        .select("*")
        .single();
      if (error) throw error;
      const rep = data as unknown as Reposicao;
      if (p.itens.length) {
        const { error: itErr } = await supabase.from("reposicao_itens").insert(
          p.itens.map((i) => ({
            reposicao_id: rep.id,
            produto_id: i.produto_id,
            produto_nome: i.produto_nome,
            categoria: i.categoria,
            quantidade_solicitada: i.quantidade,
          }))
        );
        if (itErr) throw itErr;
      }
      await log(
        rep.id,
        p.usuario,
        "Reposição criada",
        `${p.origem} → ${p.destino} · ${p.itens.length} produto(s), ${p.itens.reduce((s, i) => s + i.quantidade, 0)} unidade(s)`
      );
      return rep;
    },
    onSuccess: invalidate,
  });

  const salvarSeparacao = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      separados: Record<string, number>;
      usuario: { id?: string | null; nome: string };
    }) => {
      for (const [itemId, qtd] of Object.entries(p.separados)) {
        const { error } = await supabase
          .from("reposicao_itens")
          .update({ quantidade_separada: qtd })
          .eq("id", itemId);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("reposicoes")
        .update({
          status: "pronta_envio",
          separado_por: p.usuario.id ?? null,
          separado_por_nome: p.usuario.nome,
          separado_em: new Date().toISOString(),
        })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(p.reposicao.id, p.usuario, "Separação concluída", `${Object.values(p.separados).reduce((s, q) => s + q, 0)} unidade(s) separada(s)`);
    },
    onSuccess: invalidate,
  });

  const confirmarEnvio = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      enviados: Record<string, number>;
      usuario: { id?: string | null; nome: string };
    }) => {
      for (const [itemId, qtd] of Object.entries(p.enviados)) {
        const { error } = await supabase.from("reposicao_itens").update({ quantidade_enviada: qtd }).eq("id", itemId);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("reposicoes")
        .update({
          status: "aguardando_conferencia",
          enviado_por: p.usuario.id ?? null,
          enviado_por_nome: p.usuario.nome,
          enviado_em: new Date().toISOString(),
        })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(p.reposicao.id, p.usuario, "Envio confirmado", `${Object.values(p.enviados).reduce((s, q) => s + q, 0)} unidade(s) enviada(s) para ${p.reposicao.destino}`);
    },
    onSuccess: invalidate,
  });

  const registrarConferencia = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      produto_id: string;
      produto_nome: string;
      quantidade: number;
      usuario: { id?: string | null; nome: string };
    }) => {
      const { error } = await supabase
        .from("reposicao_conferencias")
        .upsert(
          {
            reposicao_id: p.reposicao.id,
            produto_id: p.produto_id,
            produto_nome: p.produto_nome,
            quantidade: p.quantidade,
            usuario_id: p.usuario.id ?? null,
            usuario_nome: p.usuario.nome,
          },
          { onConflict: "reposicao_id,produto_id" }
        );
      if (error) throw error;
      if (p.reposicao.status !== "em_conferencia") {
        await supabase
          .from("reposicoes")
          .update({
            status: "em_conferencia",
            recebido_por: p.usuario.id ?? null,
            recebido_por_nome: p.usuario.nome,
            recebido_em: new Date().toISOString(),
          })
          .eq("id", p.reposicao.id);
        await log(p.reposicao.id, p.usuario, "Conferência iniciada");
      }
    },
    onSuccess: invalidate,
  });

  const removerConferencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reposicao_conferencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const finalizarConferencia = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      itensRep: ReposicaoItem[];
      lidos: ReposicaoConferencia[];
      usuario: { id?: string | null; nome: string };
    }) => {
      for (const item of p.itensRep) {
        const conf = p.lidos.find((c) => c.produto_id === item.produto_id);
        const { error } = await supabase
          .from("reposicao_itens")
          .update({ quantidade_recebida: conf?.quantidade ?? 0 })
          .eq("id", item.id);
        if (error) throw error;
      }
      const temDivergencia =
        p.itensRep.some((i) => {
          const esperado = i.quantidade_enviada ?? i.quantidade_solicitada;
          const recebido = p.lidos.find((c) => c.produto_id === i.produto_id)?.quantidade ?? 0;
          return esperado !== recebido;
        }) || p.lidos.some((c) => !p.itensRep.find((i) => i.produto_id === c.produto_id));

      const { error } = await supabase
        .from("reposicoes")
        .update({
          status: temDivergencia ? "com_divergencia" : "conferida",
          recebido_por: p.usuario.id ?? null,
          recebido_por_nome: p.usuario.nome,
          recebido_em: new Date().toISOString(),
        })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(
        p.reposicao.id,
        p.usuario,
        "Conferência finalizada",
        temDivergencia ? "Sistema identificou divergência" : "Sem divergências"
      );
      return temDivergencia;
    },
    onSuccess: invalidate,
  });

  /** Master: dispensa a conferência cega e considera tudo recebido conforme enviado. */
  const pularConferencia = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      itensRep: ReposicaoItem[];
      usuario: { id?: string | null; nome: string };
      motivo?: string;
    }) => {
      if (["finalizada", "cancelada"].includes(p.reposicao.status))
        throw new Error("Esta reposição não pode mais ser conferida.");
      for (const item of p.itensRep) {
        const qtd = item.quantidade_enviada ?? item.quantidade_separada ?? item.quantidade_solicitada;
        const { error } = await supabase
          .from("reposicao_itens")
          .update({ quantidade_recebida: qtd })
          .eq("id", item.id);
        if (error) throw error;
      }
      await supabase
        .from("reposicao_divergencias")
        .update({
          aprovado_por: p.usuario.id ?? null,
          aprovado_por_nome: p.usuario.nome,
          aprovado_em: new Date().toISOString(),
        })
        .eq("reposicao_id", p.reposicao.id)
        .is("aprovado_em", null);
      const { error } = await supabase

        .from("reposicoes")
        .update({
          status: "conferida",
          recebido_por: p.usuario.id ?? null,
          recebido_por_nome: p.usuario.nome,
          recebido_em: new Date().toISOString(),
        })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(
        p.reposicao.id,
        p.usuario,
        "Conferência dispensada pelo Master",
        p.motivo?.trim() || "Recebimento considerado conforme o enviado"
      );
    },
    onSuccess: invalidate,
  });

  const registrarDivergencia = useMutation({

    mutationFn: async (p: {
      reposicao_id: string;
      produto_id: string | null;
      produto_nome: string;
      tipo: string;
      quantidade_esperada: number;
      quantidade_recebida: number;
      justificativa: string;
      foto_url?: string | null;
      usuario: { id?: string | null; nome: string };
    }) => {
      const { error } = await supabase.from("reposicao_divergencias").insert({
        reposicao_id: p.reposicao_id,
        produto_id: p.produto_id,
        produto_nome: p.produto_nome,
        tipo: p.tipo,
        quantidade_esperada: p.quantidade_esperada,
        quantidade_recebida: p.quantidade_recebida,
        justificativa: p.justificativa,
        foto_url: p.foto_url || null,
        usuario_id: p.usuario.id ?? null,
        usuario_nome: p.usuario.nome,
      });
      if (error) throw error;
      await log(p.reposicao_id, p.usuario, "Divergência registrada", `${p.produto_nome} · ${p.tipo}`);
    },
    onSuccess: invalidate,
  });

  const aprovarDivergencia = useMutation({
    mutationFn: async (p: { divergencia: ReposicaoDivergencia; usuario: { id?: string | null; nome: string } }) => {
      const { error } = await supabase
        .from("reposicao_divergencias")
        .update({
          aprovado_por: p.usuario.id ?? null,
          aprovado_por_nome: p.usuario.nome,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", p.divergencia.id);
      if (error) throw error;
      await log(p.divergencia.reposicao_id, p.usuario, "Divergência aprovada", `${p.divergencia.produto_nome} · ${p.divergencia.tipo}`);
    },
    onSuccess: invalidate,
  });

  /** Finaliza: gera as movimentações de estoque (origem -, destino +) uma única vez. */
  const finalizar = useMutation({
    mutationFn: async (p: {
      reposicao: Reposicao;
      itensRep: ReposicaoItem[];
      estoques: Record<string, Record<string, number>>; // produto_id -> deposito -> qtd
      usuario: { id?: string | null; nome: string };
    }) => {
      if (p.reposicao.status === "finalizada") throw new Error("Reposição já finalizada.");
      const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());

      for (const item of p.itensRep) {
        const qtd = item.quantidade_recebida ?? item.quantidade_enviada ?? item.quantidade_solicitada;
        if (!qtd || qtd <= 0) continue;
        // Transferência transacional entre unidades (bloqueio e validação no banco)
        const { error } = await supabase.rpc("fn_transferir", {
          p_produto_id: item.produto_id,
          p_origem: p.reposicao.origem,
          p_destino: p.reposicao.destino,
          p_quantidade: qtd,
        });
        if (error) throw new Error(error.message);


        const { error: movErr } = await supabase.from("movimentacoes").insert({
          data: hoje,
          tipo: "Transferência",
          perfume_id: item.produto_id,
          perfume_nome: item.produto_nome,
          deposito_origem: p.reposicao.origem,
          deposito_destino: p.reposicao.destino,
          quantidade: qtd,
          observacao: `Reposição ${p.reposicao.codigo}`,
          registrado_por: p.usuario.nome,
        });
        if (movErr) throw movErr;
      }

      await supabase
        .from("reposicao_itens")
        .update({ status: "recebido" })
        .eq("reposicao_id", p.reposicao.id);

      const { error } = await supabase

        .from("reposicoes")
        .update({
          status: "finalizada",
          finalizado_por: p.usuario.id ?? null,
          finalizado_por_nome: p.usuario.nome,
          finalizado_em: new Date().toISOString(),
        })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(p.reposicao.id, p.usuario, "Movimentação de estoque realizada", `Reposição ${p.reposicao.codigo} finalizada`);
    },
    onSuccess: invalidate,
  });

  const cancelar = useMutation({
    mutationFn: async (p: { reposicao: Reposicao; motivo: string; usuario: { id?: string | null; nome: string } }) => {
      if (p.reposicao.status === "finalizada") throw new Error("Reposição finalizada não pode ser cancelada.");
      const { error } = await supabase
        .from("reposicoes")
        .update({ status: "cancelada", cancelado_motivo: p.motivo })
        .eq("id", p.reposicao.id);
      if (error) throw error;
      await log(p.reposicao.id, p.usuario, "Reposição cancelada", p.motivo);
    },
    onSuccess: invalidate,
  });

  const atualizarItem = useMutation({
    mutationFn: async (p: { id: string; quantidade_solicitada: number }) => {
      const { error } = await supabase
        .from("reposicao_itens")
        .update({ quantidade_solicitada: p.quantidade_solicitada })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removerItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reposicao_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    reposicoes,
    itens,
    conferencias,
    divergencias,
    historico,
    isLoading,
    criar: criar.mutateAsync,
    salvarSeparacao: salvarSeparacao.mutateAsync,
    confirmarEnvio: confirmarEnvio.mutateAsync,
    registrarConferencia: registrarConferencia.mutateAsync,
    removerConferencia: removerConferencia.mutateAsync,
    finalizarConferencia: finalizarConferencia.mutateAsync,
    pularConferencia: pularConferencia.mutateAsync,

    registrarDivergencia: registrarDivergencia.mutateAsync,
    aprovarDivergencia: aprovarDivergencia.mutateAsync,
    finalizar: finalizar.mutateAsync,
    cancelar: cancelar.mutateAsync,
    atualizarItem: atualizarItem.mutateAsync,
    removerItem: removerItem.mutateAsync,
  };
}

/** Upload de foto para o bucket reposicoes-fotos, devolve o caminho salvo. */
export async function uploadReposicaoFoto(file: File, reposicaoId: string, tipo: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${reposicaoId}/${tipo}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("reposicoes-fotos").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** URL assinada para visualizar a foto. */
export async function getReposicaoFotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("reposicoes-fotos").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
