import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useReposicao } from "@/hooks/useReposicao";

function horas(inicio?: string | null, fim?: string | null) {
  if (!inicio || !fim) return null;
  return (new Date(fim).getTime() - new Date(inicio).getTime()) / 3600000;
}

function media(valores: number[]) {
  if (!valores.length) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export default function DashboardReposicao() {
  const { reposicoes, itens, divergencias } = useReposicao();

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());

  const dados = useMemo(() => {
    const doDia = reposicoes.filter((r) => r.created_at.slice(0, 10) === hoje);
    const finalizadasHoje = reposicoes.filter((r) => r.status === "finalizada" && (r.finalizado_em || "").slice(0, 10) === hoje);
    const enviados = itens.reduce((s, i) => s + (i.quantidade_enviada ?? 0), 0);
    const temposConferencia = reposicoes
      .map((r) => horas(r.enviado_em, r.recebido_em))
      .filter((v): v is number => v != null && v >= 0);
    const temposFinalizacao = reposicoes
      .map((r) => horas(r.recebido_em, r.finalizado_em))
      .filter((v): v is number => v != null && v >= 0);

    const porUnidade: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    const porProduto: Record<string, number> = {};
    for (const r of reposicoes) porUnidade[r.destino] = (porUnidade[r.destino] || 0) + 1;
    for (const i of itens) {
      const qtd = i.quantidade_enviada ?? i.quantidade_solicitada;
      porCategoria[i.categoria] = (porCategoria[i.categoria] || 0) + qtd;
      porProduto[i.produto_nome] = (porProduto[i.produto_nome] || 0) + qtd;
    }

    return {
      hoje: doDia.length,
      emTransito: reposicoes.filter((r) => ["pronta_envio", "em_transito"].includes(r.status)).length,
      aguardando: reposicoes.filter((r) => ["aguardando_conferencia", "em_conferencia"].includes(r.status)).length,
      comDivergencia: reposicoes.filter((r) => r.status === "com_divergencia").length,
      finalizadasHoje: finalizadasHoje.length,
      enviados,
      itensDivergentes: divergencias.length,
      percentualDivergencia: itens.length ? (divergencias.length / itens.length) * 100 : 0,
      mediaConferencia: media(temposConferencia),
      mediaFinalizacao: media(temposFinalizacao),
      porUnidade: Object.entries(porUnidade).map(([nome, valor]) => ({ nome, valor })),
      porCategoria: Object.entries(porCategoria).map(([nome, valor]) => ({ nome, valor })),
      topProdutos: Object.entries(porProduto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([nome, valor]) => ({ nome: nome.length > 28 ? `${nome.slice(0, 28)}…` : nome, valor })),
    };
  }, [reposicoes, itens, divergencias, hoje]);

  const cards = [
    ["Reposições hoje", dados.hoje],
    ["Em trânsito", dados.emTransito],
    ["Aguardando conferência", dados.aguardando],
    ["Com divergência", dados.comDivergencia],
    ["Finalizadas hoje", dados.finalizadasHoje],
    ["Unidades enviadas", dados.enviados],
    ["Itens com divergência", dados.itensDivergentes],
    ["% de divergência", `${dados.percentualDivergencia.toFixed(1)}%`],
    ["Tempo médio até conferência", dados.mediaConferencia == null ? "—" : `${dados.mediaConferencia.toFixed(1)} h`],
    ["Tempo médio até finalizar", dados.mediaFinalizacao == null ? "—" : `${dados.mediaFinalizacao.toFixed(1)} h`],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {cards.map(([label, valor]) => (
          <div key={label} className="card-premium p-3.5">
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-xl font-semibold text-foreground mt-1">{valor}</p>
          </div>
        ))}
      </div>

      {[
        { titulo: "Reposições por unidade de destino", data: dados.porUnidade },
        { titulo: "Unidades repostas por categoria", data: dados.porCategoria },
        { titulo: "Produtos mais repostos", data: dados.topProdutos },
      ].map((g) => (
        <div key={g.titulo} className="card-premium p-4">
          <p className="text-xs font-semibold text-foreground mb-3">{g.titulo}</p>
          {g.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={g.data} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--gold))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
