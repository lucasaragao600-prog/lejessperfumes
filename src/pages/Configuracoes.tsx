import { useState, useEffect, useRef } from "react";
import { Settings, Plus, Trash2, RotateCcw, Loader2, Upload, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { TipoPerfume, Concentracao } from "@/data/mockData";
import { useConfiguracoesFiscais } from "@/hooks/useConfiguracoesFiscais";
import { toast } from "sonner";

const UFS_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [empresa, setEmpresa] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
    endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "AM", cep: "", telefone: "",
    regimeTributario: "simples_nacional" as string,
    ambiente: "homologacao" as "homologacao" | "producao",
    serieNfce: 1, proximoNumeroNfce: 1, cscId: "", cscToken: "",
    logoUrl: "",
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
        complemento: configFiscal.complemento,
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
        logoUrl: configFiscal.logoUrl,
      });
      if (configFiscal.logoUrl) {
        setLogoPreview(configFiscal.logoUrl);
      }
    }
  }, [configFiscal]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setEmpresa(p => ({ ...p, logoUrl: "" }));
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleSalvarEmpresa = async () => {
    if (!empresa.razaoSocial.trim() || !empresa.cnpj.trim()) {
      toast.error("Razão Social e CNPJ são obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      let logoUrl = empresa.logoUrl;

      // Upload logo if new file selected
      if (logoFile) {
        const { supabase } = await import("@/integrations/supabase/client");
        const ext = logoFile.name.split('.').pop();
        const filePath = `logo-empresa.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-photos")
          .upload(filePath, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("product-photos")
          .getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }

      await salvarConfigFiscal({ ...empresa, logoUrl });
      toast.success("Dados da empresa salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar dados da empresa");
    } finally {
      setIsSaving(false);
    }
  };

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
        {/* Dados da Empresa */}
        <section className="card-premium p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Dados da Empresa</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Informações que aparecem no comprovante e NFC-e</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Razão Social *</label>
              <input type="text" value={empresa.razaoSocial}
                onChange={e => setEmpresa(p => ({ ...p, razaoSocial: e.target.value }))}
                placeholder="MAISON LE JESS COMERCIO DE PERFUMARIA LTDA"
                className="input-premium w-full px-3 py-2 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome Fantasia</label>
              <input type="text" value={empresa.nomeFantasia}
                onChange={e => setEmpresa(p => ({ ...p, nomeFantasia: e.target.value }))}
                placeholder="LE JESS PERFUMES"
                className="input-premium w-full px-3 py-2 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">CNPJ *</label>
              <input type="text" value={empresa.cnpj}
                onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="input-premium w-full px-3 py-2 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Inscrição Estadual</label>
              <input type="text" value={empresa.inscricaoEstadual}
                onChange={e => setEmpresa(p => ({ ...p, inscricaoEstadual: e.target.value }))}
                className="input-premium w-full px-3 py-2 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</label>
              <input type="text" value={empresa.telefone}
                onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))}
                placeholder="(92) 99999-9999"
                className="input-premium w-full px-3 py-2 text-xs mt-1" />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Endereço</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted-foreground">Logradouro</label>
                <input type="text" value={empresa.endereco}
                  onChange={e => setEmpresa(p => ({ ...p, endereco: e.target.value }))}
                  placeholder="Avenida Noel Nutels"
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Número</label>
                <input type="text" value={empresa.numero}
                  onChange={e => setEmpresa(p => ({ ...p, numero: e.target.value }))}
                  placeholder="1762"
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Bairro</label>
                <input type="text" value={empresa.bairro}
                  onChange={e => setEmpresa(p => ({ ...p, bairro: e.target.value }))}
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Cidade</label>
                <input type="text" value={empresa.cidade}
                  onChange={e => setEmpresa(p => ({ ...p, cidade: e.target.value }))}
                  placeholder="Manaus"
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">UF</label>
                  <select value={empresa.uf}
                    onChange={e => setEmpresa(p => ({ ...p, uf: e.target.value }))}
                    className="input-premium w-full px-2 py-2 text-xs mt-1">
                    {UFS_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">CEP</label>
                  <input type="text" value={empresa.cep}
                    onChange={e => setEmpresa(p => ({ ...p, cep: e.target.value }))}
                    placeholder="69095-000"
                    className="input-premium w-full px-3 py-2 text-xs mt-1" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Dados Fiscais (NFC-e)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground">Regime Tributário</label>
                <select value={empresa.regimeTributario}
                  onChange={e => setEmpresa(p => ({ ...p, regimeTributario: e.target.value }))}
                  className="input-premium w-full px-2 py-2 text-xs mt-1">
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Série NFC-e</label>
                <input type="number" value={empresa.serieNfce} min={1}
                  onChange={e => setEmpresa(p => ({ ...p, serieNfce: Number(e.target.value) }))}
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Próx. Número NFC-e</label>
                <input type="number" value={empresa.proximoNumeroNfce} min={1}
                  onChange={e => setEmpresa(p => ({ ...p, proximoNumeroNfce: Number(e.target.value) }))}
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">CSC ID</label>
                <input type="text" value={empresa.cscId}
                  onChange={e => setEmpresa(p => ({ ...p, cscId: e.target.value }))}
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">CSC Token</label>
                <input type="text" value={empresa.cscToken}
                  onChange={e => setEmpresa(p => ({ ...p, cscToken: e.target.value }))}
                  className="input-premium w-full px-3 py-2 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Ambiente</label>
                <select value={empresa.ambiente}
                  onChange={e => setEmpresa(p => ({ ...p, ambiente: e.target.value as "homologacao" | "producao" }))}
                  className="input-premium w-full px-2 py-2 text-xs mt-1">
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleSalvarEmpresa}
            disabled={isSaving}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSaving ? "Salvando..." : "Salvar Dados da Empresa"}
          </button>
        </section>
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
