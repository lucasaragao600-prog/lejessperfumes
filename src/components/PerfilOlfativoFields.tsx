import { useState } from "react";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sugerirPerfil } from "@/lib/perfilOlfativoIA";

interface Props {
  perfilOlfativo: string;
  notasSaida: string;
  notasCoracao: string;
  notasFundo: string;
  onPerfilChange: (v: string) => void;
  onSaidaChange: (v: string) => void;
  onCoracaoChange: (v: string) => void;
  onFundoChange: (v: string) => void;
  produto?: { marca: string; nome: string; concentracao?: string };
}

export const FAMILIAS_OLFATIVAS = [
  "Amadeirado",
  "Floral",
  "Cítrico",
  "Oriental",
  "Gourmand",
  "Aromático",
  "Frutal",
  "Chipre",
  "Fougère",
  "Aquático",
  "Especiado",
  "Almiscarado",
];

export default function PerfilOlfativoFields({
  perfilOlfativo,
  notasSaida,
  notasCoracao,
  notasFundo,
  onPerfilChange,
  onSaidaChange,
  onCoracaoChange,
  onFundoChange,
  produto,
}: Props) {
  const [carregando, setCarregando] = useState(false);
  const preencher = async () => {
    if (!produto?.nome?.trim()) return toast.error("Informe a marca e o nome do perfume primeiro.");
    setCarregando(true);
    try {
      const r = await sugerirPerfil(produto.marca, produto.nome, produto.concentracao);
      if (!r || r.confianca === "baixa" || !(r.familia || r.saida || r.coracao || r.fundo)) {
        toast.info("A IA não reconheceu este perfume com segurança. Preencha manualmente.");
        return;
      }
      onPerfilChange(r.familia); onSaidaChange(r.saida); onCoracaoChange(r.coracao); onFundoChange(r.fundo);
      toast.success("Perfil preenchido. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCarregando(false); }
  };
  return (
    <div className="space-y-4 border border-gold-muted/40 rounded-xl p-4 bg-gold/5">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        <h3 className="text-xs font-semibold text-gold">Perfil Olfativo</h3>
        {produto && (
          <button type="button" onClick={preencher} disabled={carregando}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium border border-gold-muted text-gold hover:bg-gold/10 disabled:opacity-50">
            {carregando ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {carregando ? "Buscando…" : "Preencher com IA"}
          </button>
        )}
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground mb-1.5 block">
          Família Olfativa
        </label>
        <input
          type="text"
          list="familias-olfativas"
          placeholder="Ex: Amadeirado Especiado"
          value={perfilOlfativo}
          onChange={(e) => onPerfilChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
        />
        <datalist id="familias-olfativas">
          {FAMILIAS_OLFATIVAS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-1 mt-2">
          {FAMILIAS_OLFATIVAS.slice(0, 6).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onPerfilChange(f)}
              className={`px-2 py-0.5 rounded-full text-[9px] border transition-all ${
                perfilOlfativo === f
                  ? "bg-gold text-primary-foreground border-gold"
                  : "bg-surface border-border text-muted-foreground hover:border-gold-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground mb-1.5 block">
          Notas de Saída <span className="text-muted-foreground/60">(topo)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Ex: Bergamota, Limão Siciliano, Pimenta Rosa"
          value={notasSaida}
          onChange={(e) => onSaidaChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground mb-1.5 block">
          Notas de Coração <span className="text-muted-foreground/60">(meio)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Ex: Jasmim, Rosa Búlgara, Íris"
          value={notasCoracao}
          onChange={(e) => onCoracaoChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground mb-1.5 block">
          Notas de Fundo <span className="text-muted-foreground/60">(base)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Ex: Sândalo, Âmbar, Baunilha, Almíscar"
          value={notasFundo}
          onChange={(e) => onFundoChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted resize-none"
        />
      </div>

      <p className="text-[9px] text-muted-foreground italic">
        Separe as notas por vírgula. Estes campos são opcionais. Se ficarem vazios, a IA tenta preencher sozinha depois de salvar.
      </p>
    </div>
  );
}
