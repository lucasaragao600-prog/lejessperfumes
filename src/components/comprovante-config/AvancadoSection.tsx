import { Switch } from "@/components/ui/switch";
import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
}

export default function AvancadoSection({ config, onChange }: Props) {
  const update = (partial: Partial<ComprovanteConfig>) => onChange({ ...config, ...partial });

  return (
    <section className="card-premium p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Configurações Avançadas</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Impressora térmica e hardware</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-foreground font-medium">Cortar papel automaticamente</span>
            <p className="text-[10px] text-muted-foreground">Enviar comando de corte após impressão</p>
          </div>
          <Switch checked={config.cortarPapel} onCheckedChange={(v) => update({ cortarPapel: v })} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-foreground font-medium">Abrir gaveta de dinheiro</span>
            <p className="text-[10px] text-muted-foreground">Abrir gaveta ao registrar venda</p>
          </div>
          <Switch checked={config.abrirGaveta} onCheckedChange={(v) => update({ abrirGaveta: v })} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase">Densidade</label>
            <select value={config.densidadeImpressao} onChange={(e) => update({ densidadeImpressao: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5">
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} - {v <= 2 ? "Leve" : v <= 3 ? "Normal" : "Forte"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase">Velocidade</label>
            <select value={config.velocidadeImpressao} onChange={(e) => update({ velocidadeImpressao: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5">
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} - {v <= 2 ? "Lenta" : v <= 3 ? "Normal" : "Rápida"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase">Codificação</label>
            <select value={config.codificacao} onChange={(e) => update({ codificacao: e.target.value })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5">
              <option value="UTF-8">UTF-8</option>
              <option value="ISO-8859-1">ISO-8859-1</option>
              <option value="CP850">CP850</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
