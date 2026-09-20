import { useMemo, useState } from "react";
import { Building2, Plus, Loader2, X, ClipboardCheck, AlertTriangle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidades, type Unidade } from "@/hooks/useUnidades";
import { useImplantacoes, type Implantacao } from "@/hooks/useImplantacoes";
import WizardImplantacao from "@/components/implantacao/WizardImplantacao";

const TIPOS = ["LOJA", "ESTOQUE", "ESTOQUE_CENTRAL", "SHOWROOM", "QUIOSQUE", "ECOMMERCE", "OUTRO"];

export default function Implantacoes() {
  const { todas } = useUnidades({ contexto: "historico" });
  const { implantacoes, isLoading, criar, invalidar } = useImplantacoes();
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    tipo: "LOJA",
    responsavel: "",
    dataPrevista: "",
  });

  const { data: pendenciasAbertas = 0 } = useQuery({
    queryKey: ["implantacao-pendencias-abertas"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("implantacao_pendencias")
        .select("id", { count: "exact", head: true })
        .eq("status", "ABERTA");
      if (error) throw error;
      return count || 0;
    },
  });

  const unidadePorId = useMemo(() => {
    const m: Record<string, Unidade> = {};
    todas.forEach((u: Unidade) => (m[u.id] = u));
    return m;
  }, [todas]);

  const emAndamento = implantacoes.filter((i) => i.status === "EM_ANDAMENTO");
  const concluidas = implantacoes.filter((i) => i.status !== "EM_ANDAMENTO");
  const mediaProgresso = implantacoes.length
    ? Math.round(implantacoes.reduce((s, i) => s + i.progresso, 0) / implantacoes.length)
    : 0;
  const proximas = emAndamento.filter((i) => !!i.data_prevista_inauguracao).length;

  const aberta = implantacoes.find((i) => i.id === abertaId);

  const criarUnidade = async () => {
    if (!form.codigo.trim() || !form.nome.trim())
      return toast.error("Informe o código interno e o nome da unidade");
    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("unidades")
        .insert({
          codigo: form.codigo.trim().toUpperCase(),
          nome: form.nome.trim(),
          nome_exibicao: form.nome.trim(),
          tipo: form.tipo,
          status: "EM_IMPLANTACAO",
          permite_venda: false,
          permite_estoque: true,
          permite_transferencia: true,
          data_prevista_inauguracao: form.dataPrevista || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const implId = await criar({
        unidadeId: data.id,
        responsavelNome: form.responsavel,
        dataPrevista: form.dataPrevista || null,
      });
      invalidar();
      setNovaAberta(false);
      setForm({ codigo: "", nome: "", tipo: "LOJA", responsavel: "", dataPrevista: "" });
      setAbertaId(implId);
      toast.success("Implantação iniciada");
    } catch (e: unknown) {
      toast.error("Não foi possível criar a unidade", { description: (e as Error)?.message });
    } finally {
      setSalvando(false);
    }
  };

  if (aberta) {
    return (
      <div className="p-4 md:p-6">
        <WizardImplantacao implantacao={aberta} onVoltar={() => setAbertaId(null)} />
      </div>
    );
  }

  const cards = [
    { rotulo: "Unidades em implantação", valor: emAndamento.length, icone: Building2 },
    { rotulo: "Próximas inaugurações", valor: proximas, icone: CalendarDays },
    { rotulo: "Pendências abertas", valor: pendenciasAbertas, icone: AlertTriangle },
    { rotulo: "Implantações concluídas", valor: concluidas.length, icone: ClipboardCheck },
    { rotulo: "Conclusão média", valor: `${mediaProgresso}%`, icone: ClipboardCheck },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Implantação de Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a abertura de novas unidades do começo ao fim.
          </p>
        </div>
        <button
          onClick={() => setNovaAberta(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="w-4 h-4" /> Nova unidade
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icone className="w-4 h-4" />
              <span className="text-xs">{c.rotulo}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                "Unidade",
                "Status",
                "Progresso",
                "Inauguração",
                "Responsável",
                "Última atualização",
                "Ação",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="inline w-4 h-4 animate-spin" /> Carregando…
                </td>
              </tr>
            ) : implantacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhuma implantação em andamento.
                </td>
              </tr>
            ) : (
              implantacoes.map((i: Implantacao) => (
                <tr key={i.id} className="border-t border-border text-foreground">
                  <td className="px-3 py-2">{unidadePorId[i.unidade_id]?.nomeExibicao || "—"}</td>
                  <td className="px-3 py-2">
                    {unidadePorId[i.unidade_id]?.status === "OPERACIONAL"
                      ? "Operacional"
                      : "Em implantação"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${i.progresso}%` }}
                        />
                      </div>
                      <span className="text-xs">{i.progresso}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{i.data_prevista_inauguracao || "—"}</td>
                  <td className="px-3 py-2">{i.responsavel_nome || "—"}</td>
                  <td className="px-3 py-2">
                    {new Date(i.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setAbertaId(i.id)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-primary"
                    >
                      Continuar implantação
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {novaAberta && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Nova unidade</h2>
              <button onClick={() => setNovaAberta(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Código interno</span>
                <input
                  className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Nome</span>
                <input
                  className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Tipo</span>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Responsável</span>
                <input
                  className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Data prevista de inauguração</span>
                <input
                  type="date"
                  className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                  value={form.dataPrevista}
                  onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })}
                />
              </label>
            </div>

            <button
              onClick={criarUnidade}
              disabled={salvando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Criar e iniciar implantação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
