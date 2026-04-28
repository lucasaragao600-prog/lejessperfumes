import { useState, useMemo } from "react";
import { Plus, Settings, X, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import {
  gerarCodigo,
  type TipoPerfume,
  type Concentracao,
  type Perfume,
  type Casa,
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useProdutoCustos } from "@/hooks/useProdutoCustos";
import FiscalCostCalculator, { type FiscalBreakdown } from "@/components/FiscalCostCalculator";
import SimilarProductsDialog from "@/components/SimilarProductsDialog";
import { findSimilarProducts, type SimilarityCandidate } from "@/lib/productSimilarity";

interface Props {
  onClose: () => void;
}

type Tab = "cadastrar" | "casas";

export default function CadastroPerfume({ onClose }: Props) {
  const { perfumes, casas, adicionarCasaDB, removerCasaDB, adicionarPerfume, proximaLinhaPorCasa, tiposPerfumeConfig, concentracoesConfig, volumesPadrao } = useApp();
  const { registrarCusto } = useProdutoCustos();
  const [tab, setTab] = useState<Tab>("cadastrar");
  const [fiscalBreakdown, setFiscalBreakdown] = useState<FiscalBreakdown | null>(null);
  const [similares, setSimilares] = useState<SimilarityCandidate[] | null>(null);

  // --- Estado do formulário ---
  const [tipo, setTipo] = useState<TipoPerfume>("NI");
  const [casaSelecionada, setCasaSelecionada] = useState<Casa | null>(null);
  const [concentracao, setConcentracao] = useState<Concentracao>("EDP");
  const [volume, setVolume] = useState<number>(100);
  const [volumeCustom, setVolumeCustom] = useState(false);
  const [nome, setNome] = useState("");
  const [custo, setCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("2");
  const [estCasa, setEstCasa] = useState("0");
  const [estSumauma, setEstSumauma] = useState("0");
  const [estAmazonas, setEstAmazonas] = useState("0");
  const [showMarkup, setShowMarkup] = useState(false);

  // Parâmetros de markup
  const [impostos, setImpostos] = useState("6");
  const [taxaCartao, setTaxaCartao] = useState("3.5");
  const [margemLiquida, setMargemLiquida] = useState("32");
  const [rateioOperacional, setRateioOperacional] = useState("20");
  const [fretePadrao, setFretePadrao] = useState("0");
  const [embalagemPadrao, setEmbalagemPadrao] = useState("0");
  const [ajustePsicologico, setAjustePsicologico] = useState(true);
  const [centavosFinal, setCentavosFinal] = useState("0.90");
  const [digitoFinal, setDigitoFinal] = useState("9");

  const cenarios = [
    { nome: "Cautela (1,8x)", mult: 1.8 },
    { nome: "Saudável (2,5x)", mult: 2.5 },
    { nome: "Premium (3,0x)", mult: 3.0 },
    { nome: "Competitivo (2,3x)", mult: 2.3 },
  ];

  const custoNum = parseFloat(custo) || 0;

  const precoCalculado = useMemo(() => {
    if (!custoNum) return null;
    const imp = parseFloat(impostos) / 100 || 0;
    const taxa = parseFloat(taxaCartao) / 100 || 0;
    const margem = parseFloat(margemLiquida) / 100 || 0;
    const rateio = parseFloat(rateioOperacional) || 0;
    const frete = parseFloat(fretePadrao) || 0;
    const embalagem = parseFloat(embalagemPadrao) || 0;

    const custoTotal = custoNum + rateio + frete + embalagem;
    const divisor = 1 - imp - taxa - margem;
    if (divisor <= 0) return null;
    let preco = custoTotal / divisor;

    if (ajustePsicologico) {
      const centavos = parseFloat(centavosFinal) || 0;
      const digito = parseInt(digitoFinal) || 9;
      const inteiro = Math.ceil(preco / 10) * 10 - (10 - digito);
      preco = inteiro + centavos;
    }

    return preco;
  }, [custoNum, impostos, taxaCartao, margemLiquida, rateioOperacional, fretePadrao, embalagemPadrao, ajustePsicologico, centavosFinal, digitoFinal]);

  const precosCenarios = useMemo(() => {
    if (!custoNum) return [];
    return cenarios.map((c) => {
      let preco = custoNum * c.mult;
      if (ajustePsicologico) {
        const centavos = parseFloat(centavosFinal) || 0;
        const digito = parseInt(digitoFinal) || 9;
        const inteiro = Math.ceil(preco / 10) * 10 - (10 - digito);
        preco = inteiro + centavos;
      }
      return { ...c, preco };
    });
  }, [custoNum, ajustePsicologico, centavosFinal, digitoFinal]);

  // --- Estado cadastro de casa ---
  const [novaCasaNome, setNovaCasaNome] = useState("");
  const [novaCasaSigla, setNovaCasaSigla] = useState("");
  const [novaCasaTipo, setNovaCasaTipo] = useState<TipoPerfume>("NI");

  // Próximo número de linha por casa selecionada
  const linhaCasa = casaSelecionada ? proximaLinhaPorCasa(casaSelecionada.sigla) : 1;

  // Código gerado ao vivo
  const codigoPreview =
    casaSelecionada
      ? gerarCodigo(tipo, casaSelecionada.sigla, concentracao, linhaCasa, volume)
      : "——";

  const casasFiltradas = casas.filter((c) => c.tipo === tipo);

  const executarCadastro = async () => {
    if (!casaSelecionada) return;
    const custoFinal = fiscalBreakdown ? fiscalBreakdown.custoReal : parseFloat(custo);
    const novoId = `p${Date.now()}`;
    const novoPerfume: Perfume = {
      id: novoId,
      codigo: gerarCodigo(tipo, casaSelecionada.sigla, concentracao, linhaCasa, volume),
      codigoBarras: codigoBarras.trim(),
      nome,
      marca: casaSelecionada.nome,
      casaSigla: casaSelecionada.sigla,
      tipo,
      concentracao,
      tamanho: `${volume}ml`,
      volume,
      custo: custoFinal,
      precoVenda: parseFloat(precoVenda),
      estoques: {
        Casa: parseInt(estCasa) || 0,
        Sumaúma: parseInt(estSumauma) || 0,
        Amazonas: parseInt(estAmazonas) || 0,
      },
      estoqueMinimo: parseInt(estoqueMinimo) || 2,
    };
    await adicionarPerfume(novoPerfume);
    // Registra histórico de custo discriminado se houve cálculo fiscal
    if (fiscalBreakdown) {
      const qtdInicial = (parseInt(estCasa) || 0) + (parseInt(estSumauma) || 0) + (parseInt(estAmazonas) || 0);
      try {
        await registrarCusto({
          produtoId: novoId,
          custoUnitario: fiscalBreakdown.custoReal,
          origem: "manual",
          quantidade: qtdInicial,
          valorProduto: fiscalBreakdown.precoUnitario * Math.max(qtdInicial, 1),
          valorIcms: fiscalBreakdown.valorIcmsUnit * Math.max(qtdInicial, 1),
          valorIpi: fiscalBreakdown.valorIpiUnit * Math.max(qtdInicial, 1),
          valorFrete: fiscalBreakdown.freteUnit * Math.max(qtdInicial, 1),
          valorOutros: fiscalBreakdown.outrosUnit * Math.max(qtdInicial, 1),
          valorDesconto: fiscalBreakdown.descontoUnit * Math.max(qtdInicial, 1),
          aliquotaIcms: fiscalBreakdown.aliquotaIcms,
          aliquotaIpi: fiscalBreakdown.aliquotaIpi,
          observacao: `Cadastro inicial · ICMS ${fiscalBreakdown.aliquotaIcms}% · IPI ${fiscalBreakdown.aliquotaIpi}%`,
        });
      } catch (e) {
        console.error("Erro ao registrar histórico de custo no cadastro:", e);
      }
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!casaSelecionada || !nome || !custo || !precoVenda) return;
    // Validação de similaridade (>= 80%)
    const candidatos = findSimilarProducts(
      {
        nome,
        marca: casaSelecionada.nome,
        casaSigla: casaSelecionada.sigla,
        concentracao,
        volume,
      },
      perfumes,
      0.8,
    );
    if (candidatos.length > 0) {
      setSimilares(candidatos);
      return;
    }
    await executarCadastro();
  };

  const handleAdicionarCasa = async () => {
    if (!novaCasaNome || novaCasaSigla.length < 2 || novaCasaSigla.length > 3) return;
    const nova: Casa = {
      sigla: novaCasaSigla.toUpperCase().slice(0, 3),
      nome: novaCasaNome,
      tipo: novaCasaTipo,
    };
    await adicionarCasaDB(nova);
    setNovaCasaNome("");
    setNovaCasaSigla("");
  };

  const handleRemoverCasa = async (sigla: string) => {
    await removerCasaDB(sigla);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-border">
        <div>
          <h2 className="font-display text-xl text-gold">Novo Produto</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cadastro com código automático</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-surface border border-border text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([["cadastrar", "Cadastrar Produto"], ["casas", "Gerenciar Casas"]] as [Tab, string][]).map(([t, label]) => (
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
        {tab === "cadastrar" && (
          <div className="px-4 pt-4 space-y-5">
            {/* Preview do código */}
            <div className="bg-gold/10 border border-gold-muted rounded-xl p-4 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Código gerado automaticamente</p>
              <p className="font-mono text-2xl font-bold text-gold tracking-widest">{codigoPreview}</p>
              <p className="text-[9px] text-muted-foreground mt-1">
                TIPO · CASA · CONC · LINHA · VOLUME
              </p>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tipo de Perfume (TT)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.entries(tiposPerfumeConfig) as [TipoPerfume, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setTipo(key); setCasaSelecionada(null); }}
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground">Casa / Marca (MM)</label>
                <button
                  onClick={() => setTab("casas")}
                  className="text-[10px] text-gold flex items-center gap-1"
                >
                  <Settings size={10} /> Gerenciar casas
                </button>
              </div>
              {casasFiltradas.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma casa cadastrada para {tiposPerfumeConfig[tipo]}</p>
                  <button onClick={() => setTab("casas")} className="text-gold text-xs mt-1">+ Adicionar casa</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {casasFiltradas.map((c) => (
                    <button
                      key={c.sigla}
                      onClick={() => setCasaSelecionada(c)}
                      className={`py-2 px-1 rounded-lg text-xs border transition-all ${
                        casaSelecionada?.sigla === c.sigla
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
              <label className="text-xs text-muted-foreground mb-2 block">Concentração (CC)</label>
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
              <label className="text-xs text-muted-foreground mb-2 block">Volume / ml (VVV)</label>
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

            {/* Linha separadora */}
            <div className="border-t border-border" />

            {/* Código de Barras */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Código de Barras (opcional)</label>
              <input
                type="text"
                placeholder="Ex: 7898123456789"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>

            {/* Nome */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Nome da Fragrância / Linha</label>
              <input
                type="text"
                placeholder="Ex: Black Orchid"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Custo (R$)</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={custo}
                  onChange={(e) => setCusto(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Preço de Venda (R$)</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
                />
              </div>
            </div>

            {/* Calculadora Fiscal: ICMS/IPI/Frete -> Custo Real */}
            {custoNum > 0 && (
              <FiscalCostCalculator
                precoUnitario={custoNum}
                onApply={(b) => {
                  setFiscalBreakdown(b);
                  setCusto(b.custoReal.toFixed(2));
                }}
              />
            )}
            {fiscalBreakdown && (
              <div className="text-[10px] text-gold/80 -mt-3">
                ✓ Custo real aplicado: {fiscalBreakdown.custoReal.toFixed(2)} (Produto + ICMS + IPI + Frete)
              </div>
            )}

            {custoNum > 0 && (
              <div className="border border-gold-muted rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowMarkup(!showMarkup)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gold/10"
                >
                  <div className="flex items-center gap-2">
                    <Calculator size={14} className="text-gold" />
                    <span className="text-xs font-semibold text-gold">Calculadora de Markup</span>
                  </div>
                  {showMarkup ? <ChevronUp size={14} className="text-gold" /> : <ChevronDown size={14} className="text-gold" />}
                </button>

                {showMarkup && (
                  <div className="px-4 py-3 space-y-3 bg-surface">
                    {/* Cenários rápidos */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">Cenários de Markup (sobre custo R$ {custoNum.toFixed(2)})</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {precosCenarios.map((c) => (
                          <button
                            key={c.nome}
                            onClick={() => setPrecoVenda(c.preco.toFixed(2))}
                            className="bg-surface-overlay border border-border rounded-lg px-2.5 py-2 text-left hover:border-gold-muted transition-colors"
                          >
                            <p className="text-[10px] text-muted-foreground">{c.nome}</p>
                            <p className="text-sm font-bold text-gold">R$ {c.preco.toFixed(2)}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preço calculado por fórmula */}
                    {precoCalculado && (
                      <div className="bg-gold/10 border border-gold-muted rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Preço sugerido (fórmula)</p>
                            <p className="text-lg font-bold text-gold">R$ {precoCalculado.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => setPrecoVenda(precoCalculado.toFixed(2))}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground"
                            style={{ background: "var(--gradient-gold)" }}
                          >
                            Usar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Parâmetros */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground font-semibold">Parâmetros</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["Impostos (%)", impostos, setImpostos],
                          ["Taxa Cartão (%)", taxaCartao, setTaxaCartao],
                          ["Margem Líquida (%)", margemLiquida, setMargemLiquida],
                          ["Rateio Oper. (R$)", rateioOperacional, setRateioOperacional],
                          ["Frete/un (R$)", fretePadrao, setFretePadrao],
                          ["Embalagem/un (R$)", embalagemPadrao, setEmbalagemPadrao],
                        ].map(([label, val, setter]) => (
                          <div key={label as string}>
                            <p className="text-[9px] text-muted-foreground mb-0.5">{label as string}</p>
                            <input
                              type="number"
                              step="0.01"
                              value={val as string}
                              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                              className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between bg-surface-overlay border border-border rounded-lg px-3 py-2">
                        <span className="text-xs text-foreground">Ajuste psicológico</span>
                        <button
                          onClick={() => setAjustePsicologico(!ajustePsicologico)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                            ajustePsicologico ? "bg-gold/20 text-gold" : "bg-surface border border-border text-muted-foreground"
                          }`}
                        >
                          {ajustePsicologico ? "SIM" : "NÃO"}
                        </button>
                      </div>

                      {ajustePsicologico && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">Centavos finais</p>
                            <input
                              type="number"
                              step="0.01"
                              value={centavosFinal}
                              onChange={(e) => setCentavosFinal(e.target.value)}
                              className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
                            />
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">Dígito final (0-9)</p>
                            <input
                              type="number"
                              min={0}
                              max={9}
                              value={digitoFinal}
                              onChange={(e) => setDigitoFinal(e.target.value)}
                              className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Estoque inicial por depósito */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Estoque inicial por depósito</label>
              <div className="grid grid-cols-3 gap-2">
                {[["Casa", estCasa, setEstCasa], ["Sumaúma", estSumauma, setEstSumauma], ["Amazonas", estAmazonas, setEstAmazonas]] .map(([label, val, setter]) => (
                  <div key={label as string}>
                    <p className="text-[10px] text-muted-foreground mb-1">{label as string}</p>
                    <input
                      type="number"
                      min="0"
                      value={val as string}
                      onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:border-gold-muted"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Estoque mínimo */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Estoque mínimo (alerta)</label>
              <input
                type="number"
                min="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
          </div>
        )}

        {tab === "casas" && (
          <div className="px-4 pt-4 space-y-5">
            {/* Adicionar nova casa */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Adicionar Casa</h3>

              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Tipo</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.entries(tiposPerfumeConfig) as [TipoPerfume, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNovaCasaTipo(key)}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                        novaCasaTipo === key
                          ? "bg-gold text-primary-foreground border-gold"
                          : "bg-surface-overlay border-border text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Nome da Casa</label>
                  <input
                    type="text"
                    placeholder="Ex: Parfums de Marly"
                    value={novaCasaNome}
                    onChange={(e) => setNovaCasaNome(e.target.value)}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Sigla (2-3)</label>
                  <input
                    type="text"
                    placeholder="PM"
                    maxLength={3}
                    value={novaCasaSigla}
                    onChange={(e) => setNovaCasaSigla(e.target.value.toUpperCase())}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-gold-muted"
                  />
                </div>
              </div>

              <button
                onClick={handleAdicionarCasa}
                disabled={!novaCasaNome || novaCasaSigla.length < 2}
                className="w-full py-2 rounded-xl bg-gold text-primary-foreground text-xs font-semibold disabled:opacity-40 transition-opacity"
              >
                <Plus size={12} className="inline mr-1" /> Adicionar Casa
              </button>
            </div>

            {/* Lista de casas por tipo */}
            {(Object.entries(tiposPerfumeConfig) as [TipoPerfume, string][]).map(([tipoKey, tipoLabel]) => {
              const lista = casas.filter((c) => c.tipo === tipoKey);
              if (lista.length === 0) return null;
              return (
                <div key={tipoKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded">{tipoKey}</span>
                    <span className="text-xs text-muted-foreground">{tipoLabel}</span>
                  </div>
                  <div className="space-y-1.5">
                    {lista.map((c) => (
                      <div
                        key={c.sigla}
                        className="flex items-center justify-between bg-surface border border-border rounded-xl px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold text-gold w-8">{c.sigla}</span>
                          <span className="text-sm text-foreground">{c.nome}</span>
                        </div>
                        <button
                          onClick={() => handleRemoverCasa(c.sigla)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer botão salvar (só na aba cadastrar) */}
      {tab === "cadastrar" && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-8 pt-4 border-t border-border bg-background max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!casaSelecionada || !nome || !custo || !precoVenda}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
            style={{ background: "var(--gradient-gold)", color: "hsl(0 0% 8%)" }}
          >
            Cadastrar Produto · {codigoPreview}
          </button>
        </div>
      )}

      {similares && (
        <SimilarProductsDialog
          candidates={similares}
          onRevisar={() => setSimilares(null)}
          onContinuar={async () => {
            setSimilares(null);
            await executarCadastro();
          }}
        />
      )}
    </div>
  );
}
