import { useState, useMemo } from "react";
import { X, Check, History, DollarSign, ChevronDown, Camera } from "lucide-react";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import MarkupCalculator from "@/components/MarkupCalculator";
import ProductImageUpload from "@/components/ProductImageUpload";
import FiscalCostCalculator, { type FiscalBreakdown } from "@/components/FiscalCostCalculator";
import {
  gerarCodigo,
  formatCurrency,
  CLASSIFICACOES_PERFUME,
  type TipoPerfume,
  type Concentracao,
  type Perfume,
  type ClassificacaoPerfume,
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useProdutoCustos } from "@/hooks/useProdutoCustos";
import { usePrecoHistorico } from "@/hooks/usePrecoHistorico";

interface Props {
  perfume: Perfume;
  onClose: () => void;
}

export default function EditarPerfume({ perfume, onClose }: Props) {
  const { casas, editarPerfume, proximaLinhaPorCasa, tiposPerfumeConfig, concentracoesConfig, volumesPadrao } = useApp();
  const { profile } = useAuth();

  const [tipo, setTipo] = useState<TipoPerfume>(perfume.tipo);
  const [casaSigla, setCasaSigla] = useState(perfume.casaSigla);
  const [concentracao, setConcentracao] = useState<Concentracao>(perfume.concentracao);
  const [volume, setVolume] = useState(perfume.volume);
  const [volumeCustom, setVolumeCustom] = useState(!volumesPadrao.includes(perfume.volume));
  const [nome, setNome] = useState(perfume.nome);
  const [custo, setCusto] = useState(String(perfume.custo));
  const [precoVenda, setPrecoVenda] = useState(String(perfume.precoVenda));
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(perfume.estoqueMinimo));
  const [salvando, setSalvando] = useState(false);
  const [imageUrl, setImageUrl] = useState(perfume.imageUrl || "");
  const [codigoBarras, setCodigoBarras] = useState(perfume.codigoBarras || "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [tab, setTab] = useState<"editar" | "custos" | "precos" | "fiscal">("editar");
  const [expandedCustoId, setExpandedCustoId] = useState<string | null>(null);
  const [fiscalBreakdown, setFiscalBreakdown] = useState<FiscalBreakdown | null>(null);
  // Fiscal fields
  const [ncm, setNcm] = useState(perfume.ncm || "");
  const [cfop, setCfop] = useState(perfume.cfop || "");
  const [cstCsosn, setCstCsosn] = useState(perfume.cstCsosn || "");
  const [unidadeFiscal, setUnidadeFiscal] = useState(perfume.unidadeFiscal || "UN");
  const [classificacao, setClassificacao] = useState<ClassificacaoPerfume>((perfume.classificacao as ClassificacaoPerfume) || "Compartilhável");
  const { historico, isLoading: historicoLoading } = useProdutoCustos(perfume.id);
  const { historico: precoHistorico, isLoading: precoLoading, registrar: registrarPreco } = usePrecoHistorico(perfume.id);

  const casasFiltradas = casas.filter((c) => c.tipo === tipo);
  const casaSelecionada = casas.find((c) => c.sigla === casaSigla) || null;

  const linhaPorCasa = useMemo(() => {
    if (casaSigla === perfume.casaSigla) {
      const code = perfume.codigo;
      return parseInt(code.slice(7, 11)) || 1;
    }
    return proximaLinhaPorCasa(casaSigla);
  }, [casaSigla, perfume.casaSigla, perfume.codigo, proximaLinhaPorCasa]);

  const codigoPreview = casaSelecionada
    ? gerarCodigo(tipo, casaSigla, concentracao, linhaPorCasa, volume)
    : "——";

  const { registrarCusto } = useProdutoCustos(perfume.id);

  const handleSubmit = async () => {
    if (!casaSelecionada || !nome || !custo || !precoVenda) return;
    setSalvando(true);
    try {
      const novoCusto = parseFloat(custo);
      const novoPrecoVenda = parseFloat(precoVenda);

      // Track price change if sale price changed
      if (novoPrecoVenda !== perfume.precoVenda) {
        try {
          await registrarPreco({
            produtoId: perfume.id,
            precoAntigo: perfume.precoVenda,
            precoNovo: novoPrecoVenda,
            alteradoPor: profile?.nome || "Desconhecido",
          });
        } catch (e) {
          console.error("Erro ao registrar histórico de preço:", e);
        }
      }

      // Track cost change and recalculate average cost
      // Registra histórico se mudou o custo OU se o usuário aplicou cálculo fiscal
      if (novoCusto !== perfume.custo || fiscalBreakdown) {
        try {
          const estoqueTotal = Object.values(perfume.estoques || {}).reduce((sum, v) => sum + v, 0);
          const custoMedioAtual = perfume.custoMedio || perfume.custo;
          const novoCustoMedio = estoqueTotal > 0
            ? ((custoMedioAtual * estoqueTotal + novoCusto * estoqueTotal) / (estoqueTotal * 2))
            : novoCusto;

          const qtd = Math.max(estoqueTotal, 1);
          await registrarCusto({
            produtoId: perfume.id,
            custoUnitario: novoCusto,
            origem: "manual",
            quantidade: estoqueTotal,
            valorProduto: fiscalBreakdown ? fiscalBreakdown.precoUnitario * qtd : 0,
            valorIcms: fiscalBreakdown ? fiscalBreakdown.valorIcmsUnit * qtd : 0,
            valorIpi: fiscalBreakdown ? fiscalBreakdown.valorIpiUnit * qtd : 0,
            valorFrete: fiscalBreakdown ? fiscalBreakdown.freteUnit * qtd : 0,
            valorOutros: fiscalBreakdown ? fiscalBreakdown.outrosUnit * qtd : 0,
            valorDesconto: fiscalBreakdown ? fiscalBreakdown.descontoUnit * qtd : 0,
            aliquotaIcms: fiscalBreakdown ? fiscalBreakdown.aliquotaIcms : 0,
            aliquotaIpi: fiscalBreakdown ? fiscalBreakdown.aliquotaIpi : 0,
            observacao: fiscalBreakdown
              ? `Ajuste manual · ICMS ${fiscalBreakdown.aliquotaIcms}% · IPI ${fiscalBreakdown.aliquotaIpi}% · Frete ${formatCurrency(fiscalBreakdown.freteUnit)}/un`
              : "Ajuste manual de custo",
          });

          // Update custo_medio on perfumes table
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase
            .from("perfumes")
            .update({
              custo_medio: novoCustoMedio,
              ultimo_custo_em: new Date().toISOString(),
            })
            .eq("id", perfume.id);
        } catch (e) {
          console.error("Erro ao registrar histórico de custo:", e);
        }
      }

      await editarPerfume({
        id: perfume.id,
        nome,
        marca: casaSelecionada.nome,
        casaSigla,
        tipo,
        concentracao,
        tamanho: `${volume}ml`,
        volume,
        custo: novoCusto,
        precoVenda: novoPrecoVenda,
        estoqueMinimo: parseInt(estoqueMinimo) || 2,
        codigo: codigoPreview,
        imageUrl,
        ncm,
        cfop,
        cstCsosn,
        unidadeFiscal,
        codigoBarras: codigoBarras.trim(),
        classificacao,
      } as any);
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-border">
        <div>
          <h2 className="font-display text-xl text-gold">Editar Produto</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{perfume.codigo}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-surface border border-border text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([["editar", "Dados"], ["fiscal", "Fiscal"], ["custos", "Custos"], ["precos", "Preços"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t ? "text-gold border-b-2 border-gold" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {tab === "editar" ? (
        <div className="px-4 pt-4 space-y-5">
          {/* Preview do código */}
          <div className="bg-gold/10 border border-gold-muted rounded-xl p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Código atualizado</p>
            <p className="font-mono text-2xl font-bold text-gold tracking-widest">{codigoPreview}</p>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Tipo de Perfume</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(tiposPerfumeConfig) as [TipoPerfume, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setTipo(key); setCasaSigla(""); }}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    tipo === key
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-mono">{key}</span>
                  <span className="block text-[9px] mt-0.5 font-normal">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Casa */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Casa / Marca</label>
            {casasFiltradas.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-surface border border-border rounded-xl p-4 text-center">
                Nenhuma casa cadastrada para {tiposPerfumeConfig[tipo]}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {casasFiltradas.map((c) => (
                  <button
                    key={c.sigla}
                    onClick={() => setCasaSigla(c.sigla)}
                    className={`py-2 px-1 rounded-lg text-xs border transition-all ${
                      casaSigla === c.sigla
                        ? "bg-gold text-primary-foreground border-gold"
                        : "bg-surface border-border text-foreground"
                    }`}
                  >
                    <span className="block font-mono font-bold">{c.sigla}</span>
                    <span className="block text-[9px] mt-0.5 truncate font-normal">{c.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Concentração */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Concentração</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(concentracoesConfig) as [Concentracao, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setConcentracao(key)}
                  className={`py-2 px-3 rounded-lg text-xs border transition-all text-left ${
                    concentracao === key
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-mono font-bold">{key}</span>
                  <span className="block text-[9px] mt-0.5 font-normal">{label.split("–")[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Volume (ml)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {volumesPadrao.map((v) => (
                <button
                  key={v}
                  onClick={() => { setVolume(v); setVolumeCustom(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    volume === v && !volumeCustom
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface border-border text-muted-foreground"
                  }`}
                >
                  {v}ml
                </button>
              ))}
              <button
                onClick={() => setVolumeCustom(true)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  volumeCustom
                    ? "bg-gold text-primary-foreground border-gold"
                    : "bg-surface border-border text-muted-foreground"
                }`}
              >
                Outro
              </button>
            </div>
            {volumeCustom && (
              <input
                type="number"
                placeholder="Volume em ml"
                value={volume || ""}
                onChange={(e) => setVolume(parseInt(e.target.value) || 0)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            )}
          </div>

          {/* Foto do Produto */}
          <ProductImageUpload currentUrl={imageUrl} onUpload={setImageUrl} />

          <div className="border-t border-border" />

          {/* Código de Barras */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Código de Barras</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: 7898123456789"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 rounded-xl border border-border bg-surface hover:border-gold-muted text-foreground flex items-center gap-1.5 text-sm"
                aria-label="Ler com a câmera"
              >
                <Camera className="w-4 h-4 text-gold-muted" />
              </button>
            </div>
          </div>

          <BarcodeScannerDialog
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={(code) => {
              setCodigoBarras(code);
              setScannerOpen(false);
            }}
          />


          {/* Nome */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nome da Fragrância</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
            />
          </div>

          {/* Classificação */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Classificação do Perfume</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CLASSIFICACOES_PERFUME.map((c) => (
                <button
                  key={c}
                  onClick={() => setClassificacao(c)}
                  className={`py-2 px-2 rounded-lg text-xs border transition-all ${
                    classificacao === c
                      ? "bg-gold text-primary-foreground border-gold"
                      : "bg-surface border-border text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Custo (R$)</label>
              <input
                type="number"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Preço de Venda (R$)</label>
              <input
                type="number"
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
          </div>

          {/* Calculadora Fiscal: ICMS/IPI/Frete -> Custo Real */}
          {(parseFloat(custo) || 0) > 0 && (
            <FiscalCostCalculator
              precoUnitario={parseFloat(custo) || 0}
              onApply={(b) => {
                setFiscalBreakdown(b);
                setCusto(b.custoReal.toFixed(2));
              }}
            />
          )}
          {fiscalBreakdown && (
            <div className="text-[10px] text-gold/80">
              ✓ Custo real aplicado: {formatCurrency(fiscalBreakdown.custoReal)} (Produto + ICMS + IPI + Frete + Outros − Desconto)
            </div>
          )}

          {/* Markup Calculator */}
          <MarkupCalculator
            custo={parseFloat(custo) || 0}
            precoVenda={precoVenda}
            onPrecoChange={(preco) => setPrecoVenda(preco)}
          />

          {/* Estoque mínimo */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Estoque Mínimo</label>
            <input
              type="number"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
            />
          </div>
        </div>
        ) : tab === "fiscal" ? (
          /* Fiscal Tab */
          <div className="px-4 pt-4 space-y-5">
            <div className="bg-gold/10 border border-gold-muted rounded-xl p-4">
              <p className="text-xs font-semibold text-gold mb-1">Cadastro Fiscal</p>
              <p className="text-[10px] text-muted-foreground">Campos obrigatórios para emissão de NFC-e. Preencha NCM, CFOP e CST/CSOSN para este produto.</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">NCM (Nomenclatura Comum do Mercosul)</label>
              <input
                type="text"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="Ex: 3303.00.20"
                maxLength={10}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-gold-muted"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Perfumes: 3303.00.20 · Cosméticos: 3304.99.90</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">CFOP (Código Fiscal de Operações)</label>
              <input
                type="text"
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                placeholder="Ex: 5102"
                maxLength={4}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-gold-muted"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Venda dentro do estado: 5102 · Venda fora do estado: 6102</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">CST ou CSOSN</label>
              <input
                type="text"
                value={cstCsosn}
                onChange={(e) => setCstCsosn(e.target.value)}
                placeholder="Ex: 102 (Simples Nacional)"
                maxLength={4}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-gold-muted"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Simples Nacional: 102 · Regime Normal: 00, 40, 60</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Unidade Fiscal</label>
              <div className="flex flex-wrap gap-1.5">
                {["UN", "CX", "KG", "LT", "ML", "PCT"].map(u => (
                  <button
                    key={u}
                    onClick={() => setUnidadeFiscal(u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      unidadeFiscal === u
                        ? "bg-gold text-primary-foreground border-gold"
                        : "bg-surface border-border text-muted-foreground"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "custos" ? (
          /* Cost History Tab */
          <div className="px-4 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card-premium p-4">
                <p className="text-[10px] text-muted-foreground mb-1">Custo Atual</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(perfume.custo)}</p>
              </div>
              <div className="card-premium p-4">
                <p className="text-[10px] text-muted-foreground mb-1">Custo Médio</p>
                <p className="text-lg font-bold text-gold">{formatCurrency(perfume.custoMedio || 0)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <History size={14} className="text-gold" /> Linha do Tempo de Custos
              </h3>
              {historicoLoading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : historico.length === 0 ? (
                <div className="text-center py-10">
                  <History size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-xs text-muted-foreground">Nenhum histórico de custo registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historico.map((h) => {
                    const temDiscriminacao =
                      h.valorIcms > 0 || h.valorIpi > 0 || h.valorFrete > 0 ||
                      h.valorSeguro > 0 || h.valorOutros > 0 || h.valorDesconto > 0 ||
                      h.valorProduto > 0 || h.aliquotaIcms > 0 || h.aliquotaIpi > 0 || !!h.observacao;
                    const expanded = expandedCustoId === h.id;
                    return (
                      <div key={h.id} className="card-premium p-3">
                        <button
                          type="button"
                          onClick={() => temDiscriminacao && setExpandedCustoId(expanded ? null : h.id)}
                          className="w-full flex items-center justify-between text-left"
                          disabled={!temDiscriminacao}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{formatCurrency(h.custoUnitario)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {new Date(h.data).toLocaleDateString("pt-BR")} · {h.origem === "nota" ? "Nota Fiscal" : h.origem === "manual" ? "Manual" : "Ajuste"}
                              {h.observacao ? ` · ${h.observacao}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                              h.origem === "nota" ? "bg-success/15 text-success" :
                              h.origem === "manual" ? "bg-primary/10 text-gold" :
                              "bg-blue-400/15 text-blue-400"
                            }`}>
                              {h.origem}
                            </span>
                            {temDiscriminacao && (
                              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                            )}
                          </div>
                        </button>

                        {expanded && temDiscriminacao && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2">
                            {h.quantidade > 0 && (
                              <p className="text-[10px] text-muted-foreground">Quantidade: <span className="text-foreground font-medium">{h.quantidade}</span></p>
                            )}
                            {(() => {
                              const qtd = h.quantidade > 0 ? h.quantidade : 1;
                              const unit = (v: number) => v / qtd;
                              const Row = ({ label, valor, destrutivo }: { label: string; valor: number; destrutivo?: boolean }) => (
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground truncate">{label}</span>
                                  <span className={`${destrutivo ? "text-destructive" : "text-foreground"} font-medium whitespace-nowrap`}>
                                    {destrutivo ? "−" : ""}{formatCurrency(valor)}
                                    {h.quantidade > 0 && (
                                      <span className="text-muted-foreground font-normal"> · un. {destrutivo ? "−" : ""}{formatCurrency(unit(valor))}</span>
                                    )}
                                  </span>
                                </div>
                              );
                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                                  {h.valorProduto > 0 && <Row label="Produto" valor={h.valorProduto} />}
                                  {(h.valorIcms > 0 || h.aliquotaIcms > 0) && <Row label={`ICMS${h.aliquotaIcms > 0 ? ` (${h.aliquotaIcms}%)` : ""}`} valor={h.valorIcms} />}
                                  {(h.valorIpi > 0 || h.aliquotaIpi > 0) && <Row label={`IPI${h.aliquotaIpi > 0 ? ` (${h.aliquotaIpi}%)` : ""}`} valor={h.valorIpi} />}
                                  {h.valorFrete > 0 && <Row label="Frete" valor={h.valorFrete} />}
                                  {h.valorSeguro > 0 && <Row label="Seguro" valor={h.valorSeguro} />}
                                  {h.valorOutros > 0 && <Row label="Outros" valor={h.valorOutros} />}
                                  {h.valorDesconto > 0 && <Row label="Desconto" valor={h.valorDesconto} destrutivo />}
                                </div>
                              );
                            })()}
                            {h.quantidade > 0 && (h.valorProduto + h.valorIcms + h.valorIpi + h.valorFrete + h.valorSeguro + h.valorOutros) > 0 && (
                              <div className="pt-2 border-t border-border/50 flex justify-between text-[10px]">
                                <span className="text-muted-foreground">Custo total da entrada</span>
                                <span className="text-gold font-semibold">
                                  {formatCurrency(h.custoUnitario * h.quantidade)}
                                  <span className="text-muted-foreground font-normal"> · un. {formatCurrency(h.custoUnitario)}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Price History Tab */
          <div className="px-4 pt-4 space-y-4">
            <div className="card-premium p-4">
              <p className="text-[10px] text-muted-foreground mb-1">Preço de Venda Atual</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(perfume.precoVenda)}</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <DollarSign size={14} className="text-gold" /> Histórico de Alterações de Preço
              </h3>
              {precoLoading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : precoHistorico.length === 0 ? (
                <div className="text-center py-10">
                  <DollarSign size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-xs text-muted-foreground">Nenhuma alteração de preço registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {precoHistorico.map((h) => (
                    <div key={h.id} className="card-premium p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground line-through">{formatCurrency(h.precoAntigo)}</span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={`text-xs font-bold ${h.precoNovo > h.precoAntigo ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(h.precoNovo)}
                          </span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                          h.precoNovo > h.precoAntigo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}>
                          {h.precoNovo > h.precoAntigo ? "↑" : "↓"} {Math.abs(((h.precoNovo - h.precoAntigo) / h.precoAntigo) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(h.data).toLocaleDateString("pt-BR")} · por {h.alteradoPor}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
        <button
          disabled={salvando || !casaSelecionada || !nome || !custo || !precoVenda}
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
          style={{ background: "var(--gradient-gold)" }}
        >
          <Check size={16} /> {salvando ? "Salvando…" : "Salvar Alterações"}
        </button>
      </div>
    </div>
  );
}
