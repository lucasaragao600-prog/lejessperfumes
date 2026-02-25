import { useState, useMemo } from "react";
import { X, Check } from "lucide-react";
import MarkupCalculator from "@/components/MarkupCalculator";
import {
  gerarCodigo,
  type TipoPerfume,
  type Concentracao,
  type Perfume,
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";

interface Props {
  perfume: Perfume;
  onClose: () => void;
}

export default function EditarPerfume({ perfume, onClose }: Props) {
  const { casas, editarPerfume, proximaLinhaPorCasa, tiposPerfumeConfig, concentracoesConfig, volumesPadrao } = useApp();

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

  const casasFiltradas = casas.filter((c) => c.tipo === tipo);
  const casaSelecionada = casas.find((c) => c.sigla === casaSigla) || null;

  // Recalculate code based on current selections
  const linhaPorCasa = useMemo(() => {
    // Keep the same line number if casa didn't change
    if (casaSigla === perfume.casaSigla) {
      // Extract line from original code
      const code = perfume.codigo;
      return parseInt(code.slice(6, 10)) || 1;
    }
    return proximaLinhaPorCasa(casaSigla);
  }, [casaSigla, perfume.casaSigla, perfume.codigo, proximaLinhaPorCasa]);

  const codigoPreview = casaSelecionada
    ? gerarCodigo(tipo, casaSigla, concentracao, linhaPorCasa, volume)
    : "——";

  const handleSubmit = async () => {
    if (!casaSelecionada || !nome || !custo || !precoVenda) return;
    setSalvando(true);
    try {
      await editarPerfume({
        id: perfume.id,
        nome,
        marca: casaSelecionada.nome,
        casaSigla,
        tipo,
        concentracao,
        tamanho: `${volume}ml`,
        volume,
        custo: parseFloat(custo),
        precoVenda: parseFloat(precoVenda),
        estoqueMinimo: parseInt(estoqueMinimo) || 2,
        codigo: codigoPreview,
      });
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

      <div className="flex-1 overflow-y-auto pb-32">
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

          <div className="border-t border-border" />

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
