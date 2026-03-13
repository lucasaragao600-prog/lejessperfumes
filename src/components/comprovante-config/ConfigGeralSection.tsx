import { Switch } from "@/components/ui/switch";
import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
}

export default function ConfigGeralSection({ config, onChange }: Props) {
  const update = (partial: Partial<ComprovanteConfig>) => onChange({ ...config, ...partial });

  return (
    <section className="card-premium p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Configurações Gerais</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Formato, papel e alinhamento</p>
      </div>

      {/* Impressão automática */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground font-medium">Impressão automática</span>
          <p className="text-[10px] text-muted-foreground">Imprimir ao finalizar venda</p>
        </div>
        <Switch checked={config.impressaoAutomatica} onCheckedChange={(v) => update({ impressaoAutomatica: v })} />
      </div>

      {/* Tipo de comprovante */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Comprovante</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {([
            ["recibo", "Recibo Simples"],
            ["cupom_fiscal", "Cupom Fiscal"],
            ["nota_venda", "Nota de Venda"],
            ["ordem_servico", "Ordem de Serviço"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update({ tipoComprovante: val })}
              className={`text-xs px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                config.tipoComprovante === val
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "bg-surface-overlay border-border text-muted-foreground hover:border-gold/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Formato do papel */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato do Papel</label>
        <div className="flex gap-2 mt-2">
          {(["58mm", "80mm", "A4"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => update({ formatoPapel: fmt })}
              className={`text-xs px-4 py-2.5 rounded-xl border transition-all duration-150 flex-1 ${
                config.formatoPapel === fmt
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "bg-surface-overlay border-border text-muted-foreground hover:border-gold/40"
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Margens */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Margens (mm)</label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <div key={side}>
              <label className="text-[9px] text-muted-foreground capitalize">{side === "top" ? "Superior" : side === "bottom" ? "Inferior" : side === "left" ? "Esquerda" : "Direita"}</label>
              <input
                type="number"
                min={0}
                max={20}
                value={config.margens[side]}
                onChange={(e) => update({ margens: { ...config.margens, [side]: Number(e.target.value) } })}
                className="input-premium w-full px-2 py-1.5 text-xs mt-0.5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Espaçamento entre linhas */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Espaçamento entre linhas</label>
        <input
          type="number"
          step={0.1}
          min={1}
          max={3}
          value={config.espacamentoLinhas}
          onChange={(e) => update({ espacamentoLinhas: Number(e.target.value) })}
          className="input-premium w-full px-3 py-2 text-xs mt-1"
        />
      </div>

      {/* Alinhamento padrão */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Alinhamento Padrão</label>
        <div className="flex gap-2 mt-2">
          {([["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update({ alinhamentoPadrao: val })}
              className={`text-xs px-4 py-2 rounded-xl border flex-1 transition-all duration-150 ${
                config.alinhamentoPadrao === val
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "bg-surface-overlay border-border text-muted-foreground hover:border-gold/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
