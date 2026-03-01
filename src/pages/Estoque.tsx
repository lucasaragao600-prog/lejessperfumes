import { useState, useMemo } from "react";
import { Package, Search, AlertTriangle, Plus, Pencil } from "lucide-react";
import { formatCurrency, type Deposito, type Perfume, type TipoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import CadastroPerfume from "@/components/CadastroPerfume";
import EditarPerfume from "@/components/EditarPerfume";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function Estoque({ isMaster = true }: { isMaster?: boolean }) {
  const { perfumes, tiposPerfumeConfig, concentracoesConfig } = useApp();
  const tipos = useMemo(() =>
    Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key: key as TipoPerfume, label: String(label) })),
    [tiposPerfumeConfig]
  );
  const [busca, setBusca] = useState("");
  const [depositoFiltro, setDepositoFiltro] = useState<Deposito | "Todos">("Todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoPerfume | "Todos">("Todos");
  const [showAlertas, setShowAlertas] = useState(false);
  const [custoMin, setCustoMin] = useState("");
  const [custoMax, setCustoMax] = useState("");
  const [vendaMin, setVendaMin] = useState("");
  const [vendaMax, setVendaMax] = useState("");
  const [showCadastro, setShowCadastro] = useState(false);
  const [editandoPerfume, setEditandoPerfume] = useState<Perfume | null>(null);

  const filtrados = useMemo(() => {
    return perfumes.filter((p) => {
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
      const matchCustoMin = custoMin === "" || p.custo >= Number(custoMin);
      const matchCustoMax = custoMax === "" || p.custo <= Number(custoMax);
      const matchVendaMin = vendaMin === "" || p.precoVenda >= Number(vendaMin);
      const matchVendaMax = vendaMax === "" || p.precoVenda <= Number(vendaMax);
      const matchPreco = matchCustoMin && matchCustoMax && matchVendaMin && matchVendaMax;
      const qtd = depositoFiltro === "Todos"
        ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
        : p.estoques[depositoFiltro];

      if (showAlertas) return matchBusca && matchTipo && matchPreco && qtd <= p.estoqueMinimo;
      return matchBusca && matchTipo && matchPreco;
    });
  }, [perfumes, busca, depositoFiltro, tipoFiltro, showAlertas, custoMin, custoMax, vendaMin, vendaMax]);

  const totais = useMemo(() => {
    return filtrados.reduce(
      (acc, p) => {
        const qtdGeral = Object.values(p.estoques).reduce((a, b) => a + b, 0);
        const qtd = depositoFiltro === "Todos" ? qtdGeral : p.estoques[depositoFiltro as Deposito];
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
  }, [filtrados, depositoFiltro]);

  const alertas = perfumes.filter((p) => {
    const qtd = depositoFiltro === "Todos"
      ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
      : p.estoques[depositoFiltro as Deposito];
    return qtd <= p.estoqueMinimo;
  }).length;

  const getQtd = (p: Perfume) =>
    depositoFiltro === "Todos"
      ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
      : p.estoques[depositoFiltro as Deposito];

  const isBaixo = (p: Perfume) => getQtd(p) <= p.estoqueMinimo;

  return (
    <div className="min-h-screen bg-background pb-24">
      {showCadastro && <CadastroPerfume onClose={() => setShowCadastro(false)} />}
      {editandoPerfume && <EditarPerfume perfume={editandoPerfume} onClose={() => setEditandoPerfume(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Estoque</h1>
            <p className="page-subtitle mt-1">{filtrados.length} produtos</p>
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
              <button onClick={() => setShowCadastro(true)} className="btn-primary px-4 py-2">
                <Plus size={14} /> Novo
              </button>
            )}
          </div>
        </div>

        {/* Search */}
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

        {/* Deposit filter */}
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

        {/* Price filters */}
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
      </div>

      {/* Quantity cards */}
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
          return (
            <div
              key={p.id}
              className={baixo ? "card-alert p-4" : "card-premium p-4"}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gold font-mono bg-primary/10 px-2 py-0.5 rounded-md">
                      {p.codigo}
                    </span>
                    {baixo && <AlertTriangle size={12} className="text-destructive flex-shrink-0" />}
                  </div>
                  <h3 className="font-display text-base text-foreground mt-1.5 truncate">{p.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.marca} · {(concentracoesConfig[p.concentracao] || p.concentracao)} · {p.tamanho}</p>
                </div>
                <div className="text-right ml-4">
                  <p className={`text-2xl font-bold tracking-tight ${baixo ? "text-destructive" : "text-foreground"}`}>{qtd}</p>
                  <p className="text-[10px] text-muted-foreground">unid.</p>
                </div>
              </div>

              {depositoFiltro === "Todos" && (
                <div className="flex gap-2 mb-3">
                  {depositos.map((d) => (
                    <div key={d} className="flex-1 bg-surface-overlay rounded-lg p-2 text-center">
                      <p className="text-[9px] text-muted-foreground">{d}</p>
                      <p className={`text-sm font-semibold ${p.estoques[d] <= 0 ? "text-destructive" : "text-foreground"}`}>
                        {p.estoques[d]}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {isMaster && (
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 items-end">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Custo unit.</p>
                    <p className="text-xs text-foreground">{formatCurrency(p.custo)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Venda unit.</p>
                    <p className="text-xs text-gold font-medium">{formatCurrency(p.precoVenda)}</p>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => setEditandoPerfume(p)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold transition-colors duration-150 ml-auto"
                    >
                      <Pencil size={11} /> Editar
                    </button>
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
    </div>
  );
}
