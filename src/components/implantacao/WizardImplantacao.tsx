import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUnidades, type Unidade } from "@/hooks/useUnidades";
import {
  useImplantacaoDetalhe,
  ETAPAS_IMPLEMENTADAS,
  type Implantacao,
  type StatusEtapa,
  type Criticidade,
} from "@/hooks/useImplantacoes";
import AcessosUnidade from "@/components/admin/AcessosUnidade";
import EtapaEstrutura from "./EtapaEstrutura";
import EtapaEquipamentos from "./EtapaEquipamentos";
import EtapaEstoqueInicial from "./EtapaEstoqueInicial";
import EtapaFiscal from "./EtapaFiscal";
import EtapaCaixa from "./EtapaCaixa";
import EtapaTestes from "./EtapaTestes";
import EtapaLiberacao from "./EtapaLiberacao";
import { registrarAuditoria } from "@/lib/audit";


interface Props {
  implantacao: Implantacao;
  onVoltar: () => void;
}

const corStatus: Record<StatusEtapa, string> = {
  NAO_INICIADA: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-amber-500/15 text-amber-600",
  CONCLUIDA: "bg-emerald-500/15 text-emerald-600",
  BLOQUEADA: "bg-destructive/15 text-destructive",
};

export default function WizardImplantacao({ implantacao, onVoltar }: Props) {
  const { todas } = useUnidades({ contexto: "historico" });
  const unidade = useMemo(
    () => todas.find((u: Unidade) => u.id === implantacao.unidade_id),
    [todas, implantacao.unidade_id],
  );
  const {
    etapas,
    checklist,
    pendencias,
    salvarEtapa,
    salvarItem,
    criarPendencia,
    resolverPendencia,
  } = useImplantacaoDetalhe(implantacao.id);

  const [etapaAtiva, setEtapaAtiva] = useState("cadastro");
  const [mostrarAcessos, setMostrarAcessos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novaPend, setNovaPend] = useState({
    titulo: "",
    criticidade: "NORMAL" as Criticidade,
    responsavel_nome: "",
    prazo: "",
  });

  const [cadastro, setCadastro] = useState({
    telefone: unidade?.telefone || "",
    cnpj: unidade?.cnpj || "",
    cidade: unidade?.cidade || "",
    uf: unidade?.uf || "",
    responsavel: implantacao.responsavel_nome,
    dataPrevista: implantacao.data_prevista_inauguracao || "",
    observacoes: implantacao.observacoes,
  });

  const etapa = etapas.find((e) => e.chave === etapaAtiva);
  const itensEstrutura = checklist.filter((i) => i.etapa_chave === "estrutura");
  const abertas = pendencias.filter((p) => p.status === "ABERTA");

  const salvarCadastro = async () => {
    if (!unidade) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("unidades")
        .update({
          telefone: cadastro.telefone,
          cnpj: cadastro.cnpj,
          cidade: cadastro.cidade,
          uf: cadastro.uf,
          data_prevista_inauguracao: cadastro.dataPrevista || null,
        })
        .eq("id", unidade.id);
      if (error) throw error;

      const { error: err2 } = await supabase
        .from("implantacoes")
        .update({
          responsavel_nome: cadastro.responsavel,
          data_prevista_inauguracao: cadastro.dataPrevista || null,
          observacoes: cadastro.observacoes,
        })
        .eq("id", implantacao.id);
      if (err2) throw err2;

      await registrarAuditoria({
        acao: "UNIDADE_ALTERADA",
        entidade: "implantacoes",
        entidadeId: implantacao.id,
        unidadeId: unidade.id,
        dadosNovos: cadastro,
      });
      toast.success("Cadastro salvo");
    } catch (e: unknown) {
      toast.error("Não foi possível salvar", { description: (e as Error)?.message });
    } finally {
      setSalvando(false);
    }
  };

  const marcarEtapa = async (status: StatusEtapa) => {
    if (!etapa) return;
    try {
      if (etapa.chave === "estoque" && status === "CONCLUIDA") {
        const { data, error } = await supabase.rpc("fn_implantacao_estoque_sincronizar", {
          p_implantacao_id: implantacao.id,
        });
        if (error) throw error;
        const r = data as { pendentes: number; divergencias: number; pode_concluir: boolean };
        if (!r?.pode_concluir) {
          toast.error("Ainda há carga pendente ou divergência aberta", {
            description: `${r?.pendentes ?? 0} item(ns) pendente(s) e ${r?.divergencias ?? 0} divergência(s).`,
          });
          return;
        }
      }

      if (etapa.chave === "fiscal" && status === "CONCLUIDA" && unidade) {
        const { data, error } = await supabase.rpc("fn_config_fiscal_unidade_ler", {
          p_unidade_id: unidade.id,
        });
        if (error) throw error;
        const c = data as {
          cnpj?: string;
          razao_social?: string;
          csc_token_configurado?: boolean;
        } | null;
        if (!c?.cnpj || !c?.razao_social || !c?.csc_token_configurado) {
          toast.error("Configuração fiscal incompleta", {
            description: "Preencha CNPJ, razão social e o token do CSC desta unidade.",
          });
          return;
        }
      }

      if (etapa.chave === "caixa" && status === "CONCLUIDA" && unidade) {
        const { data, error } = await supabase
          .from("caixa_config_unidade")
          .select("id")
          .eq("unidade_id", unidade.id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("Configure o caixa antes de concluir esta etapa");
          return;
        }
      }
      await salvarEtapa(etapa.id, { status });
      toast.success("Etapa atualizada");
    } catch (e: unknown) {
      toast.error("Não foi possível atualizar", { description: (e as Error)?.message });
    }
  };

  const adicionarPendencia = async () => {
    if (!novaPend.titulo.trim()) return toast.error("Informe o título da pendência");
    try {
      await criarPendencia({
        titulo: novaPend.titulo,
        criticidade: novaPend.criticidade,
        responsavel_nome: novaPend.responsavel_nome,
        prazo: novaPend.prazo || null,
        etapa_chave: etapaAtiva,
        origem: "ETAPA",
      });
      setNovaPend({ titulo: "", criticidade: "NORMAL", responsavel_nome: "", prazo: "" });
      toast.success("Pendência registrada");
    } catch (e: unknown) {
      toast.error("Não foi possível registrar", { description: (e as Error)?.message });
    }
  };

  const campoCadastro = (k: keyof typeof cadastro, rotulo: string, tipo = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <input
        type={tipo}
        className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
        value={cadastro[k]}
        onChange={(e) => setCadastro({ ...cadastro, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {unidade?.nomeExibicao || "Unidade"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Progresso {implantacao.progresso}% · {abertas.length} pendência(s) aberta(s)
          </p>
        </div>
      </div>

      {/* Stepper — navegação livre */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {etapas.map((e) => (
          <button
            key={e.id}
            onClick={() => setEtapaAtiva(e.chave)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${
              etapaAtiva === e.chave ? "border-primary" : "border-border"
            }`}
          >
            <span className="block font-medium text-foreground">
              {e.numero}. {e.nome}
            </span>
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 ${corStatus[e.status]}`}>
              {e.status === "NAO_INICIADA"
                ? "Não iniciada"
                : e.status === "EM_ANDAMENTO"
                  ? "Em andamento"
                  : e.status === "CONCLUIDA"
                    ? "Concluída"
                    : "Bloqueada"}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {etapaAtiva === "cadastro" && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campoCadastro("cnpj", "CNPJ")}
              {campoCadastro("telefone", "Telefone")}
              {campoCadastro("cidade", "Cidade")}
              {campoCadastro("uf", "UF")}
              {campoCadastro("responsavel", "Responsável")}
              {campoCadastro("dataPrevista", "Data prevista de inauguração", "date")}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Observações</span>
              <textarea
                className="min-h-20 rounded-md border border-border bg-background p-2 text-foreground"
                value={cadastro.observacoes}
                onChange={(e) => setCadastro({ ...cadastro, observacoes: e.target.value })}
              />
            </label>
            <button
              onClick={salvarCadastro}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar cadastro
            </button>
          </div>
        )}

        {etapaAtiva === "fiscal" && unidade && <EtapaFiscal unidadeId={unidade.id} />}

        {etapaAtiva === "caixa" && unidade && <EtapaCaixa unidadeId={unidade.id} />}

        {etapaAtiva === "estrutura" && (
          <EtapaEstrutura
            implantacaoId={implantacao.id}
            itens={itensEstrutura}
            onSalvar={salvarItem}
          />
        )}

        {etapaAtiva === "usuarios" && unidade && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conceda acesso e permissões às pessoas que vão operar esta unidade.
            </p>
            <button
              onClick={() => setMostrarAcessos(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <ShieldCheck className="w-4 h-4" /> Gerenciar acessos
            </button>
          </div>
        )}

        {etapaAtiva === "estoque" && unidade && (
          <EtapaEstoqueInicial implantacaoId={implantacao.id} unidadeId={unidade.id} />
        )}

        {etapaAtiva === "equipamentos" && unidade && (
          <EtapaEquipamentos unidadeId={unidade.id} implantacaoId={implantacao.id} />
        )}

        {!ETAPAS_IMPLEMENTADAS.includes(etapaAtiva) && (
          <p className="text-sm text-muted-foreground">
            Esta etapa será liberada em uma próxima entrega. Você já pode registrar pendências
            relacionadas a ela abaixo.
          </p>
        )}

        {etapa && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              onClick={() => marcarEtapa("EM_ANDAMENTO")}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
            >
              Marcar em andamento
            </button>
            <button
              onClick={() => marcarEtapa("CONCLUIDA")}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
            >
              <Check className="w-4 h-4" /> Concluir etapa
            </button>
            <button
              onClick={() => marcarEtapa("BLOQUEADA")}
              className="rounded-md border border-border px-3 py-2 text-sm text-destructive"
            >
              Marcar bloqueada
            </button>
          </div>
        )}
      </div>

      {/* Pendências */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="font-medium text-foreground">Pendências</h3>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground lg:col-span-2"
            placeholder="Título da pendência"
            value={novaPend.titulo}
            onChange={(e) => setNovaPend({ ...novaPend, titulo: e.target.value })}
          />
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={novaPend.criticidade}
            onChange={(e) =>
              setNovaPend({ ...novaPend, criticidade: e.target.value as Criticidade })
            }
          >
            <option value="CRITICA">Crítica</option>
            <option value="ALTA">Alta</option>
            <option value="NORMAL">Normal</option>
          </select>
          <input
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            placeholder="Responsável"
            value={novaPend.responsavel_nome}
            onChange={(e) => setNovaPend({ ...novaPend, responsavel_nome: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={novaPend.prazo}
              onChange={(e) => setNovaPend({ ...novaPend, prazo: e.target.value })}
            />
            <button
              onClick={adicionarPendencia}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pendencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pendência registrada.</p>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">{p.titulo}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.criticidade === "CRITICA"
                      ? "Crítica"
                      : p.criticidade === "ALTA"
                        ? "Alta"
                        : "Normal"}
                    {p.responsavel_nome ? ` · ${p.responsavel_nome}` : ""}
                    {p.prazo ? ` · até ${p.prazo}` : ""}
                  </span>
                </div>
                {p.status === "ABERTA" ? (
                  <button
                    onClick={() => resolverPendencia(p.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
                  >
                    Resolver
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600">Resolvida</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {mostrarAcessos && unidade && (
        <AcessosUnidade
          unidadeId={unidade.id}
          unidadeNome={unidade.nomeExibicao}
          onClose={() => setMostrarAcessos(false)}
        />
      )}
    </div>
  );
}
