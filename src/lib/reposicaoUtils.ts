import type { Perfume } from "@/data/mockData";
import type { Reposicao, ReposicaoItem } from "@/hooks/useReposicao";

export const CATEGORIA_LABEL_PADRAO: Record<string, string> = {
  AR: "ÁRABES",
  NI: "NICHO",
  NA: "IMPORTADOS",
  KI: "KITS",
};

export function categoriaLabel(tipo: string, config?: Record<string, string>) {
  const custom = config?.[tipo];
  if (custom) return custom.toUpperCase();
  return CATEGORIA_LABEL_PADRAO[tipo] || "OUTROS";
}

export function produtoLabel(p: Perfume, concentracoes?: Record<string, string>) {
  const conc = concentracoes?.[p.concentracao] || p.concentracao;
  return `${p.codigo} - ${p.marca} - ${p.nome} - ${conc} - ${p.volume}ml`;
}

/** Agrupa itens por categoria, mantendo ordem alfabética dentro do grupo. */
export function agruparPorCategoria<T extends { categoria: string; produto_nome: string }>(itens: T[]) {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const key = item.categoria || "OUTROS";
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(item);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoria, lista]) => ({
      categoria,
      itens: [...lista].sort((a, b) => a.produto_nome.localeCompare(b.produto_nome)),
    }));
}

/** Estoque comprometido por produto/depósito em reposições ainda não finalizadas. */
export function calcularReservas(reposicoes: Reposicao[], itens: ReposicaoItem[]) {
  const emAberto = new Set(
    reposicoes
      .filter((r) => ["pronta_envio", "em_transito", "aguardando_conferencia", "em_conferencia"].includes(r.status))
      .map((r) => r.id)
  );
  const origemPorRep = new Map(reposicoes.map((r) => [r.id, r.origem]));
  const reservas: Record<string, Record<string, number>> = {};
  for (const item of itens) {
    if (!emAberto.has(item.reposicao_id)) continue;
    const origem = origemPorRep.get(item.reposicao_id);
    if (!origem) continue;
    const qtd = item.quantidade_enviada ?? item.quantidade_separada ?? item.quantidade_solicitada;
    reservas[item.produto_id] = reservas[item.produto_id] || {};
    reservas[item.produto_id][origem] = (reservas[item.produto_id][origem] || 0) + qtd;
  }
  return reservas;
}

export function formatarDataHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Manaus" });
}

export function formatarData(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" });
}

/** Texto pronto para colar no WhatsApp. */
export function textoWhatsApp(
  rep: Reposicao,
  itens: ReposicaoItem[],
  responsavel: string
) {
  const grupos = agruparPorCategoria(itens);
  const total = itens.reduce((s, i) => s + (i.quantidade_enviada ?? i.quantidade_solicitada), 0);
  const linhas: string[] = [
    "📦 REPOSIÇÃO LE JESS",
    "",
    `Reposição: ${rep.codigo}`,
    "",
    "Origem:",
    rep.origem,
    "",
    "Destino:",
    rep.destino,
    "",
  ];
  for (const g of grupos) {
    linhas.push(g.categoria);
    linhas.push("");
    for (const item of g.itens) {
      linhas.push(`• ${item.produto_nome} — ${item.quantidade_enviada ?? item.quantidade_solicitada} un.`);
    }
    linhas.push("");
  }
  linhas.push("TOTAL:", `${total} unidades`, "", "Responsável:", responsavel, "", "Data:", formatarData(rep.created_at));
  return linhas.join("\n");
}
