import { useState } from "react";
import { Plus, Settings, X } from "lucide-react";
import {
  gerarCodigo,
  type TipoPerfume,
  type Concentracao,
  type Perfume,
  type Casa,
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";

interface Props {
  onClose: () => void;
}

type Tab = "cadastrar" | "casas";

export default function CadastroPerfume({ onClose }: Props) {
  const { casas, setCasas, adicionarPerfume, proximaLinhaPorCasa, tiposPerfumeConfig, concentracoesConfig, volumesPadrao } = useApp();
  const [tab, setTab] = useState<Tab>("cadastrar");

  // --- Estado do formulário ---
  const [tipo, setTipo] = useState<TipoPerfume>("NI");
  const [casaSelecionada, setCasaSelecionada] = useState<Casa | null>(null);
  const [concentracao, setConcentracao] = useState<Concentracao>("EDP");
  const [volume, setVolume] = useState<number>(100);
  const [volumeCustom, setVolumeCustom] = useState(false);
  const [nome, setNome] = useState("");
  const [custo, setCusto] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("2");
  const [estCasa, setEstCasa] = useState("0");
  const [estSumauma, setEstSumauma] = useState("0");
  const [estAmazonas, setEstAmazonas] = useState("0");

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

  const handleSubmit = () => {
    if (!casaSelecionada || !nome || !custo || !precoVenda) return;
    const novoPerfume: Perfume = {
      id: `p${Date.now()}`,
      codigo: gerarCodigo(tipo, casaSelecionada.sigla, concentracao, linhaCasa, volume),
      nome,
      marca: casaSelecionada.nome,
      casaSigla: casaSelecionada.sigla,
      tipo,
      concentracao,
      tamanho: `${volume}ml`,
      volume,
      custo: parseFloat(custo),
      precoVenda: parseFloat(precoVenda),
      estoques: {
        Casa: parseInt(estCasa) || 0,
        Sumaúma: parseInt(estSumauma) || 0,
        Amazonas: parseInt(estAmazonas) || 0,
      },
      estoqueMinimo: parseInt(estoqueMinimo) || 2,
    };
    adicionarPerfume(novoPerfume);
    onClose();
  };

  const handleAdicionarCasa = () => {
    if (!novaCasaNome || novaCasaSigla.length < 2) return;
    const nova: Casa = {
      sigla: novaCasaSigla.toUpperCase().slice(0, 3),
      nome: novaCasaNome,
      tipo: novaCasaTipo,
    };
    setCasas((prev) => [...prev, nova]);
    setNovaCasaNome("");
    setNovaCasaSigla("");
  };

  const handleRemoverCasa = (sigla: string) => {
    setCasas((prev) => prev.filter((c) => c.sigla !== sigla));
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
                  {(Object.entries(tiposPerfumeConfig) as [TipoPerfume, string][]).map(([key, _label]) => (
                    <button
                      key={key}
                      onClick={() => setNovaCasaTipo(key)}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                        novaCasaTipo === key
                          ? "bg-gold text-primary-foreground border-gold"
                          : "bg-surface-overlay border-border text-muted-foreground"
                      }`}
                    >
                      {key}
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
    </div>
  );
}
