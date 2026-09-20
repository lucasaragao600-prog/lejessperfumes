import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useConfigCaixaUnidade, type ConfigCaixaUnidade } from "@/hooks/useConfigUnidade";
import { registrarAuditoria } from "@/lib/audit";

interface Props {
  unidadeId: string;
}

type Form = Omit<ConfigCaixaUnidade, "id" | "unidade_id">;

const vazio: Form = {
  valor_abertura_padrao: 0,
  exige_valor_abertura: true,
  permite_sangria: true,
  permite_suprimento: true,
  limite_sangria: 0,
  exige_motivo_sangria: true,
  diferenca_tolerada: 0,
  impressora_nome: "",
  observacao: "",
};

export default function EtapaCaixa({ unidadeId }: Props) {
  const { config, isLoading, salvar } = useConfigCaixaUnidade(unidadeId);
  const [form, setForm] = useState<Form>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    const { id: _id, unidade_id: _u, ...resto } = config;
    setForm({ ...vazio, ...resto });
  }, [config]);

  const numero = (k: keyof Form, rotulo: string, dica?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        className="h-9 rounded-md border border-border bg-background px-2 text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        value={String(form[k] ?? 0)}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
        onChange={(e) => setForm({ ...form, [k]: Number(e.target.value || 0) })}
      />
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
    </label>
  );

  const marcador = (k: keyof Form, rotulo: string) => (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[hsl(var(--primary))]"
        checked={Boolean(form[k])}
        onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
      />
      {rotulo}
    </label>
  );

  const enviar = async () => {
    setSalvando(true);
    try {
      await salvar(form);
      await registrarAuditoria({
        acao: "CAIXA_CONFIGURADO",
        entidade: "caixa_config_unidade",
        unidadeId,
        dadosNovos: form,
      });
      toast.success("Configuração do caixa salva");
    } catch (e: unknown) {
      toast.error("Não foi possível salvar", { description: (e as Error)?.message });
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Regras de abertura e fechamento do caixa desta unidade.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {numero("valor_abertura_padrao", "Valor de abertura padrão (R$)")}
        {numero("limite_sangria", "Limite por sangria (R$)", "0 = sem limite")}
        {numero("diferenca_tolerada", "Diferença tolerada no fechamento (R$)")}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Impressora do caixa</span>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
            value={form.impressora_nome}
            onChange={(e) => setForm({ ...form, impressora_nome: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {marcador("exige_valor_abertura", "Exigir valor de abertura")}
        {marcador("permite_sangria", "Permitir sangria")}
        {marcador("permite_suprimento", "Permitir suprimento")}
        {marcador("exige_motivo_sangria", "Exigir motivo na sangria")}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Observações</span>
        <textarea
          className="min-h-20 rounded-md border border-border bg-background p-2 text-foreground"
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        />
      </label>

      <button
        onClick={enviar}
        disabled={salvando}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar configuração do caixa
      </button>
    </div>
  );
}
