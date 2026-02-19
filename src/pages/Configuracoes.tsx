import { useState } from "react";
import { Settings, Plus, Trash2, RotateCcw, Users } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { TipoPerfume, Concentracao } from "@/data/mockData";

export default function Configuracoes() {
  const {
    tiposPerfumeConfig, setTiposPerfumeConfig,
    concentracoesConfig, setConcentracoesConfig,
    volumesPadrao, setVolumesPadrao,
    vendedoras,
    adicionarVendedoraDB, removerVendedoraDB,
  } = useApp();

  const [novoTipoSigla, setNovoTipoSigla] = useState("");
  const [novoTipoLabel, setNovoTipoLabel] = useState("");
  const [novaConcentSigla, setNovaConcentSigla] = useState("");
  const [novaConcentLabel, setNovaConcentLabel] = useState("");
  const [novoVolume, setNovoVolume] = useState("");
  const [novaVendedora, setNovaVendedora] = useState("");

  const handleAddTipo = () => {
    const sigla = novoTipoSigla.toUpperCase().slice(0, 3).trim();
    if (!sigla || !novoTipoLabel.trim() || tiposPerfumeConfig[sigla as TipoPerfume]) return;
    setTiposPerfumeConfig((prev) => ({ ...prev, [sigla]: novoTipoLabel.trim() }));
    setNovoTipoSigla("");
    setNovoTipoLabel("");
  };

  const handleRemoveTipo = (sigla: string) => {
    setTiposPerfumeConfig((prev) => {
      const next = { ...prev };
      delete next[sigla as TipoPerfume];
      return next;
    });
  };

  const handleAddConcent = () => {
    const sigla = novaConcentSigla.toUpperCase().slice(0, 4).trim();
    if (!sigla || !novaConcentLabel.trim() || concentracoesConfig[sigla as Concentracao]) return;
    setConcentracoesConfig((prev) => ({ ...prev, [sigla]: novaConcentLabel.trim() }));
    setNovaConcentSigla("");
    setNovaConcentLabel("");
  };

  const handleRemoveConcent = (sigla: string) => {
    setConcentracoesConfig((prev) => {
      const next = { ...prev };
      delete next[sigla as Concentracao];
      return next;
    });
  };

  const handleAddVolume = () => {
    const vol = parseInt(novoVolume);
    if (!vol || vol <= 0 || volumesPadrao.includes(vol)) return;
    setVolumesPadrao((prev) => [...prev, vol].sort((a, b) => a - b));
    setNovoVolume("");
  };

  const handleRemoveVolume = (vol: number) => {
    setVolumesPadrao((prev) => prev.filter((v) => v !== vol));
  };

  const handleResetTipos = () => {
    setTiposPerfumeConfig({ AR: "Árabe", NI: "Nicho", NA: "Nacional", KI: "Kit" });
  };

  const handleResetConcentracoes = () => {
    setConcentracoesConfig({
      EDP: "EDP – Eau de Parfum",
      EDT: "EDT – Eau de Toilette",
      PAR: "Parfum / Extrait",
      OUT: "Outro",
    });
  };

  const handleResetVolumes = () => {
    setVolumesPadrao([30, 50, 75, 100, 150, 200, 250]);
  };

  const handleAddVendedora = async () => {
    const nome = novaVendedora.trim();
    if (!nome || vendedoras.includes(nome)) return;
    await adicionarVendedoraDB(nome);
    setNovaVendedora("");
  };

  const handleRemoveVendedora = async (nome: string) => {
    await removerVendedoraDB(nome);
  };

  const handleResetVendedoras = async () => {
    // Remove all and re-add defaults
    for (const v of vendedoras) {
      await removerVendedoraDB(v);
    }
    for (const v of ["Ana", "Julia", "Carla"]) {
      await adicionarVendedoraDB(v);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center gap-3 mb-1">
          <Settings size={20} className="text-gold" />
          <h1 className="font-display text-2xl text-gold">Configurações</h1>
        </div>
        <p className="text-muted-foreground text-xs">Personalize os tipos, concentrações e volumes do sistema de códigos</p>
      </div>

      <div className="px-4 space-y-6">

        {/* Tipos de Perfume */}
        <section className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tipos de Perfume (TT)</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Usado no início do código e como categoria</p>
            </div>
            <button onClick={handleResetTipos} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-gold transition-colors">
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>

          <div className="space-y-2">
            {Object.entries(tiposPerfumeConfig).map(([sigla, label]) => (
              <div key={sigla} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-gold w-8">{sigla}</span>
                  <span className="text-sm text-foreground">{String(label)}</span>
                </div>
                <button onClick={() => handleRemoveTipo(sigla)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Sigla (ex: LX)"
              maxLength={3}
              value={novoTipoSigla}
              onChange={(e) => setNovoTipoSigla(e.target.value.toUpperCase())}
              className="w-20 bg-surface-overlay border border-border rounded-lg px-2 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-gold-muted"
            />
            <input
              type="text"
              placeholder="Nome (ex: Luxo)"
              value={novoTipoLabel}
              onChange={(e) => setNovoTipoLabel(e.target.value)}
              className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
            />
            <button
              onClick={handleAddTipo}
              disabled={!novoTipoSigla || !novoTipoLabel}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </section>

        {/* Concentrações */}
        <section className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Concentrações (CC)</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Tipo de concentração do perfume</p>
            </div>
            <button onClick={handleResetConcentracoes} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-gold transition-colors">
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>

          <div className="space-y-2">
            {Object.entries(concentracoesConfig).map(([sigla, label]) => (
              <div key={sigla} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-gold w-10">{sigla}</span>
                  <span className="text-xs text-foreground">{String(label)}</span>
                </div>
                <button onClick={() => handleRemoveConcent(sigla)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Sigla (ex: COL)"
              maxLength={4}
              value={novaConcentSigla}
              onChange={(e) => setNovaConcentSigla(e.target.value.toUpperCase())}
              className="w-20 bg-surface-overlay border border-border rounded-lg px-2 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-gold-muted"
            />
            <input
              type="text"
              placeholder="Descrição (ex: Cologne)"
              value={novaConcentLabel}
              onChange={(e) => setNovaConcentLabel(e.target.value)}
              className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
            />
            <button
              onClick={handleAddConcent}
              disabled={!novaConcentSigla || !novaConcentLabel}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </section>

        {/* Volumes Padrão */}
        <section className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Volumes Padrão (VVV)</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Volumes em ml disponíveis no cadastro</p>
            </div>
            <button onClick={handleResetVolumes} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-gold transition-colors">
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {volumesPadrao.map((v) => (
              <div key={v} className="flex items-center gap-1 bg-surface-overlay border border-border rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-mono text-foreground">{v}ml</span>
                <button onClick={() => handleRemoveVolume(v)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Volume em ml"
              min={1}
              value={novoVolume}
              onChange={(e) => setNovoVolume(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVolume()}
              className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
            />
            <button
              onClick={handleAddVolume}
              disabled={!novoVolume}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </section>

        {/* Vendedoras */}
        <section className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users size={14} /> Vendedoras
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Equipe de vendas disponível no lançamento</p>
            </div>
            <button onClick={handleResetVendedoras} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-gold transition-colors">
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {vendedoras.map((v) => (
              <div key={v} className="flex items-center gap-1 bg-surface-overlay border border-border rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-foreground">{v}</span>
                <button onClick={() => handleRemoveVendedora(v)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome da vendedora"
              value={novaVendedora}
              onChange={(e) => setNovaVendedora(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVendedora()}
              className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
            />
            <button
              onClick={handleAddVendedora}
              disabled={!novaVendedora.trim()}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </section>

        {/* Info código */}
        <section className="bg-gold/5 border border-gold-muted rounded-xl p-4">
          <p className="text-[10px] text-gold font-mono font-bold mb-2 tracking-widest">FORMATO DO CÓDIGO</p>
          <p className="font-mono text-lg text-foreground font-bold tracking-wider mb-1">TT · MM · CC · LLLL · VVV</p>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {[
              ["TT", "Tipo de Perfume (ex: NI, AR)"],
              ["MM", "Sigla da Marca / Casa"],
              ["CC", "Concentração (ex: EDP, PAR)"],
              ["LLLL", "Linha sequencial por casa"],
              ["VVV", "Volume em ml (ex: 100)"],
            ].map(([code, desc]) => (
              <div key={code} className="flex items-start gap-2">
                <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded flex-shrink-0">{code}</span>
                <span className="text-[10px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
