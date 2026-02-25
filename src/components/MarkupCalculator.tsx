import { useState, useMemo } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  custo: number;
  precoVenda: string;
  onPrecoChange: (preco: string) => void;
}

export default function MarkupCalculator({ custo, precoVenda, onPrecoChange }: Props) {
  const [showMarkup, setShowMarkup] = useState(false);
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

  const precoCalculado = useMemo(() => {
    if (!custo) return null;
    const imp = parseFloat(impostos) / 100 || 0;
    const taxa = parseFloat(taxaCartao) / 100 || 0;
    const margem = parseFloat(margemLiquida) / 100 || 0;
    const rateio = parseFloat(rateioOperacional) || 0;
    const frete = parseFloat(fretePadrao) || 0;
    const embalagem = parseFloat(embalagemPadrao) || 0;

    const custoTotal = custo + rateio + frete + embalagem;
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
  }, [custo, impostos, taxaCartao, margemLiquida, rateioOperacional, fretePadrao, embalagemPadrao, ajustePsicologico, centavosFinal, digitoFinal]);

  const precosCenarios = useMemo(() => {
    if (!custo) return [];
    return cenarios.map((c) => {
      let preco = custo * c.mult;
      if (ajustePsicologico) {
        const centavos = parseFloat(centavosFinal) || 0;
        const digito = parseInt(digitoFinal) || 9;
        const inteiro = Math.ceil(preco / 10) * 10 - (10 - digito);
        preco = inteiro + centavos;
      }
      return { ...c, preco };
    });
  }, [custo, ajustePsicologico, centavosFinal, digitoFinal]);

  if (custo <= 0) return null;

  return (
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
            <p className="text-[10px] text-muted-foreground mb-1.5">Cenários de Markup (sobre custo R$ {custo.toFixed(2)})</p>
            <div className="grid grid-cols-2 gap-1.5">
              {precosCenarios.map((c) => (
                <button
                  key={c.nome}
                  onClick={() => onPrecoChange(c.preco.toFixed(2))}
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
                  onClick={() => onPrecoChange(precoCalculado.toFixed(2))}
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
  );
}
