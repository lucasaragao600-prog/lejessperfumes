import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
}

const FONT_FAMILIES = [
  { value: "Courier New", label: "Courier New (Térmica)" },
  { value: "Roboto", label: "Roboto" },
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
];

const PROFILE_LABELS: Record<string, string> = {
  cabecalho: "Cabeçalho",
  corpo: "Corpo",
  total: "Total",
  rodape: "Rodapé",
};

export default function FontesSection({ config, onChange }: Props) {
  const update = (partial: Partial<ComprovanteConfig>) => onChange({ ...config, ...partial });

  const updateProfile = (key: string, field: string, value: number | string) => {
    update({
      fontProfiles: {
        ...config.fontProfiles,
        [key]: { ...(config.fontProfiles as any)[key], [field]: value },
      },
    });
  };

  return (
    <section className="card-premium p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Fontes</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Família e perfis de fonte</p>
      </div>

      {/* Font family */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Família de Fonte</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.value}
              onClick={() => update({ fontFamily: f.value })}
              className={`text-xs px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                config.fontFamily === f.value
                  ? "bg-primary text-primary-foreground border-primary font-bold"
                  : "bg-surface-overlay border-border text-muted-foreground hover:border-gold/40"
              }`}
              style={{ fontFamily: f.value }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font profiles */}
      <div className="space-y-3">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Perfis de Fonte</label>
        {Object.entries(PROFILE_LABELS).map(([key, label]) => {
          const profile = (config.fontProfiles as any)[key];
          return (
            <div key={key} className="bg-surface-overlay rounded-xl border border-border p-3 space-y-2">
              <span className="text-xs font-semibold text-gold">{label}</span>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground">Tamanho</label>
                  <input type="number" min={8} max={36} value={profile.size} onChange={(e) => updateProfile(key, "size", Number(e.target.value))} className="input-premium w-full px-2 py-1 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">Peso</label>
                  <select value={profile.weight} onChange={(e) => updateProfile(key, "weight", e.target.value)} className="input-premium w-full px-1 py-1 text-xs mt-0.5">
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">Letras</label>
                  <input type="number" step={0.1} min={0} max={5} value={profile.letterSpacing} onChange={(e) => updateProfile(key, "letterSpacing", Number(e.target.value))} className="input-premium w-full px-2 py-1 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">Altura</label>
                  <input type="number" step={0.1} min={1} max={3} value={profile.lineHeight} onChange={(e) => updateProfile(key, "lineHeight", Number(e.target.value))} className="input-premium w-full px-2 py-1 text-xs mt-0.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
