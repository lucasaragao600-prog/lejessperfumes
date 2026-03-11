import { useState, useEffect } from "react";
import { Settings, Plus, Trash2, RotateCcw, Users, Building2, Save, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { TipoPerfume, Concentracao } from "@/data/mockData";
import { useConfiguracoesFiscais, type ConfiguracaoFiscal } from "@/hooks/useConfiguracoesFiscais";
import { toast } from "sonner";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function Configuracoes() {
  const {
    tiposPerfumeConfig, setTiposPerfumeConfig,
    concentracoesConfig, setConcentracoesConfig,
    volumesPadrao, setVolumesPadrao,
    vendedoras,
    adicionarVendedoraDB, removerVendedoraDB,
  } = useApp();

  const { configFiscal, salvarConfigFiscal } = useConfiguracoesFiscais();
  const [isSaving, setIsSaving] = useState(false);
  const [empresa, setEmpresa] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
    endereco: "", numero: "", bairro: "", cidade: "", uf: "AM", cep: "", telefone: "",
    regimeTributario: "simples_nacional" as string,
    ambiente: "homologacao" as "homologacao" | "producao",
    serieNfce: 1, proximoNumeroNfce: 1, cscId: "", cscToken: "",
  });

  useEffect(() => {
    if (configFiscal) {
      setEmpresa({
        razaoSocial: configFiscal.razaoSocial,
        nomeFantasia: configFiscal.nomeFantasia,
        cnpj: configFiscal.cnpj,
        inscricaoEstadual: configFiscal.inscricaoEstadual,
        endereco: configFiscal.endereco,
        numero: configFiscal.numero,
        bairro: configFiscal.bairro,
        cidade: configFiscal.cidade,
        uf: configFiscal.uf,
        cep: configFiscal.cep,
        telefone: configFiscal.telefone,
        regimeTributario: configFiscal.regimeTributario,
        ambiente: configFiscal.ambiente,
        serieNfce: configFiscal.serieNfce,
        proximoNumeroNfce: configFiscal.proximoNumeroNfce,
        cscId: configFiscal.cscId,
        cscToken: configFiscal.cscToken,
      });
    }
  }, [configFiscal]);

  const handleSalvarEmpresa = async () => {
    if (!empresa.razaoSocial.trim() || !empresa.cnpj.trim()) {
      toast.error("Razão Social e CNPJ são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      await salvarConfigFiscal.mutateAsync(empresa);
      toast.success("Dados da empresa salvos com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar dados da empresa");
    } finally {
      setIsSaving(false);
    }
  };

  const novoTipoSigla_init = "";
  const novoTipoLabel_init = "";

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
    for (const v of vendedoras) { await removerVendedoraDB(v); }
    for (const v of ["Ana", "Julia", "Carla"]) { await adicionarVendedoraDB(v); }
  };

  const SectionCard = ({ title, subtitle, onReset, children }: { title: string; subtitle: string; onReset: () => void; children: React.ReactNode }) => (
    <section className="card-premium p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-gold transition-colors duration-150">
          <RotateCcw size={11} /> Restaurar
        </button>
      </div>
      {children}
    </section>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center gap-3 mb-1">
          <Settings size={20} className="text-gold" />
          <h1 className="page-title text-2xl">Configurações</h1>
        </div>
        <p className="page-subtitle">Personalize tipos, concentrações e volumes</p>
      </div>

      <div className="px-4 space-y-5">
        {/* Tipos de Perfume */}
        <SectionCard title="Tipos de Perfume (TT)" subtitle="Usado no início do código e como categoria" onReset={handleResetTipos}>
          <div className="space-y-2">
            {Object.entries(tiposPerfumeConfig).map(([sigla, label]) => (
              <div key={sigla} className="flex items-center justify-between bg-surface-overlay rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-gold w-8">{sigla}</span>
                  <span className="text-sm text-foreground">{String(label)}</span>
                </div>
                <button onClick={() => handleRemoveTipo(sigla)} className="text-muted-foreground hover:text-destructive transition-colors duration-150 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Sigla" maxLength={3} value={novoTipoSigla}
              onChange={(e) => setNovoTipoSigla(e.target.value.toUpperCase())}
              className="input-premium w-20 px-2 py-2 text-xs font-mono" />
            <input type="text" placeholder="Nome (ex: Luxo)" value={novoTipoLabel}
              onChange={(e) => setNovoTipoLabel(e.target.value)}
              className="input-premium flex-1 px-3 py-2 text-xs" />
            <button onClick={handleAddTipo} disabled={!novoTipoSigla || !novoTipoLabel}
              className="btn-primary px-3 py-2"><Plus size={14} /></button>
          </div>
        </SectionCard>

        {/* Concentrações */}
        <SectionCard title="Concentrações (CC)" subtitle="Tipo de concentração do perfume" onReset={handleResetConcentracoes}>
          <div className="space-y-2">
            {Object.entries(concentracoesConfig).map(([sigla, label]) => (
              <div key={sigla} className="flex items-center justify-between bg-surface-overlay rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-gold w-10">{sigla}</span>
                  <span className="text-xs text-foreground">{String(label)}</span>
                </div>
                <button onClick={() => handleRemoveConcent(sigla)} className="text-muted-foreground hover:text-destructive transition-colors duration-150 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Sigla" maxLength={4} value={novaConcentSigla}
              onChange={(e) => setNovaConcentSigla(e.target.value.toUpperCase())}
              className="input-premium w-20 px-2 py-2 text-xs font-mono" />
            <input type="text" placeholder="Descrição" value={novaConcentLabel}
              onChange={(e) => setNovaConcentLabel(e.target.value)}
              className="input-premium flex-1 px-3 py-2 text-xs" />
            <button onClick={handleAddConcent} disabled={!novaConcentSigla || !novaConcentLabel}
              className="btn-primary px-3 py-2"><Plus size={14} /></button>
          </div>
        </SectionCard>

        {/* Volumes */}
        <SectionCard title="Volumes Padrão (VVV)" subtitle="Volumes em ml disponíveis no cadastro" onReset={handleResetVolumes}>
          <div className="flex flex-wrap gap-2">
            {volumesPadrao.map((v) => (
              <div key={v} className="flex items-center gap-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5">
                <span className="text-xs font-mono text-foreground">{v}ml</span>
                <button onClick={() => handleRemoveVolume(v)} className="text-muted-foreground hover:text-destructive transition-colors duration-150 ml-1">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" placeholder="Volume em ml" min={1} value={novoVolume}
              onChange={(e) => setNovoVolume(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVolume()}
              className="input-premium flex-1 px-3 py-2 text-xs" />
            <button onClick={handleAddVolume} disabled={!novoVolume}
              className="btn-primary px-3 py-2"><Plus size={14} /></button>
          </div>
        </SectionCard>

        {/* Vendedoras */}
        <SectionCard title="Vendedoras" subtitle="Equipe de vendas disponível no lançamento" onReset={handleResetVendedoras}>
          <div className="flex flex-wrap gap-2">
            {vendedoras.map((v) => (
              <div key={v} className="flex items-center gap-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5">
                <span className="text-xs text-foreground">{v}</span>
                <button onClick={() => handleRemoveVendedora(v)} className="text-muted-foreground hover:text-destructive transition-colors duration-150 ml-1">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Nome da vendedora" value={novaVendedora}
              onChange={(e) => setNovaVendedora(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVendedora()}
              className="input-premium flex-1 px-3 py-2 text-xs" />
            <button onClick={handleAddVendedora} disabled={!novaVendedora.trim()}
              className="btn-primary px-3 py-2"><Plus size={14} /></button>
          </div>
        </SectionCard>

        {/* Info código */}
        <section className="card-premium p-5" style={{ background: "var(--gradient-gold-subtle)", borderColor: "hsl(var(--gold-muted))" }}>
          <p className="page-subtitle text-gold mb-3">FORMATO DO CÓDIGO</p>
          <p className="font-mono text-lg text-foreground font-bold tracking-wider mb-2">TT · MM · CC · LLLL · VVV</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              ["TT", "Tipo de Perfume"],
              ["MM", "Sigla da Marca / Casa"],
              ["CC", "Concentração"],
              ["LLLL", "Linha sequencial"],
              ["VVV", "Volume em ml"],
            ].map(([code, desc]) => (
              <div key={code} className="flex items-start gap-2">
                <span className="font-mono text-[10px] font-bold text-gold bg-primary/10 px-2 py-0.5 rounded-md flex-shrink-0">{code}</span>
                <span className="text-[10px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
