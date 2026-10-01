import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Search, AlertTriangle, Plus, Pencil, X, Download, ChevronUp, ChevronDown, Barcode, Beaker, ListChecks, FileDown, Loader2, RefreshCw } from "lucide-react";
import { gerarListaProdutosPdf } from "@/lib/pdf/listaProdutos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, CLASSIFICACOES_PERFUME, type Deposito, type Perfume, type TipoPerfume, type ClassificacaoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import CadastroPerfume from "@/components/CadastroPerfume";
import EditarPerfume from "@/components/EditarPerfume";
import ParcelamentoModal from "@/components/ParcelamentoModal";
import HistoricoItem from "@/components/HistoricoItem";
import ProdutoEstoqueCard from "@/components/estoque/ProdutoEstoqueCard";
import { useCasas } from "@/hooks/useCasas";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useUnidades } from "@/hooks/useUnidades";
import { useQuery } from "@tanstack/react-query";
import { buscarEstoque, useEstoqueLista, useEstoqueResumo, type FiltrosEstoque, type ItemEstoque } from "@/hooks/useEstoqueLista";

const LIMITE_TODOS = 2000;

export default function Estoque({ isMaster = true }: { isMaster?: boolean }) {
  const { todosNomes: depositos, rotulo: rotuloUnidade } = useUnidades({ contexto: "historico" });
  const { tiposPerfumeConfig, concentracoesConfig, excluirPerfume } = useApp();
  const { casas } = useCasas();
  const { profile } = useAuth();
  const userLoja = (!isMaster && profile?.loja) ? profile.loja as Deposito : null;

  const tipos = useMemo(() =>
    Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key: key as TipoPerfume, label: String(label) })),
    [tiposPerfumeConfig]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [buscaDigitada, setBuscaDigitada] = useState(searchParams.get("q") || "");
  const [busca, setBusca] = useState(buscaDigitada);
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(buscaDigitada);
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        if (buscaDigitada) n.set("q", buscaDigitada); else n.delete("q");
        return n;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [buscaDigitada, setSearchParams]);
  const setFiltroUrl = useCallback((chave: string, valor: string) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (!valor || valor === "Todos") n.delete(chave); else n.set(chave, valor);
      return n;
    }, { replace: true });
  }, [setSearchParams]);
  const depositoFiltro = (searchParams.get("loja") || "Todos") as Deposito | "Todos";
  const tipoFiltro = (searchParams.get("tipo") || "Todos") as TipoPerfume | "Todos";
  const classificacaoFiltro = (searchParams.get("cls") || "Todos") as ClassificacaoPerfume | "Todos";
  const [showAlertas, setShowAlertas] = useState(false);
  const [custoMin, setCustoMin] = useState("");
  const [custoMax, setCustoMax] = useState("");
  const [vendaMin, setVendaMin] = useState("");
  const [vendaMax, setVendaMax] = useState("");
  const [estoqueMin, setEstoqueMin] = useState("");
  const [estoqueMax, setEstoqueMax] = useState("");
  const [ordenacaoEstoque, setOrdenacaoEstoque] = useState<"none" | "asc" | "desc">("none");
  const [showCadastro, setShowCadastro] = useState(false);
  const [editandoPerfume, setEditandoPerfume] = useState<Perfume | null>(null);
  const [imagemExpandida, setImagemExpandida] = useState<{ url: string; nome: string } | null>(null);
  const [filtrosColapsados, setFiltrosColapsados] = useState(false);
  const [showSemBarcode, setShowSemBarcode] = useState(false);
  const [showSemTester, setShowSemTester] = useState(false);
  const [parcelamentoPerfume, setParcelamentoPerfume] = useState<Perfume | null>(null);
  const [historicoPerfume, setHistoricoPerfume] = useState<Perfume | null>(null);
  const [selecaoAtiva, setSelecaoAtiva] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [carregandoTodos, setCarregandoTodos] = useState(false);
  const cacheSelecao = useRef(new Map<string, ItemEstoque>());

  // Force deposit filter for vendedores
  const effectiveDeposito = userLoja || depositoFiltro;

  // Valores numéricos com espera de 300 ms para não consultar a cada tecla
  const numeros = useMemo(() => ({ custoMin, custoMax, vendaMin, vendaMax, estoqueMin, estoqueMax }), [custoMin, custoMax, vendaMin, vendaMax, estoqueMin, estoqueMax]);
  const [numerosDeb, setNumerosDeb] = useState(numeros);
  useEffect(() => { const t = setTimeout(() => setNumerosDeb(numeros), 300); return () => clearTimeout(t); }, [numeros]);

  const filtros: FiltrosEstoque = useMemo(() => ({
    busca,
    unidade: effectiveDeposito === "Todos" ? undefined : effectiveDeposito,
    tipo: tipoFiltro,
    classificacao: classificacaoFiltro,
    ...(isMaster ? { custo_min: numerosDeb.custoMin, custo_max: numerosDeb.custoMax, venda_min: numerosDeb.vendaMin, venda_max: numerosDeb.vendaMax } : {}),
    estoque_min: numerosDeb.estoqueMin,
    estoque_max: numerosDeb.estoqueMax,
    alertas: showAlertas,
    ordem: ordenacaoEstoque,
  }), [busca, effectiveDeposito, tipoFiltro, classificacaoFiltro, isMaster, numerosDeb, showAlertas, ordenacaoEstoque]);

  const lista = useEstoqueLista(filtros, depositos);
  const resumoQ = useEstoqueResumo(filtros);
  const resumo = resumoQ.data || { total: 0, unidades: 0, custo: 0, venda: 0, por_unidade: {}, alertas: 0, sem_barcode: 0, sem_tester: 0 };
  const itens = useMemo(() => (lista.data?.pages || []).flatMap((pg) => pg.itens), [lista.data]);
  const total = lista.data?.pages[0]?.total ?? resumo.total;

  const semBarcodeQ = useQuery({
    queryKey: ["estoque_lista", "sem_barcode", depositos],
    enabled: showSemBarcode,
    queryFn: () => buscarEstoque({ especial: "sem_barcode" }, LIMITE_TODOS, 0, depositos),
  });
  const semTesterQ = useQuery({
    queryKey: ["estoque_lista", "sem_tester", depositos],
    enabled: showSemTester,
    queryFn: () => buscarEstoque({ especial: "sem_tester" }, LIMITE_TODOS, 0, depositos),
  });

  const buscarTodosFiltrados = useCallback(async () => {
    const r = await buscarEstoque(filtros, LIMITE_TODOS, 0, depositos);
    for (const it of r.itens) cacheSelecao.current.set(it.id, it);
    return r.itens;
  }, [filtros, depositos]);

  const toggleSelecionado = useCallback((id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selecionarTodosDoFiltro = async () => {
    setCarregandoTodos(true);
    try {
      const todos = await buscarTodosFiltrados();
      setSelecionados(new Set(todos.map((p) => p.id)));
    } catch {
      toast.error("Não foi possível carregar todos os produtos do filtro.");
    } finally {
      setCarregandoTodos(false);
    }
  };

  const gerarPdfLista = async () => {
    for (const it of itens) cacheSelecao.current.set(it.id, it);
    const lista = Array.from(selecionados).map((id) => cacheSelecao.current.get(id)).filter(Boolean) as ItemEstoque[];
    const ordenados = lista.sort((a, b) => a.nome.localeCompare(b.nome));
    if (ordenados.length === 0) {
      toast.error("Selecione pelo menos um produto.");
      return;
    }
    setGerandoPdf(true);
    try {
      const casaMap = new Map(casas.map((c) => [c.sigla, c.nome]));
      const doc = await gerarListaProdutosPdf({
        itens: ordenados,
        subtitulo: userLoja ? `Loja: ${userLoja}` : effectiveDeposito !== "Todos" ? `Loja: ${effectiveDeposito}` : undefined,
        depositos,
        tiposConfig: tiposPerfumeConfig as Record<string, string>,
        concentracoesConfig: concentracoesConfig as Record<string, string>,
        casasMap: casaMap,
      });
      doc.save(`lista_produtos_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success(`PDF gerado com ${ordenados.length} produto(s).`);
      setSelecaoAtiva(false);
      setSelecionados(new Set());
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerandoPdf(false);
    }
  };

  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy < -40) setFiltrosColapsados(true);
    else if (dy > 40) setFiltrosColapsados(false);
    touchStartY.current = null;
  };

  // Rolagem infinita: busca a próxima página de 30 ao chegar perto do fim
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = lista;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelaRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "600px" });
    observerRef.current.observe(el);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const excluirRef = useRef(excluirPerfume);
  excluirRef.current = excluirPerfume;
  const onImagem = useCallback((p: ItemEstoque) => setImagemExpandida({ url: p.imageUrl || "", nome: p.nome }), []);
  const onParcelamento = useCallback((p: ItemEstoque) => setParcelamentoPerfume(p), []);
  const onHistorico = useCallback((p: ItemEstoque) => setHistoricoPerfume(p), []);
  const onEditar = useCallback((p: ItemEstoque) => setEditandoPerfume(p), []);
  const onExcluir = useCallback(async (p: ItemEstoque) => {
    const ok = window.confirm(`Excluir o perfume "${p.nome}"?\n\nEsta ação é permanente e não pode ser desfeita.`);
    if (!ok) return;
    try {
      await excluirRef.current(p.id);
      toast.success("Perfume excluído com sucesso");
    } catch (e: any) {
      toast.error(
        e?.message?.includes("violates foreign key")
          ? "Não é possível excluir: existem registros vinculados (vendas, movimentações ou notas)."
          : "Erro ao excluir perfume"
      );
    }
  }, []);

  const exportarExcel = useCallback(async () => {
    let todos: ItemEstoque[];
    try {
      todos = await buscarTodosFiltrados();
    } catch {
      toast.error("Não foi possível exportar. Tente novamente.");
      return;
    }
    const casaMap = new Map(casas.map((c) => [c.sigla, c.nome]));
    const dados = todos.map((p) => ({
      SKU: p.codigo,
      "Código de Barras": p.codigoBarras || "",
      Nome: p.nome,
      Marca: p.marca,
      Casa: casaMap.get(p.casaSigla) || p.casaSigla,
      "Sigla Casa": p.casaSigla,
      Tipo: tiposPerfumeConfig?.[p.tipo] || p.tipo,
      Concentração: concentracoesConfig?.[p.concentracao] || p.concentracao,
      Tamanho: p.tamanho,
      Volume: p.volume,
      Classificação: p.classificacao || "",
      "Custo Atual": p.custo,
      "Custo Médio": p.custoMedio || 0,
      "Último Custo Em": p.ultimoCustoEm || "",
      "Preço Venda": p.precoVenda,
      "Estoque Total": Object.values(p.estoques).reduce((a, b) => a + b, 0),
      ...Object.fromEntries(depositos.map((d) => [`Estoque ${d}`, (p.estoques as Record<string, number>)[d] ?? 0])),
      "Estoque Mínimo": p.estoqueMinimo,
      NCM: p.ncm || "",
      CFOP: p.cfop || "",
      "CST/CSOSN": p.cstCsosn || "",
      "Unidade Fiscal": p.unidadeFiscal || "UN",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, `produtos_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [buscarTodosFiltrados, casas, tiposPerfumeConfig, concentracoesConfig, depositos]);

  const renderListaSimples = (q: typeof semBarcodeQ, vazio: string, Icone: typeof Barcode, fechar: () => void, hover: string) => {
    if (q.isLoading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    if (q.isError) return <p className="text-sm text-destructive text-center py-8">Não foi possível carregar. Feche e abra de novo.</p>;
    const lst = q.data?.itens || [];
    if (lst.length === 0) return (
      <div className="text-center py-12">
        <Icone size={36} className="text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </div>
    );
    return lst.map((p) => {
      const qtdTotal = Object.values(p.estoques).reduce((a, b) => a + b, 0);
      return (
        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-overlay/40 ${hover} transition-colors`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gold font-mono bg-primary/10 px-2 py-0.5 rounded-md">{p.codigo}</span>
              <span className="text-[10px] text-muted-foreground">{qtdTotal} un.</span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
            <p className="text-xs text-muted-foreground truncate">
              {p.marca} · {(tiposPerfumeConfig[p.tipo] || p.tipo)} · {(concentracoesConfig[p.concentracao] || p.concentracao)} · {p.tamanho}
            </p>
          </div>
          <button onClick={() => { setEditandoPerfume(p); fechar(); }} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 flex-shrink-0">
            <Pencil size={11} /> Editar
          </button>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {showCadastro && <CadastroPerfume onClose={() => setShowCadastro(false)} />}
      {editandoPerfume && <EditarPerfume perfume={editandoPerfume} onClose={() => setEditandoPerfume(null)} />}

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "var(--gradient-header)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Estoque</h1>
            <p className="page-subtitle mt-1">
              {total} produtos{userLoja ? ` · ${userLoja}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlertas(!showAlertas)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                showAlertas
                  ? "bg-destructive/15 border border-destructive/40 text-destructive"
                  : resumo.alertas > 0
                  ? "bg-destructive/8 border border-destructive/25 text-destructive"
                  : "btn-secondary"
              }`}
            >
              <AlertTriangle size={13} />
              {resumo.alertas}
            </button>
            {isMaster && (
              <button
                onClick={() => setShowSemBarcode(true)}
                title="Produtos sem código de barras"
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                  resumo.sem_barcode > 0
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/15"
                    : "btn-secondary"
                }`}
              >
                <Barcode size={13} className={resumo.sem_barcode > 0 ? "animate-pulse" : ""} />
                {resumo.sem_barcode}
              </button>
            )}
            {isMaster && (
              <button
                onClick={() => setShowSemTester(true)}
                title="Produtos sem tester"
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                  resumo.sem_tester > 0
                    ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/15"
                    : "btn-secondary"
                }`}
              >
                <Beaker size={13} className={resumo.sem_tester > 0 ? "animate-pulse" : ""} />
                {resumo.sem_tester}
              </button>
            )}
            {isMaster && (
              <button onClick={exportarExcel} className="btn-secondary px-3 py-2">
                <Download size={14} />
              </button>
            )}
            <button
              onClick={() => {
                setSelecaoAtiva((v) => !v);
                setSelecionados(new Set());
              }}
              title="Criar lista de produtos para PDF"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                selecaoAtiva
                  ? "bg-gold/15 border border-gold/50 text-gold"
                  : "btn-secondary"
              }`}
            >
              <ListChecks size={14} />
              <span className="hidden sm:inline">Lista PDF</span>
            </button>
            {isMaster && (
              <button onClick={() => setShowCadastro(true)} className="btn-primary px-4 py-2">
                <Plus size={14} /> Novo
              </button>
            )}
          </div>
        </div>

        {/* Search - sempre visível */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nome, código ou marca..."
            value={buscaDigitada}
            onChange={(e) => setBuscaDigitada(e.target.value)}
            className="input-premium pl-10 pr-4 py-2.5"
          />
        </div>

        {/* Filtros recolhíveis */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            filtrosColapsados ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100"
          }`}
        >
          {/* Deposit filter - hidden for vendedores with assigned loja */}
          {!userLoja && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2">
              {(["Todos", ...depositos] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFiltroUrl("loja", d)}
                  className={`pill ${depositoFiltro === d ? "pill-active" : "pill-inactive"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* Type filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2">
            {([{ key: "Todos" as const, label: "Todos os tipos" }, ...tipos]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltroUrl("tipo", key)}
                className={`pill text-[11px] ${tipoFiltro === key ? "pill-active" : "pill-inactive"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Classificação filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2">
            {(["Todos", ...CLASSIFICACOES_PERFUME] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFiltroUrl("cls", c)}
                className={`pill text-[11px] ${classificacaoFiltro === c ? "pill-active" : "pill-inactive"}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Price filters - master only */}
          {isMaster && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-1.5 items-center">
                <input type="number" placeholder="Custo mín" value={custoMin} onChange={(e) => setCustoMin(e.target.value)}
                  className="input-premium px-2.5 py-2 text-[11px] w-full" />
                <span className="text-[10px] text-muted-foreground">-</span>
                <input type="number" placeholder="Custo máx" value={custoMax} onChange={(e) => setCustoMax(e.target.value)}
                  className="input-premium px-2.5 py-2 text-[11px] w-full" />
              </div>
              <div className="flex gap-1.5 items-center">
                <input type="number" placeholder="Venda mín" value={vendaMin} onChange={(e) => setVendaMin(e.target.value)}
                  className="input-premium px-2.5 py-2 text-[11px] w-full" />
                <span className="text-[10px] text-muted-foreground">-</span>
                <input type="number" placeholder="Venda máx" value={vendaMax} onChange={(e) => setVendaMax(e.target.value)}
                  className="input-premium px-2.5 py-2 text-[11px] w-full" />
              </div>
            </div>
          )}

          {/* Stock filters */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex gap-1.5 items-center">
              <input type="number" placeholder="Estoque mín" value={estoqueMin} onChange={(e) => setEstoqueMin(e.target.value)}
                className="input-premium px-2.5 py-2 text-[11px] w-full" />
              <span className="text-[10px] text-muted-foreground">-</span>
              <input type="number" placeholder="Estoque máx" value={estoqueMax} onChange={(e) => setEstoqueMax(e.target.value)}
                className="input-premium px-2.5 py-2 text-[11px] w-full" />
            </div>
            <div className="flex gap-1.5 items-center">
              <select value={ordenacaoEstoque} onChange={(e) => setOrdenacaoEstoque(e.target.value as "none" | "asc" | "desc")}
                className="input-premium px-2.5 py-2 text-[11px] w-full">
                <option value="none">Ordenar estoque</option>
                <option value="asc">Menor → Maior</option>
                <option value="desc">Maior → Menor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Handle - clique ou arraste para recolher/expandir */}
        <button
          type="button"
          onClick={() => setFiltrosColapsados((v) => !v)}
          className="w-full flex flex-col items-center justify-center pt-2 pb-1 group"
          aria-label={filtrosColapsados ? "Mostrar filtros" : "Recolher filtros"}
        >
          <div className="w-10 h-1 rounded-full bg-border group-hover:bg-gold/50 transition-colors mb-1" />
          {filtrosColapsados ? (
            <ChevronDown size={12} className="text-muted-foreground" />
          ) : (
            <ChevronUp size={12} className="text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Quantity cards - hidden for vendedores */}
      {userLoja ? null : (
        <div className="px-4 mb-3 grid grid-cols-4 gap-2">
          {[
            { label: "Total", value: resumo.unidades },
            ...depositos
              .filter((d) => !rotuloUnidade(d).includes("Unidade Inativa"))
              .map((d) => ({ label: rotuloUnidade(d), value: resumo.por_unidade[d] || 0 })),
          ].map(({ label, value }) => (
            <div key={label} className="kpi-card p-3 text-center">
              <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
              {resumoQ.isLoading ? <div className="h-5 w-10 mx-auto rounded bg-muted animate-pulse" /> : <p className="text-sm font-bold text-foreground">{value}</p>}
              <p className="text-[8px] text-muted-foreground">un.</p>
            </div>
          ))}
        </div>
      )}

      {/* Value cards - master only */}
      {isMaster && (
        <div className="px-4 mb-5 grid grid-cols-3 gap-2">
          {[
            { label: "Custo", value: resumo.custo, cls: "text-muted-foreground" },
            { label: "Venda", value: resumo.venda, cls: "text-gold" },
            { label: "Lucro pot.", value: resumo.venda - resumo.custo, cls: "text-success" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="kpi-card p-3">
              <p className="text-[10px] text-muted-foreground mb-1.5">{label}</p>
              {resumoQ.isLoading ? <div className="h-4 w-20 rounded bg-muted animate-pulse" /> : <p className={`text-xs font-semibold ${cls}`}>{formatCurrency(value)}</p>}
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div className={`px-4 space-y-3 ${lista.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
        {(lista.isLoading || lista.isPending) && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-premium p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
          </div>
        ))}

        {lista.isError && !lista.data && (
          <div className="text-center py-16">
            <AlertTriangle size={36} className="text-destructive mx-auto mb-3 opacity-70" />
            <p className="text-sm text-muted-foreground mb-4">Não foi possível carregar o estoque.</p>
            <button onClick={() => lista.refetch()} className="btn-secondary px-4 py-2 text-xs inline-flex items-center gap-1.5">
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        )}

        {itens.map((p) => (
          <ProdutoEstoqueCard
            key={p.id}
            p={p}
            isMaster={isMaster}
            userLoja={userLoja}
            todasLojas={effectiveDeposito === "Todos"}
            depositos={depositos}
            concentracaoLabel={String(concentracoesConfig[p.concentracao] || p.concentracao)}
            selecaoAtiva={selecaoAtiva}
            marcado={selecionados.has(p.id)}
            onToggle={toggleSelecionado}
            onImagem={onImagem}
            onParcelamento={onParcelamento}
            onHistorico={onHistorico}
            onEditar={onEditar}
            onExcluir={onExcluir}
          />
        ))}

        {hasNextPage && (
          <div ref={sentinelaRef} className="flex flex-col items-center gap-2 py-6">
            <p className="text-[11px] text-muted-foreground">
              Mostrando {itens.length} de {total} produtos
            </p>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs px-4 py-2 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {isFetchingNextPage && <Loader2 size={12} className="animate-spin" />}
              Carregar mais
            </button>
          </div>
        )}

        {!lista.isPending && !lista.isError && itens.length === 0 && (
          <div className="text-center py-20">
            <Package size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {effectiveDeposito !== "Todos" || userLoja
                ? "Nenhum produto possui movimentação registrada neste estoque."
                : "Nenhum produto encontrado"}
            </p>
          </div>
        )}
      </div>

      {/* Modal: Produtos sem código de barras */}
      <Dialog open={showSemBarcode} onOpenChange={setShowSemBarcode}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode size={18} className="text-amber-400" />
              Produtos sem código de barras
              <span className="text-xs text-muted-foreground font-normal">({resumo.sem_barcode})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6 space-y-2">
            {renderListaSimples(semBarcodeQ, "Todos os produtos possuem código de barras cadastrado", Barcode, () => setShowSemBarcode(false), "hover:border-gold-muted")}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Produtos sem tester */}
      <Dialog open={showSemTester} onOpenChange={setShowSemTester}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker size={18} className="text-purple-400" />
              Produtos sem tester
              <span className="text-xs text-muted-foreground font-normal">({resumo.sem_tester})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6 space-y-2">
            {renderListaSimples(semTesterQ, "Todos os produtos possuem tester cadastrado", Beaker, () => setShowSemTester(false), "hover:border-purple-500/30")}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image expanded modal */}
      {imagemExpandida && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setImagemExpandida(null)}
        >
          <div className="relative max-w-[90vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImagemExpandida(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground z-10"
            >
              <X size={16} />
            </button>
            <img
              src={imagemExpandida.url}
              alt={imagemExpandida.nome}
              className="max-w-[90vw] max-h-[80vh] rounded-2xl border border-border object-contain shadow-elevated"
            />
            <p className="text-center text-sm text-muted-foreground mt-3 font-display">{imagemExpandida.nome}</p>
          </div>
        </div>
      )}

      {/* Barra de ação da lista para PDF */}
      {selecaoAtiva && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md">
          <div className="card-premium p-3 shadow-elevated border-gold/40 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {total} produto(s) no filtro atual
              </p>
            </div>
            <button
              onClick={selecionarTodosDoFiltro}
              disabled={carregandoTodos}
              className="btn-secondary px-2.5 py-2 text-[11px] inline-flex items-center gap-1 disabled:opacity-60"
            >
              {carregandoTodos && <Loader2 size={11} className="animate-spin" />}
              Todos do filtro
            </button>
            <button
              onClick={gerarPdfLista}
              disabled={gerandoPdf || selecionados.size === 0}
              className="btn-primary px-3 py-2 text-[11px] flex items-center gap-1.5 disabled:opacity-50"
            >
              {gerandoPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              PDF
            </button>
          </div>
        </div>
      )}

      <ParcelamentoModal
        open={!!parcelamentoPerfume}
        onOpenChange={(o) => { if (!o) setParcelamentoPerfume(null); }}
        valor={parcelamentoPerfume?.precoVenda || 0}
        titulo={parcelamentoPerfume ? `${parcelamentoPerfume.marca} ${parcelamentoPerfume.nome}` : undefined}
      />

      <HistoricoItem
        perfume={historicoPerfume}
        open={!!historicoPerfume}
        onOpenChange={(o) => { if (!o) setHistoricoPerfume(null); }}
      />
    </div>
  );
}
