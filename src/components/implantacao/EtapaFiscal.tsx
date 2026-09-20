import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { useConfigFiscalUnidade, type SalvarFiscalParams } from "@/hooks/useConfigUnidade";

interface Props {
  unidadeId: string;
}

const vazio: SalvarFiscalParams = {
  cnpj: "",
  inscricao_estadual: "",
  razao_social: "",
  nome_fantasia: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  telefone: "",
  regime_tributario: "simples_nacional",
  ambiente: "homologacao",
  serie_nfce: 1,
  proximo_numero_nfce: 1,
  csc_id: "",
  csc_token: "",
  certificado_senha: "",
};

export default function EtapaFiscal({ unidadeId }: Props) {
  const { config, isLoading, salvar } = useConfigFiscalUnidade(unidadeId);
  const [form, setForm] = useState<SalvarFiscalParams>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      cnpj: config.cnpj,
      inscricao_estadual: config.inscricao_estadual,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      endereco: config.endereco,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      cidade: config.cidade,
      uf: config.uf,
      cep: config.cep,
      telefone: config.telefone,
      regime_tributario: config.regime_tributario,
      ambiente: config.ambiente,
      serie_nfce: config.serie_nfce,
      proximo_numero_nfce: config.proximo_numero_nfce,
      csc_id: config.csc_id,
      csc_token: "",
      certificado_senha: "",
    });
  }, [config]);

  const campo = (
    k: keyof SalvarFiscalParams,
    rotulo: string,
    tipo: "text" | "number" | "password" = "text",
    dica?: string,
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <input
        type={tipo}
        className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
        value={String(form[k] ?? "")}
        onChange={(e) =>
          setForm({
            ...form,
            [k]: tipo === "number" ? Number(e.target.value || 0) : e.target.value,
          })
        }
      />
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
    </label>
  );

  const enviar = async () => {
    if (!form.cnpj.trim()) return toast.error("Informe o CNPJ da unidade");
    if (!form.razao_social.trim()) return toast.error("Informe a razão social");
    if (form.serie_nfce < 1 || form.proximo_numero_nfce < 1)
      return toast.error("Série e próximo número devem ser maiores que zero");
    setSalvando(true);
    try {
      await salvar(form);
      setForm((f) => ({ ...f, csc_token: "", certificado_senha: "" }));
      toast.success("Configuração fiscal salva");
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
        Dados fiscais desta unidade. Cada loja emite com o próprio CNPJ, série e numeração.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {campo("cnpj", "CNPJ")}
        {campo("inscricao_estadual", "Inscrição estadual")}
        {campo("razao_social", "Razão social")}
        {campo("nome_fantasia", "Nome fantasia")}
        {campo("telefone", "Telefone")}
        {campo("cep", "CEP")}
        {campo("endereco", "Logradouro")}
        {campo("numero", "Número")}
        {campo("complemento", "Complemento")}
        {campo("bairro", "Bairro")}
        {campo("cidade", "Cidade")}
        {campo("uf", "UF")}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Regime tributário</span>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
            value={form.regime_tributario}
            onChange={(e) => setForm({ ...form, regime_tributario: e.target.value })}
          >
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Ambiente</span>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
            value={form.ambiente}
            onChange={(e) =>
              setForm({ ...form, ambiente: e.target.value as "homologacao" | "producao" })
            }
          >
            <option value="homologacao">Homologação (teste)</option>
            <option value="producao">Produção</option>
          </select>
        </label>

        {campo("serie_nfce", "Série da NFC-e", "number")}
        {campo("proximo_numero_nfce", "Próximo número", "number")}
        {campo("csc_id", "ID do CSC")}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Dados sigilosos</p>
        </div>
        <p className="text-xs text-muted-foreground">
          O token do CSC e a senha do certificado ficam guardados apenas no servidor. Eles nunca
          voltam para a tela — deixe em branco para manter o que já está salvo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo(
            "csc_token",
            "Token do CSC",
            "password",
            config?.csc_token_configurado ? "Já configurado" : "Ainda não configurado",
          )}
          {campo(
            "certificado_senha",
            "Senha do certificado",
            "password",
            config?.certificado_senha_configurada ? "Já configurada" : "Ainda não configurada",
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Certificado digital:{" "}
          {config?.certificado_configurado ? "enviado" : "pendente — envie em Configurações"}
        </p>
      </div>

      <button
        onClick={enviar}
        disabled={salvando}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar configuração fiscal
      </button>
    </div>
  );
}
