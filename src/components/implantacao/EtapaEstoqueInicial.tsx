import { useMemo, useState } from "react";
import { Plus, Loader2, Search, Truck, PackagePlus, ShieldAlert, RefreshCw, SprayCan } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useUnidades, type Unidade } from "@/hooks/useUnidades";
import { useEstoqueUnidade } from "@/hooks/useTransferencias";
import ProdutoFoto from "@/components/ProdutoFoto";

type Tipo = "TRANSFERENCIA" | "FORNECEDOR" | "MANUAL" | "TESTER";

interface ItemCarga {
  id: string;
  produto_id: string;
  produto_nome: string;
  categoria: string;
  tipo: Tipo;
  origem_unidade_id: string | null;
  fornecedor: string;
  nota_numero: string;
  nota_data: string | null;
  lote: string;
  custo_unitario: number;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  status: string;
  motivo: string;
  observacao: string;
  solicitado_por_nome: string;
}

const CATEGORIAS = [
  "Todas",
  "Árabe",
  "Importado",
  "Nicho",
  "Nacional",
  "Kits",
  "Body Splash",
  "Body Spray",
  "Outros",
];

const rotuloStatus: Record<string, string> = {
  PLANEJADO: "Planejado",
  EM_TRANSFERENCIA: "Em transferência",
  DIVERGENCIA: "Divergência",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
};

interface Props {
  implantacaoId: string;
  unidadeId: string;
}

export default function EtapaEstoqueInicial({ implantacaoId, unidadeId }: Props) {
  const qc = useQueryClient();
  const { perfumes } = usePerfumes();
  const { unidades } = useUnidades({ contexto: "operacional" });
  const [tipo, setTipo] = useState<Tipo>("TRANSFERENCIA");
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [fornecedor, setFornecedor] = useState({ nome: "", nota: "", data: "", lote: "", custo: "" });
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [testerBaixarEstoque, setTesterBaixarEstoque] = useState(false);

  const origens = useMemo(
    () =>
      unidades.filter(
        (u: Unidade) =>
          u.id !== unidadeId &&
          u.permiteTransferencia &&
          u.status !== "EM_IMPLANTACAO" &&
          u.status !== "EM_CONFIGURACAO",
      ),
    [unidades, unidadeId],
  );

  const { data: estoqueOrigem } = useEstoqueUnidade(origem || undefined);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["implantacao-estoque", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_estoque_itens")
        .select("*")
        .eq("implantacao_id", implantacaoId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as ItemCarga[];
    },
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["implantacao-estoque", implantacaoId] });
    qc.invalidateQueries({ queryKey: ["estoque-unidades"] });
    qc.invalidateQueries({ queryKey: ["perfumes"] });
    qc.invalidateQueries({ queryKey: ["transferencias"] });
  };

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return perfumes
      .filter((p) => (categoria === "Todas" ? true : (p.classificacao || "Outros") === categoria))
      .filter((p) =>
        !termo
          ? false
          : [p.codigo, p.codigoBarras, p.marca, p.nome, p.concentracao, String(p.volume)]
              .join(" ")
              .toLowerCase()
              .includes(termo),
      )
      .slice(0, 25);
  }, [perfumes, busca, categoria]);

  const adicionar = async (produtoId: string) => {
    const produto = perfumes.find((p) => p.id === produtoId);
    if (!produto) return;
    const qtd = quantidades[produtoId] || 0;
    if (qtd <= 0) return toast.error("Informe a quantidade");

    if (tipo === "TRANSFERENCIA") {
      if (!origem) return toast.error("Escolha a unidade de origem");
      const disp = estoqueOrigem?.get(produtoId)?.disponivel ?? 0;
      if (qtd > disp)
        return toast.error(
          `Quantidade superior ao estoque disponível na unidade de origem. Disponível: ${disp} unidades.`,
        );
    }
    if (tipo === "MANUAL" && motivo.trim().length < 5)
      return toast.error("A carga manual exige um motivo detalhado");

    setOcupado(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", userRes.user?.id || "")
        .maybeSingle();

      const { error } = await supabase.from("implantacao_estoque_itens").insert({
        implantacao_id: implantacaoId,
        unidade_id: unidadeId,
        produto_id: produtoId,
        produto_nome: `${produto.codigo} - ${produto.marca} - ${produto.nome}`,
        categoria: produto.classificacao || "Outros",
        tipo,
        origem_unidade_id: tipo === "TRANSFERENCIA" ? origem : null,
        fornecedor: tipo === "FORNECEDOR" ? fornecedor.nome : "",
        nota_numero: tipo === "FORNECEDOR" ? fornecedor.nota : "",
        nota_data: tipo === "FORNECEDOR" && fornecedor.data ? fornecedor.data : null,
        lote: tipo === "FORNECEDOR" ? fornecedor.lote : "",
        custo_unitario:
          tipo === "FORNECEDOR" && fornecedor.custo
            ? Number(fornecedor.custo)
            : produto.custoMedio || produto.custo || 0,
        quantidade_solicitada: qtd,
        motivo: tipo === "MANUAL" ? motivo : "",
        status: tipo === "MANUAL" ? "AGUARDANDO_APROVACAO" : "PLANEJADO",
        solicitado_por: userRes.user?.id,
        solicitado_por_nome: perfil?.nome || "",
      } as never);
      if (error) throw error;

      setQuantidades({ ...quantidades, [produtoId]: 0 });
      recarregar();
      toast.success("Produto adicionado à carga inicial");
    } catch (e: unknown) {
      toast.error("Não foi possível adicionar", { description: (e as Error)?.message });
    } finally {
      setOcupado(false);
    }
  };

  const executar = async (fn: string, params: Record<string, unknown>, sucesso: string) => {
    setOcupado(true);
    try {
      const { error } = await supabase.rpc(fn as never, params as never);
      if (error) throw error;
      recarregar();
      toast.success(sucesso);
    } catch (e: unknown) {
      toast.error("Operação não concluída", { description: (e as Error)?.message });
    } finally {
      setOcupado(false);
    }
  };

  const resumo = useMemo(() => {
    const planejada = itens.reduce((s, i) => s + i.quantidade_solicitada, 0);
    const recebida = itens.reduce((s, i) => s + i.quantidade_recebida, 0);
    const custo = itens.reduce((s, i) => s + i.quantidade_solicitada * Number(i.custo_unitario), 0);
    const pendentes = itens.filter((i) =>
      ["PLANEJADO", "EM_TRANSFERENCIA", "AGUARDANDO_APROVACAO"].includes(i.status),
    ).length;
    const divergencias = itens.filter((i) => i.status === "DIVERGENCIA").length;
    return {
      skus: new Set(itens.map((i) => i.produto_id)).size,
      skusRecebidos: new Set(itens.filter((i) => i.quantidade_recebida > 0).map((i) => i.produto_id))
        .size,
      planejada,
      recebida,
      custo,
      pendentes,
      divergencias,
    };
  }, [itens]);

  const nomeUnidade = (id: string | null) =>
    unidades.find((u: Unidade) => u.id === id)?.nomeExibicao || "—";

  return (
    <div className="space-y-4">
      {/* Origem da carga */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["TRANSFERENCIA", "Transferência de outra unidade", Truck],
              ["FORNECEDOR", "Entrada de fornecedor", PackagePlus],
              ["MANUAL", "Carga manual autorizada", ShieldAlert],
            ] as [Tipo, string, typeof Truck][]
          ).map(([valor, rotulo, Icone]) => (
            <button
              key={valor}
              onClick={() => setTipo(valor)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                tipo === valor ? "border-primary text-primary" : "border-border text-foreground"
              }`}
            >
              <Icone className="w-4 h-4" /> {rotulo}
            </button>
          ))}
        </div>

        {tipo === "TRANSFERENCIA" && (
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground sm:max-w-xs"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
          >
            <option value="">Selecione a unidade de origem</option>
            {origens.map((u: Unidade) => (
              <option key={u.id} value={u.id}>
                {u.nomeExibicao}
              </option>
            ))}
          </select>
        )}

        {tipo === "FORNECEDOR" && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Fornecedor"
              value={fornecedor.nome}
              onChange={(e) => setFornecedor({ ...fornecedor, nome: e.target.value })}
            />
            <input
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Nº da nota"
              value={fornecedor.nota}
              onChange={(e) => setFornecedor({ ...fornecedor, nota: e.target.value })}
            />
            <input
              type="date"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={fornecedor.data}
              onChange={(e) => setFornecedor({ ...fornecedor, data: e.target.value })}
            />
            <input
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Lote"
              value={fornecedor.lote}
              onChange={(e) => setFornecedor({ ...fornecedor, lote: e.target.value })}
            />
            <input
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Custo unitário"
              value={fornecedor.custo}
              onChange={(e) => setFornecedor({ ...fornecedor, custo: e.target.value })}
            />
          </div>
        )}

        {tipo === "MANUAL" && (
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            placeholder="Motivo da carga manual (obrigatório) — a aprovação é feita por outra pessoa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        )}
      </div>

      {/* Busca de produtos */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`rounded-md border px-2 py-1 text-xs ${
                categoria === c ? "border-primary text-primary" : "border-border text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm text-foreground"
            placeholder="Buscar por nome, código, código de barras, marca ou volume"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {resultados.map((p) => {
          const disp = estoqueOrigem?.get(p.id)?.disponivel ?? 0;
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background p-2"
            >
              <ProdutoFoto url={p.imageUrl} nome={p.nome} />
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {p.codigo} - {p.marca} - {p.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.concentracao} · {p.volume}ml
                  {tipo === "TRANSFERENCIA" && origem ? ` · disponível na origem: ${disp}` : ""}
                </p>
              </div>
              <input
                type="number"
                className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={quantidades[p.id] ?? ""}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) =>
                  setQuantidades({ ...quantidades, [p.id]: Number(e.target.value) || 0 })
                }
                placeholder="Qtd"
              />
              <button
                onClick={() => adicionar(p.id)}
                disabled={ocupado}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          );
        })}
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { r: "SKUs planejados / recebidos", v: `${resumo.skus} / ${resumo.skusRecebidos}` },
          { r: "Quantidade planejada / recebida", v: `${resumo.planejada} / ${resumo.recebida}` },
          {
            r: "Custo estimado",
            v: resumo.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          },
          { r: "Pendências / divergências", v: `${resumo.pendentes} / ${resumo.divergencias}` },
        ].map((c) => (
          <div key={c.r} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{c.r}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            executar(
              "fn_implantacao_gerar_transferencias",
              { p_implantacao_id: implantacaoId },
              "Transferências geradas e estoque reservado na origem",
            )
          }
          disabled={ocupado}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Truck className="w-4 h-4" /> Gerar transferências
        </button>
        <button
          onClick={() =>
            executar(
              "fn_implantacao_estoque_sincronizar",
              { p_implantacao_id: implantacaoId },
              "Situação atualizada",
            )
          }
          disabled={ocupado}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar situação
        </button>
      </div>

      {/* Tabela da carga */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                "Produto",
                "Tipo",
                "Origem",
                "Solicitada",
                "Recebida",
                "Diferença",
                "Status",
                "Ação",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="inline w-4 h-4 animate-spin" /> Carregando…
                </td>
              </tr>
            ) : itens.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum produto na carga inicial.
                </td>
              </tr>
            ) : (
              itens.map((i) => (
                <tr key={i.id} className="border-t border-border text-foreground">
                  <td className="px-3 py-2">{i.produto_nome}</td>
                  <td className="px-3 py-2">
                    {i.tipo === "TRANSFERENCIA"
                      ? "Transferência"
                      : i.tipo === "FORNECEDOR"
                        ? "Fornecedor"
                        : "Manual"}
                  </td>
                  <td className="px-3 py-2">
                    {i.tipo === "TRANSFERENCIA"
                      ? nomeUnidade(i.origem_unidade_id)
                      : i.tipo === "FORNECEDOR"
                        ? i.fornecedor || "—"
                        : i.motivo || "—"}
                  </td>
                  <td className="px-3 py-2">{i.quantidade_solicitada}</td>
                  <td className="px-3 py-2">{i.quantidade_recebida}</td>
                  <td className="px-3 py-2">
                    {i.quantidade_recebida - i.quantidade_solicitada || "—"}
                  </td>
                  <td className="px-3 py-2">{rotuloStatus[i.status] || i.status}</td>
                  <td className="px-3 py-2">
                    {i.tipo === "FORNECEDOR" && i.status !== "CONCLUIDO" && (
                      <button
                        onClick={() =>
                          executar(
                            "fn_implantacao_entrada_fornecedor",
                            { p_item_id: i.id },
                            "Entrada registrada no estoque",
                          )
                        }
                        disabled={ocupado}
                        className="rounded-md border border-border px-2 py-1 text-xs text-primary"
                      >
                        Dar entrada
                      </button>
                    )}
                    {i.tipo === "MANUAL" && i.status !== "CONCLUIDO" && (
                      <button
                        onClick={() =>
                          executar(
                            "fn_implantacao_carga_manual_aprovar",
                            { p_item_id: i.id },
                            "Carga manual aprovada",
                          )
                        }
                        disabled={ocupado}
                        className="rounded-md border border-border px-2 py-1 text-xs text-primary"
                      >
                        Aprovar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
