import { useState, useMemo, useEffect } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/data/mockData";

export interface FiscalBreakdown {
  precoUnitario: number;
  aliquotaIcms: number; // %
  aliquotaIpi: number; // %
  freteUnit: number;   // R$ por unidade
  outrosUnit: number;  // R$ por unidade
  descontoUnit: number; // R$ por unidade
  valorIcmsUnit: number;
  valorIpiUnit: number;
  custoReal: number;
}

interface Props {
  precoUnitario: number;
  onApply: (breakdown: FiscalBreakdown) => void;
  /** Inicia aberto */
  defaultOpen?: boolean;
}

/**
 * Calcula custo real automaticamente a partir do preço unitário + ICMS% + IPI% + frete.
 * Fórmula: custoReal = preço + (preço * ICMS%) + (preço * IPI%) + frete + outros - desconto
 */
export default function FiscalCostCalculator({ precoUnitario, onApply, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [icms, setIcms] = useState("0");
  const [ipi, setIpi] = useState("0");
  const [frete, setFrete] = useState("0");
  const [outros, setOutros] = useState("0");
  const [desconto, setDesconto] = useState("0");

  const calc = useMemo<FiscalBreakdown>(() => {
    const p = Number(precoUnitario) || 0;
    const aIcms = parseFloat(icms) || 0;
    const aIpi = parseFloat(ipi) || 0;
    const fr = parseFloat(frete) || 0;
    const ot = parseFloat(outros) || 0;
    const dc = parseFloat(desconto) || 0;
    const vIcms = +(p * (aIcms / 100)).toFixed(4);
    const vIpi = +(p * (aIpi / 100)).toFixed(4);
    const real = +(p + vIcms + vIpi + fr + ot - dc).toFixed(4);
    return {
      precoUnitario: p,
      aliquotaIcms: aIcms,
      aliquotaIpi: aIpi,
      freteUnit: fr,
      outrosUnit: ot,
      descontoUnit: dc,
      valorIcmsUnit: vIcms,
      valorIpiUnit: vIpi,
      custoReal: real,
    };
  }, [precoUnitario, icms, ipi, frete, outros, desconto]);

  const hasAdjustments = calc.aliquotaIcms || calc.aliquotaIpi || calc.freteUnit || calc.outrosUnit || calc.descontoUnit;

  return (
    <div className="border border-gold-muted rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gold/10"
      >
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-gold" />
          <span className="text-xs font-semibold text-gold">Calcular Custo Real (ICMS · IPI · Frete)</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gold" /> : <ChevronDown size={14} className="text-gold" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3 bg-surface">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">ICMS (%)</p>
              <input
                type="number"
                step="0.01"
                value={icms}
                onChange={(e) => setIcms(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">IPI (%)</p>
              <input
                type="number"
                step="0.01"
                value={ipi}
                onChange={(e) => setIpi(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Frete/un (R$)</p>
              <input
                type="number"
                step="0.01"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Outros/un (R$)</p>
              <input
                type="number"
                step="0.01"
                value={outros}
                onChange={(e) => setOutros(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Desconto/un (R$)</p>
              <input
                type="number"
                step="0.01"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
          </div>

          {/* Discriminação */}
          <div className="bg-surface-overlay border border-border rounded-lg p-3 space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Discriminação por unidade</p>
            <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Preço produto</span><span className="text-foreground">{formatCurrency(calc.precoUnitario)}</span></div>
            {calc.valorIcmsUnit > 0 && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">ICMS ({calc.aliquotaIcms}%)</span><span className="text-foreground">{formatCurrency(calc.valorIcmsUnit)}</span></div>}
            {calc.valorIpiUnit > 0 && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">IPI ({calc.aliquotaIpi}%)</span><span className="text-foreground">{formatCurrency(calc.valorIpiUnit)}</span></div>}
            {calc.freteUnit > 0 && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Frete</span><span className="text-foreground">{formatCurrency(calc.freteUnit)}</span></div>}
            {calc.outrosUnit > 0 && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Outros</span><span className="text-foreground">{formatCurrency(calc.outrosUnit)}</span></div>}
            {calc.descontoUnit > 0 && <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">- Desconto</span><span className="text-foreground">- {formatCurrency(calc.descontoUnit)}</span></div>}
            <div className="border-t border-border my-1" />
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-foreground">Custo Real</span>
              <span className="text-gold">{formatCurrency(calc.custoReal)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!hasAdjustments}
            onClick={() => onApply(calc)}
            className="w-full py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40"
            style={{ background: "var(--gradient-gold)" }}
          >
            Aplicar como custo
          </button>
        </div>
      )}
    </div>
  );
}
