import { useState, useMemo } from "react";
import { Package, Search, AlertTriangle, Plus } from "lucide-react";
import { formatCurrency, type Deposito, type Perfume, type TipoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import CadastroPerfume from "@/components/CadastroPerfume";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function Estoque({ isMaster = true }: { isMaster?: boolean }) {
  const { perfumes, tiposPerfumeConfig } = useApp();
  const tipos = useMemo(() =>
    Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key: key as TipoPerfume, label: String(label) })),
    [tiposPerfumeConfig]
  );
  const [busca, setBusca] = useState("");
  const [depositoFiltro, setDepositoFiltro] = useState<Deposito | "Todos">("Todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoPerfume | "Todos">("Todos");
  const [showAlertas, setShowAlertas] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);

  const filtrados = useMemo(() => {
    return perfumes.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        p.marca.toLowerCase().includes(busca.toLowerCase());

      const matchTipo = tipoFiltro === "Todos" || p.tipo === tipoFiltro;

      const qtd = depositoFiltro === "Todos"
        ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
        : p.estoques[depositoFiltro];

      if (showAlertas) return matchBusca && matchTipo && qtd <= p.estoqueMinimo;
      return matchBusca && matchTipo;
    });
  }, [perfumes, busca, depositoFiltro, tipoFiltro, showAlertas]);

  const totais = useMemo(() => {
    // Deriva dos perfumes já filtrados (busca + tipo + depósito + alertas)
    return filtrados.reduce(
      (acc, p) => {
        const qtd = depositoFiltro === "Todos"
          ? Object.values(p.estoques).reduce((a, b) => a + b, 0)
          : p.estoques[depositoFiltro as Deposito];
        acc.custo += qtd * p.custo;
        acc.venda += qtd * p.precoVenda;
        return acc;
      },
      { custo: 0, venda: 0 }
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
      {/* Modal de cadastro */}
      {showCadastro && <CadastroPerfume onClose={() => setShowCadastro(false)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-gold">Estoque</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{filtrados.length} produtos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlertas(!showAlertas)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                showAlertas
                  ? "bg-destructive/20 border-destructive text-destructive"
                  : alertas > 0
                  ? "bg-destructive/10 border-destructive/40 text-destructive"
                  : "bg-surface border-border text-muted-foreground"
              }`}
            >
              <AlertTriangle size={12} />
              {alertas}
            </button>
            <button
              onClick={() => setShowCadastro(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gold-muted bg-gold/10 text-gold transition-all"
            >
              <Plus size={12} /> Novo
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nome, código ou marca..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted transition-colors"
          />
        </div>

        {/* Filtro depósito */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2">
          {(["Todos", ...depositos] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepositoFiltro(d)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                depositoFiltro === d
                  ? "bg-gold text-primary-foreground border-gold shadow-gold"
                  : "bg-surface border-border text-muted-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Filtro tipo de perfume */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {([{ key: "Todos" as const, label: "Todos os tipos" }, ...tipos]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTipoFiltro(key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                tipoFiltro === key
                  ? "bg-gold/20 text-gold border-gold-muted"
                  : "bg-surface border-border text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de valor - somente master */}
      {isMaster && (
        <div className="px-4 mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Custo", value: totais.custo, color: "text-muted-foreground" },
            { label: "Venda", value: totais.venda, color: "text-gold" },
            { label: "Lucro pot.", value: totais.venda - totais.custo, color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
              <p className={`text-xs font-semibold ${color}`}>
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-3">
        {filtrados.map((p) => {
          const qtd = getQtd(p);
          const baixo = isBaixo(p);
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition-all ${
                baixo
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-surface border-border"
              }`}
              style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gold font-mono bg-gold/10 px-1.5 py-0.5 rounded">
                      {p.codigo}
                    </span>
                    {baixo && <AlertTriangle size={12} className="text-destructive flex-shrink-0" />}
                  </div>
                  <h3 className="font-display text-base text-foreground mt-1 truncate">{p.nome}</h3>
                  <p className="text-xs text-muted-foreground">{p.marca} · {p.concentracao} · {p.tamanho}</p>
                </div>
                <div className="text-right ml-3">
                  <p className={`text-2xl font-bold ${baixo ? "text-destructive" : "text-gold"}`}>{qtd}</p>
                  <p className="text-[10px] text-muted-foreground">unid.</p>
                </div>
              </div>

              {/* Por depósito (se Todos) */}
              {depositoFiltro === "Todos" && (
                <div className="flex gap-2 mb-3">
                  {depositos.map((d) => (
                    <div key={d} className="flex-1 bg-surface-overlay rounded-lg p-1.5 text-center">
                      <p className="text-[9px] text-muted-foreground">{d}</p>
                      <p className={`text-sm font-semibold ${p.estoques[d] <= 0 ? "text-destructive" : "text-foreground"}`}>
                        {p.estoques[d]}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Valores - somente master */}
              {isMaster && (
                <div className="grid grid-cols-3 gap-1.5 border-t border-border pt-2">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Custo unit.</p>
                    <p className="text-xs text-foreground">{formatCurrency(p.custo)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Venda unit.</p>
                    <p className="text-xs text-gold">{formatCurrency(p.precoVenda)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Lucro unit.</p>
                    <p className="text-xs text-emerald-400">{formatCurrency(p.precoVenda - p.custo)}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhum produto encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
