import { useState } from "react";
import { GripVertical, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ComprovanteConfig, BlocoComprovante } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
}

export default function BlocosLayoutSection({ config, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateBlocos = (blocos: BlocoComprovante[]) => onChange({ ...config, blocos });

  const updateBloco = (id: string, partial: Partial<BlocoComprovante>) => {
    updateBlocos(config.blocos.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const moveBloco = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= config.blocos.length) return;
    const arr = [...config.blocos];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    updateBlocos(arr);
  };

  return (
    <section className="card-premium p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Layout em Blocos</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Arraste e configure cada bloco do comprovante</p>
      </div>

      <div className="space-y-1.5">
        {config.blocos.map((bloco, idx) => (
          <div key={bloco.id} className={`rounded-xl border transition-all duration-150 ${bloco.ativo ? "border-border bg-surface-overlay" : "border-border/50 bg-surface-overlay/50 opacity-60"}`}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveBloco(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-gold disabled:opacity-20 transition-colors">
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveBloco(idx, 1)} disabled={idx === config.blocos.length - 1} className="text-muted-foreground hover:text-gold disabled:opacity-20 transition-colors">
                  <ChevronDown size={12} />
                </button>
              </div>
              <GripVertical size={14} className="text-muted-foreground/50 flex-shrink-0" />
              <span className="text-xs font-medium text-foreground flex-1">{bloco.label}</span>
              <Switch checked={bloco.ativo} onCheckedChange={(v) => updateBloco(bloco.id, { ativo: v })} />
              <button onClick={() => setExpandedId(expandedId === bloco.id ? null : bloco.id)} className="text-muted-foreground hover:text-gold transition-colors p-1">
                {expandedId === bloco.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Expanded settings */}
            {expandedId === bloco.id && (
              <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
                {/* Alinhamento */}
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase">Alinhamento</label>
                  <div className="flex gap-1.5 mt-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => updateBloco(bloco.id, { alinhamento: a })}
                        className={`text-[10px] px-3 py-1 rounded-lg border flex-1 transition-all ${
                          bloco.alinhamento === a ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                        }`}
                      >
                        {a === "left" ? "Esq" : a === "center" ? "Centro" : "Dir"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Tamanho fonte</label>
                    <input type="number" min={8} max={36} value={bloco.fontSize} onChange={(e) => updateBloco(bloco.id, { fontSize: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase">Espaçamento</label>
                    <input type="number" min={0} max={20} value={bloco.espacamento} onChange={(e) => updateBloco(bloco.id, { espacamento: Number(e.target.value) })} className="input-premium w-full px-2 py-1.5 text-xs mt-0.5" />
                  </div>
                </div>

                {/* Style toggles */}
                <div className="flex gap-1.5">
                  {([
                    ["fontWeight", "bold", "B", bloco.fontWeight === "bold"],
                    ["italic", true, "I", bloco.italic],
                    ["underline", true, "U", bloco.underline],
                    ["uppercase", true, "AA", bloco.uppercase],
                  ] as const).map(([key, val, label, active]) => (
                    <button
                      key={label}
                      onClick={() => {
                        if (key === "fontWeight") updateBloco(bloco.id, { fontWeight: bloco.fontWeight === "bold" ? "normal" : "bold" });
                        else updateBloco(bloco.id, { [key]: !active } as any);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all ${
                        active ? "bg-primary text-primary-foreground border-primary font-bold" : "border-border text-muted-foreground"
                      }`}
                      style={{ fontStyle: label === "I" ? "italic" : undefined, textDecoration: label === "U" ? "underline" : undefined }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
