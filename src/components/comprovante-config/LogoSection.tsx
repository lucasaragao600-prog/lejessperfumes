import { Switch } from "@/components/ui/switch";
import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
  logoUrl?: string;
}

export default function LogoSection({ config, onChange, logoUrl }: Props) {
  const update = (partial: Partial<ComprovanteConfig>) => onChange({ ...config, ...partial });

  return (
    <section className="card-premium p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Logo no Comprovante</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Ajuste dimensões e alinhamento da logo</p>
      </div>

      {logoUrl ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-16 rounded-lg border border-border bg-surface-overlay flex items-center justify-center overflow-hidden">
            <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" style={{ filter: config.logoMono ? "grayscale(1) contrast(2)" : "none" }} />
          </div>
          <p className="text-[10px] text-muted-foreground">Logo carregada dos dados da empresa</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhuma logo cadastrada. Faça upload na seção "Dados da Empresa".</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] text-muted-foreground uppercase">Largura (%)</label>
          <input type="number" min={10} max={100} value={config.logoLargura} onChange={(e) => update({ logoLargura: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5" />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase">Altura máx (px)</label>
          <input type="number" min={20} max={200} value={config.logoAltura} onChange={(e) => update({ logoAltura: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Alinhamento</label>
        <div className="flex gap-2 mt-1.5">
          {([["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => update({ logoAlinhamento: val })}
              className={`text-xs px-3 py-2 rounded-xl border flex-1 transition-all duration-150 ${
                config.logoAlinhamento === val
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "bg-surface-overlay border-border text-muted-foreground hover:border-gold/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground font-medium">Modo monocromático</span>
          <p className="text-[10px] text-muted-foreground">Converter para preto e branco (impressora térmica)</p>
        </div>
        <Switch checked={config.logoMono} onCheckedChange={(v) => update({ logoMono: v })} />
      </div>
    </section>
  );
}
