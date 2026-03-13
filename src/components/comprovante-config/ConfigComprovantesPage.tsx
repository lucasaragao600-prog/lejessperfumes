import { useState, useEffect } from "react";
import { Receipt, Save, RotateCcw, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useComprovanteConfig, DEFAULT_CONFIG, type ComprovanteConfig } from "@/hooks/useComprovanteConfig";
import { useConfiguracoesFiscais } from "@/hooks/useConfiguracoesFiscais";
import ConfigGeralSection from "./ConfigGeralSection";
import BlocosLayoutSection from "./BlocosLayoutSection";
import FontesSection from "./FontesSection";
import MensagensSection from "./MensagensSection";
import LogoSection from "./LogoSection";
import AvancadoSection from "./AvancadoSection";
import ComprovantePreviewLive from "./ComprovantePreviewLive";
import { toast } from "sonner";

export default function ConfigComprovantesPage() {
  const { config: savedConfig, isLoading, salvarConfig, isSaving } = useComprovanteConfig();
  const { configFiscal } = useConfiguracoesFiscais();
  const [config, setConfig] = useState<ComprovanteConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig);
  }, [savedConfig]);

  const handleSave = async () => {
    try {
      await salvarConfig(config);
      toast.success("Configurações do comprovante salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    toast.info("Configurações restauradas para o padrão");
  };

  const empresaEndereco = configFiscal
    ? `${configFiscal.endereco}, ${configFiscal.numero}${configFiscal.complemento ? ` - ${configFiscal.complemento}` : ""} - ${configFiscal.bairro} - ${configFiscal.cidade}/${configFiscal.uf}`
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt size={18} className="text-gold" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Configurações de Comprovantes / Recibos</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Personalize totalmente a impressão e layout dos seus comprovantes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors px-3 py-2 rounded-xl border border-border hover:border-gold/40">
            <RotateCcw size={12} /> Restaurar
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Two columns: settings + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Settings tabs */}
        <div>
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="w-full grid grid-cols-6 h-9">
              <TabsTrigger value="geral" className="text-[10px] px-1">Geral</TabsTrigger>
              <TabsTrigger value="blocos" className="text-[10px] px-1">Blocos</TabsTrigger>
              <TabsTrigger value="fontes" className="text-[10px] px-1">Fontes</TabsTrigger>
              <TabsTrigger value="logo" className="text-[10px] px-1">Logo</TabsTrigger>
              <TabsTrigger value="msgs" className="text-[10px] px-1">Mensagens</TabsTrigger>
              <TabsTrigger value="avancado" className="text-[10px] px-1">Avançado</TabsTrigger>
            </TabsList>
            <TabsContent value="geral"><ConfigGeralSection config={config} onChange={setConfig} /></TabsContent>
            <TabsContent value="blocos"><BlocosLayoutSection config={config} onChange={setConfig} /></TabsContent>
            <TabsContent value="fontes"><FontesSection config={config} onChange={setConfig} /></TabsContent>
            <TabsContent value="logo"><LogoSection config={config} onChange={setConfig} logoUrl={configFiscal?.logoUrl} /></TabsContent>
            <TabsContent value="msgs"><MensagensSection config={config} onChange={setConfig} /></TabsContent>
            <TabsContent value="avancado"><AvancadoSection config={config} onChange={setConfig} /></TabsContent>
          </Tabs>
        </div>

        {/* Right: Live preview */}
        <div className="lg:sticky lg:top-20">
          <ComprovantePreviewLive
            config={config}
            logoUrl={configFiscal?.logoUrl}
            empresaNome={configFiscal?.nomeFantasia || configFiscal?.razaoSocial}
            empresaCnpj={configFiscal?.cnpj}
            empresaEndereco={empresaEndereco}
            empresaTelefone={configFiscal?.telefone}
          />
        </div>
      </div>
    </div>
  );
}
