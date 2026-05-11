import { useState, useMemo, useCallback, useRef } from "react";
import { Package, Search, AlertTriangle, Plus, Pencil, FlaskConical, Image, X, Download, Trash2, ChevronUp, ChevronDown, Barcode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, CLASSIFICACOES_PERFUME, type Deposito, type Perfume, type TipoPerfume, type ClassificacaoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import CadastroPerfume from "@/components/CadastroPerfume";
import EditarPerfume from "@/components/EditarPerfume";
import QuickActionMenu from "@/components/QuickActionMenu";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function Estoque({ isMaster = true }: { isMaster?: boolean }) {
  const { perfumes, testers, tiposPerfumeConfig, concentracoesConfig, excluirPerfume } = useApp();
  const { profile } = useAuth();
  const userLoja = (!isMaster && profile?.loja) ? profile.loja as Deposito : null;

  const tipos = useMemo(() =>
    Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key: key as TipoPerfume, label: String(label) })),
    [tiposPerfumeConfig]
  );
  const [busca, setBusca] = useState("");
  const [depositoFiltro, setDepositoFiltro] = useState<Deposito | "Todos">(userLoja || "Todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoPerfume | "Todos">("Todos");
  const [classificacaoFiltro, setClassificacaoFiltro] = useState<ClassificacaoPerfume | "Todos">("Todos");
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
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy < -40) setFiltrosColapsados(true);
    else if (dy > 40) setFiltrosColapsados(false);
    touchStartY.current = null;
  };

  // Force deposit filter for vendedores
  const effectiveDeposito = userLoja || depositoFiltro;

  const testerMap = useMemo(() => {
    const map = new Map<string, number>();
    testers.forEach((t) => {
      const key = `${t.perfumeId}-${t.deposito}`;
      map.set(key, (map.get(key) || 0) + t.quantidade);
    });
    testers.forEach((t) => {
      const key = `${t.perfumeId}-total`;
      map.set(key, (map.get(key) || 0) + t.quantidade);
    });
    return map;
  }, [testers]);

  const getTesterQtd = (perfumeId: string, deposito?: Deposito) => {
    if (deposito) return testerMap.get(`${perfumeId}-${deposito}`) || 0;
    return testerMap.get(`${perfumeId}-total`) || 0;
  };

  const getQtdForFilter = useCallback((p: Perfume) => {
    if (userLoja) return p.estoques[userLoja];
    return effectiveDeposito === "Todos"
      ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
      : p.estoques[effectiveDeposito as Deposito];
  }, [userLoja, effectiveDeposito]);

  const filtrados = useMemo(() => {
    const result = perfumes.filter((p) => {
      const term = busca.toLowerCase();
      const matchBusca =
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.concentracao.toLowerCase().includes(term) ||
        (concentracoesConfig[p.concentracao] || "").toString().toLowerCase().includes(term) ||
        p.tamanho.toLowerCase().includes(term) ||
        String(p.volume).includes(term);

      const matchTipo = tipoFiltro === "Todos" || p.tipo === tipoFiltro;
      const matchClassificacao = classificacaoFiltro === "Todos" || (p.classificacao || "Compartilhável") === classificacaoFiltro;
      const matchCustoMin = custoMin === "" || p.custo >= Number(custoMin);
      const matchCustoMax = custoMax === "" || p.custo <= Number(custoMax);
      const matchVendaMin = vendaMin === "" || p.precoVenda >= Number(vendaMin);
      const matchVendaMax = vendaMax === "" || p.precoVenda <= Number(vendaMax);
      const matchPreco = isMaster ? (matchCustoMin && matchCustoMax && matchVendaMin && matchVendaMax) : true;

      const qtd = getQtdForFilter(p);
      const matchEstoqueMin = estoqueMin === "" || qtd >= Number(estoqueMin);
      const matchEstoqueMax = estoqueMax === "" || qtd <= Number(estoqueMax);
      const matchEstoque = matchEstoqueMin && matchEstoqueMax;

      if (userLoja) {
        if (showAlertas) return matchBusca && matchTipo && matchClassificacao && matchPreco && matchEstoque && qtd <= p.estoqueMinimo;
        return matchBusca && matchTipo && matchClassificacao && matchPreco && matchEstoque;
      }

      if (showAlertas) return matchBusca && matchTipo && matchClassificacao && matchPreco && matchEstoque && qtd <= p.estoqueMinimo;
      return matchBusca && matchTipo && matchClassificacao && matchPreco && matchEstoque;
    });

    if (ordenacaoEstoque === "asc") {
      result.sort((a, b) => getQtdForFilter(a) - getQtdForFilter(b));
    } else if (ordenacaoEstoque === "desc") {
      result.sort((a, b) => getQtdForFilter(b) - getQtdForFilter(a));
    }

    return result;
  }, [perfumes, busca, effectiveDeposito, tipoFiltro, classificacaoFiltro, showAlertas, custoMin, custoMax, vendaMin, vendaMax, estoqueMin, estoqueMax, ordenacaoEstoque, userLoja, isMaster, getQtdForFilter, concentracoesConfig]);

  const totais = useMemo(() => {
    return filtrados.reduce(
      (acc, p) => {
        if (userLoja) {
          const qtd = p.estoques[userLoja];
          acc.venda += qtd * p.precoVenda;
          acc.unidades += qtd;
          return acc;
        }
        const qtdGeral = Object.values(p.estoques).reduce((a, b) => a + b, 0);
        const qtd = effectiveDeposito === "Todos" ? qtdGeral : p.estoques[effectiveDeposito as Deposito];
        acc.custo += qtd * p.custo;
        acc.venda += qtd * p.precoVenda;
        acc.unidades += qtd;
        acc.casa += p.estoques.Casa;
        acc.sumauma += p.estoques["Sumaúma"];
        acc.amazonas += p.estoques.Amazonas;
        return acc;
      },
      { custo: 0, venda: 0, unidades: 0, casa: 0, sumauma: 0, amazonas: 0 }
    );
  }, [filtrados, effectiveDeposito, userLoja]);

  const alertas = perfumes.filter((p) => {
    if (userLoja) return p.estoques[userLoja] <= p.estoqueMinimo;
    const qtd = effectiveDeposito === "Todos"
      ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
      : p.estoques[effectiveDeposito as Deposito];
    return qtd <= p.estoqueMinimo;
  }).length;

  const getQtd = (p: Perfume) => {
    if (userLoja) return p.estoques[userLoja];
    return effectiveDeposito === "Todos"
      ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
      : p.estoques[effectiveDeposito as Deposito];
  };

  const isBaixo = (p: Perfume) => getQtd(p) <= p.estoqueMinimo;

  const exportarExcel = useCallback(() => {
    const dados = filtrados.map((p) => ({
      SKU: p.codigo,
      "Código de Barras": p.codigoBarras || "",
      Nome: p.nome,
      Marca: p.marca,
      Casa: p.casaSigla,
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
      "Estoque Casa": p.estoques.Casa,
      "Estoque Sumaúma": p.estoques["Sumaúma"],
      "Estoque Amazonas": p.estoques.Amazonas,
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
  }, [filtrados]);

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
              {filtrados.length} produtos{userLoja ? ` · ${userLoja}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlertas(!showAlertas)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                showAlertas
                  ? "bg-destructive/15 border border-destructive/40 text-destructive"
                  : alertas > 0
                  ? "bg-destructive/8 border border-destructive/25 text-destructive"
                  : "btn-secondary"
              }`}
            >
              <AlertTriangle size={13} />
              {alertas}
            </button>
            {isMaster && (
              <button onClick={exportarExcel} className="btn-secondary px-3 py-2">
                <Download size={14} />
              </button>
            )}
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
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
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
                  onClick={() => setDepositoFiltro(d)}
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
                onClick={() => setTipoFiltro(key)}
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
                onClick={() => setClassificacaoFiltro(c as any)}
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
            { label: "Total", value: totais.unidades },
            { label: "Casa", value: totais.casa },
            { label: "Sumaúma", value: totais.sumauma },
            { label: "Amazonas", value: totais.amazonas },
          ].map(({ label, value }) => (
            <div key={label} className="kpi-card p-3 text-center">
              <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-bold text-foreground">{value}</p>
              <p className="text-[8px] text-muted-foreground">un.</p>
            </div>
          ))}
        </div>
      )}

      {/* Value cards - master only */}
      {isMaster && (
        <div className="px-4 mb-5 grid grid-cols-3 gap-2">
          {[
            { label: "Custo", value: totais.custo, cls: "text-muted-foreground" },
            { label: "Venda", value: totais.venda, cls: "text-gold" },
            { label: "Lucro pot.", value: totais.venda - totais.custo, cls: "text-success" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="kpi-card p-3">
              <p className="text-[10px] text-muted-foreground mb-1.5">{label}</p>
              <p className={`text-xs font-semibold ${cls}`}>{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-3">
        {filtrados.map((p) => {
          const qtd = getQtd(p);
          const baixo = isBaixo(p);
          const testerTotal = userLoja
            ? getTesterQtd(p.id, userLoja)
            : effectiveDeposito === "Todos"
            ? getTesterQtd(p.id)
            : getTesterQtd(p.id, effectiveDeposito as Deposito);

          return (
            <div
              key={p.id}
              className={baixo ? "card-alert p-4" : "card-premium p-4"}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  onClick={() => p.imageUrl ? setImagemExpandida({ url: p.imageUrl, nome: p.nome }) : null}
                  className={`w-14 h-14 rounded-xl border border-border bg-surface-overlay flex items-center justify-center flex-shrink-0 overflow-hidden ${p.imageUrl ? "cursor-pointer hover:border-gold-muted" : ""} transition-colors`}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <Image size={22} className="text-muted-foreground opacity-40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gold font-mono bg-primary/10 px-2 py-0.5 rounded-md">
                      {p.codigo}
                    </span>
                    {baixo && <AlertTriangle size={12} className="text-destructive flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <h3 className="font-display text-base text-foreground truncate">{p.nome}</h3>
                    {p.classificacao && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                          p.classificacao === "Masculino"
                            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            : p.classificacao === "Feminino"
                            ? "bg-pink-500/15 text-pink-400 border-pink-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {p.classificacao}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.marca} · {(concentracoesConfig[p.concentracao] || p.concentracao)} · {p.tamanho}{p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
                  </p>
                </div>

                {/* Botão de ações rápidas no canto */}
                <div className="ml-2 flex-shrink-0">
                  <QuickActionMenu perfume={p} />
                </div>
              </div>

              {/* Total de unidades centralizado */}
              <div className="flex items-baseline justify-center gap-2 mb-3 py-2 rounded-lg bg-surface-overlay/60">
                <span className={`text-3xl font-bold tracking-tight ${baixo ? "text-destructive" : "text-foreground"}`}>{qtd}</span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">unid.</span>
              </div>


              {/* Per-deposit breakdown - only for master/all deposits */}
              {!userLoja && effectiveDeposito === "Todos" && (
                <div className="flex gap-2 mb-3">
                  {depositos.map((d) => {
                    const testerDeposito = getTesterQtd(p.id, d);
                    return (
                      <div key={d} className="flex-1 bg-surface-overlay rounded-lg p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">{d}</p>
                        <p className={`text-sm font-semibold ${p.estoques[d] <= 0 ? "text-destructive" : "text-foreground"}`}>
                          {p.estoques[d]}
                        </p>
                        {testerDeposito > 0 && (
                          <p className="text-[8px] text-purple-400 mt-0.5 flex items-center justify-center gap-0.5">
                            <FlaskConical size={8} /> {testerDeposito}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tester indicator */}
              <div className="mb-2">
                {testerTotal > 0 ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/8 border border-purple-500/20">
                    <FlaskConical size={12} className="text-purple-400" />
                    <span className="text-[11px] text-purple-400 font-medium">
                      {testerTotal === 1 ? "Tester disponível" : `Testers: ${testerTotal} unidades`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-overlay">
                    <FlaskConical size={12} className="text-muted-foreground opacity-40" />
                    <span className="text-[11px] text-muted-foreground">
                      {userLoja ? "Sem tester nesta loja" : effectiveDeposito === "Todos" ? "Sem tester" : `Sem tester neste depósito`}
                    </span>
                  </div>
                )}
              </div>

              {/* Price info - vendedor only sees sale price */}
              {isMaster ? (
                <div className="border-t border-border pt-3">
                  {/* Custo Médio - destaque principal */}
                  <div className="flex items-center justify-between mb-2.5 px-2.5 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                    <p className="text-[10px] font-medium text-amber-400/80">Custo Médio</p>
                    <p className="text-sm font-bold text-amber-400">{formatCurrency(p.custoMedio || 0)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Custo unit.</p>
                      <p className="text-xs text-foreground">{formatCurrency(p.custo)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Venda unit.</p>
                      <p className="text-xs text-gold font-medium">{formatCurrency(p.precoVenda)}</p>
                    </div>
                    <div className="text-right flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditandoPerfume(p)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold transition-colors duration-150"
                      >
                        <Pencil size={11} /> Editar
                      </button>
                      <button
                        onClick={async () => {
                          const ok = window.confirm(
                            `Excluir o perfume "${p.nome}"?\n\nEsta ação é permanente e não pode ser desfeita.`
                          );
                          if (!ok) return;
                          try {
                            await excluirPerfume(p.id);
                            toast.success("Perfume excluído com sucesso");
                          } catch (e: any) {
                            toast.error(
                              e?.message?.includes("violates foreign key")
                                ? "Não é possível excluir: existem registros vinculados (vendas, movimentações ou notas)."
                                : "Erro ao excluir perfume"
                            );
                          }
                        }}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors duration-150"
                      >
                        <Trash2 size={11} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border pt-3">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Preço de Venda</p>
                    <p className="text-xs text-gold font-medium">{formatCurrency(p.precoVenda)}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div className="text-center py-20">
            <Package size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

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
    </div>
  );
}
