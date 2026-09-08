import { useMemo, useState } from "react";
import { PackageSearch, Truck, CheckCircle2, Plus, Camera, X, Loader2, Trash2, XCircle, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useCasas } from "@/hooks/useCasas";
import { useReposicoes, uploadReposicaoFoto, type Reposicao, type ReposicaoStatus } from "@/hooks/useReposicoes";
import ReposicaoFotoPreview from "@/components/ReposicaoFotoPreview";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import type { Deposito } from "@/data/mockData";

const STATUS_META: Record<ReposicaoStatus, { label: string; className: string }> = {
  sugerida: { label: "Sugerida", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  em_transito: { label: "Em trânsito", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  recebida: { label: "Recebida", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

type TabId = "sugestoes" | "transito" | "recebidas" | "historico";

export default function Reposicao({ isMaster = false }: { isMaster?: boolean }) {
  const { perfumes, concentracoesConfig } = useApp();
  const { profile, user } = useAuth();
  const { casas } = useCasas();
  const { reposicoes, criar, atualizar, remover } = useReposicoes();
  const [tab, setTab] = useState<TabId>("sugestoes");

  const nomeUsuario = profile?.nome || user?.email || "Sistema";
  const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

  const casaNome = (sigla: string) =>
    casas.find((c) => c.sigla === sigla)?.nome || sigla;

  // Sugestões automáticas: produtos com estoque < mínimo no destino
  const [destinoSug, setDestinoSug] = useState<Deposito>("Sumaúma");
  const [buscaSug, setBuscaSug] = useState("");
  const sugestoes = useMemo(() => {
    return perfumes
      .filter((p) => {
        const estDest = p.estoques[destinoSug] || 0;
        return p.estoqueMinimo > 0 && estDest < p.estoqueMinimo;
      })
      .map((p) => {
        const estDest = p.estoques[destinoSug] || 0;
        const falta = Math.max(1, p.estoqueMinimo - estDest);
        const origensCandidatas = depositos
          .filter((d) => d !== destinoSug && (p.estoques[d] || 0) > 0)
          .sort((a, b) => (p.estoques[b] || 0) - (p.estoques[a] || 0));
        return {
          perfume: p,
          estoqueDestino: estDest,
          falta,
          origensCandidatas,
        };
      })
      .filter((s) => s.origensCandidatas.length > 0)
      .sort((a, b) => b.falta - a.falta);
  }, [perfumes, destinoSug]);

  // Já criadas (por status)
  const reposicoesPorStatus = useMemo(() => {
    const map: Record<ReposicaoStatus, Reposicao[]> = {
      sugerida: [],
      em_transito: [],
      recebida: [],
      cancelada: [],
    };
    reposicoes.forEach((r) => map[r.status].push(r));
    return map;
  }, [reposicoes]);

  // IDs em reposição ativa (sugerida ou em_transito) para não sugerir de novo
  const emAndamentoKey = useMemo(() => {
    const s = new Set<string>();
    reposicoes.forEach((r) => {
      if (r.status === "sugerida" || r.status === "em_transito") {
        s.add(`${r.produto_id}|${r.destino}`);
      }
    });
    return s;
  }, [reposicoes]);

  const sugestoesFiltradas = sugestoes
    .filter((s) => !emAndamentoKey.has(`${s.perfume.id}|${destinoSug}`))
    .filter((s) => {
      const termo = buscaSug.trim().toLowerCase();
      if (!termo) return true;
      const texto = `${s.perfume.codigo} ${s.perfume.marca} ${s.perfume.nome} ${s.perfume.concentracao} ${s.perfume.volume}ml`.toLowerCase();
      return texto.includes(termo);
    });

  // Handlers
  const [criandoManual, setCriandoManual] = useState(false);
  const [formManual, setFormManual] = useState({
    perfumeId: "",
    origem: "" as Deposito | "",
    destino: "" as Deposito | "",
    quantidade: 1,
    observacao: "",
  });

  const handleCriarManual = async () => {
    if (!formManual.perfumeId || !formManual.origem || !formManual.destino) return;
    if (formManual.origem === formManual.destino) {
      alert("Origem e destino devem ser diferentes");
      return;
    }
    const p = perfumes.find((x) => x.id === formManual.perfumeId);
    if (!p) return;
    await criar({
      produto_id: p.id,
      produto_nome: `${p.marca} ${p.nome} ${p.volume}ml`,
      origem: formManual.origem,
      destino: formManual.destino,
      quantidade_sugerida: formManual.quantidade,
      solicitado_por: nomeUsuario,
      observacao: formManual.observacao,
    });
    setFormManual({ perfumeId: "", origem: "", destino: "", quantidade: 1, observacao: "" });
    setCriandoManual(false);
  };

  const handleCriarDeSugestao = async (perfumeId: string, produtoNome: string, origem: Deposito, destino: Deposito, qtd: number) => {
    await criar({
      produto_id: perfumeId,
      produto_nome: produtoNome,
      origem,
      destino,
      quantidade_sugerida: qtd,
      solicitado_por: nomeUsuario,
    });
  };

  // Ação: enviar (foto saída + baixa origem)
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [recebendoId, setRecebendoId] = useState<string | null>(null);

  return (
    <div className="pb-24 md:pb-8 px-4 md:px-0 pt-4 md:pt-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck size={22} className="text-gold" />
            Reposição
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sugestões automáticas e rastreamento de transferências
          </p>
        </div>
        <button
          onClick={() => setCriandoManual(true)}
          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2"
        >
          <Plus size={14} /> Nova
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {(
          [
            { id: "sugestoes", label: "Sugestões", count: sugestoesFiltradas.length },
            { id: "transito", label: "Em trânsito", count: reposicoesPorStatus.em_transito.length },
            { id: "recebidas", label: "Recebidas", count: reposicoesPorStatus.recebida.length },
            { id: "historico", label: "Histórico", count: reposicoes.length },
          ] as { id: TabId; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? "bg-gold/10 text-gold border border-gold/30"
                : "bg-surface-raised text-muted-foreground border border-transparent hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Modal Nova manual */}
      {criandoManual && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nova reposição</h3>
              <button onClick={() => setCriandoManual(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Produto</label>
                <PerfumeSearchSelect
                  perfumes={perfumes}
                  value={formManual.perfumeId}
                  onChange={(id) => setFormManual((f) => ({ ...f, perfumeId: id }))}
                  concentracoesConfig={concentracoesConfig}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Origem</label>
                  <select
                    className="input-primary w-full"
                    value={formManual.origem}
                    onChange={(e) => setFormManual((f) => ({ ...f, origem: e.target.value as Deposito }))}
                  >
                    <option value="">Selecione</option>
                    {depositos.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Destino</label>
                  <select
                    className="input-primary w-full"
                    value={formManual.destino}
                    onChange={(e) => setFormManual((f) => ({ ...f, destino: e.target.value as Deposito }))}
                  >
                    <option value="">Selecione</option>
                    {depositos.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantidade sugerida</label>
                <input
                  type="number"
                  min={1}
                  className="input-primary w-full no-spinner"
                  value={formManual.quantidade || ""}
                  onChange={(e) => setFormManual((f) => ({ ...f, quantidade: Math.max(1, Number(e.target.value) || 0) }))}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Observação (opcional)</label>
                <input
                  type="text"
                  className="input-primary w-full"
                  value={formManual.observacao}
                  onChange={(e) => setFormManual((f) => ({ ...f, observacao: e.target.value }))}
                />
              </div>
              <button onClick={handleCriarManual} className="btn-primary w-full py-2.5 text-sm">
                Criar sugestão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enviar modal */}
      {enviandoId && (
        <EnviarModal
          reposicao={reposicoes.find((r) => r.id === enviandoId)!}
          onClose={() => setEnviandoId(null)}
          onDone={async (qtdEnviada, path, conferente) => {
            const r = reposicoes.find((x) => x.id === enviandoId)!;
            // baixa estoque origem
            const p = perfumes.find((x) => x.id === r.produto_id);
            if (p) {
              const atual = p.estoques[r.origem as Deposito] || 0;
              if (qtdEnviada > atual) {
                alert(`Estoque insuficiente em ${r.origem}. Disponível: ${atual}`);
                return;
              }
            }
            await atualizar({
              id: r.id,
              patch: {
                status: "em_transito",
                quantidade_enviada: qtdEnviada,
                foto_saida_url: path,
                conferido_por: conferente,
                enviado_em: new Date().toISOString(),
              },
            });
            setEnviandoId(null);
          }}
          uploadFn={(file, tipo) => uploadReposicaoFoto(file, enviandoId!, tipo)}
          nomeUsuario={nomeUsuario}
        />
      )}

      {recebendoId && (
        <ReceberModal
          reposicao={reposicoes.find((r) => r.id === recebendoId)!}
          onClose={() => setRecebendoId(null)}
          onDone={async (qtdRecebida, path, recebedor) => {
            const r = reposicoes.find((x) => x.id === recebendoId)!;
            await atualizar({
              id: r.id,
              patch: {
                status: "recebida",
                quantidade_recebida: qtdRecebida,
                foto_chegada_url: path,
                recebido_por: recebedor,
                recebido_em: new Date().toISOString(),
              },
            });
            // Movimenta estoque: baixa origem já foi feita no envio? Não - simplificamos: fazemos transfer completo no recebimento
            // Já foi baixado no envio via handleEnviar. Aqui adicionamos no destino.
            setRecebendoId(null);
          }}
          uploadFn={(file, tipo) => uploadReposicaoFoto(file, recebendoId!, tipo)}
          nomeUsuario={nomeUsuario}
        />
      )}

      {/* Content */}
      {tab === "sugestoes" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-muted-foreground">Destino:</label>
            <select
              className="input-primary text-xs py-1.5"
              value={destinoSug}
              onChange={(e) => setDestinoSug(e.target.value as Deposito)}
            >
              {depositos.map((d) => (
                <option key={d} value={d}>{d} — {casaNome(d)}</option>
              ))}
            </select>
          </div>
          {sugestoesFiltradas.length === 0 ? (
            <EmptyState icon={PackageSearch} text={`Sem sugestões para ${destinoSug}. Todos os produtos estão acima do mínimo.`} />
          ) : (
            <div className="grid gap-2">
              {sugestoesFiltradas.map((s) => (
                <SugestaoCard
                  key={s.perfume.id}
                  perfume={s.perfume}
                  estoqueDestino={s.estoqueDestino}
                  falta={s.falta}
                  origensCandidatas={s.origensCandidatas}
                  destino={destinoSug}
                  onCriar={(origem, qtd) =>
                    handleCriarDeSugestao(
                      s.perfume.id,
                      `${s.perfume.marca} ${s.perfume.nome} ${s.perfume.volume}ml`,
                      origem,
                      destinoSug,
                      qtd
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "transito" && (
        <ReposicaoList
          items={[...reposicoesPorStatus.sugerida, ...reposicoesPorStatus.em_transito]}
          casaNome={casaNome}
          perfumes={perfumes}
          onEnviar={(id) => setEnviandoId(id)}
          onReceber={(id) => setRecebendoId(id)}
          onCancelar={async (id) => {
            if (!confirm("Cancelar esta reposição?")) return;
            await atualizar({ id, patch: { status: "cancelada" } });
          }}
          onRemover={isMaster ? (id) => remover(id) : undefined}
        />
      )}

      {tab === "recebidas" && (
        <ReposicaoList
          items={reposicoesPorStatus.recebida}
          casaNome={casaNome}
          perfumes={perfumes}
          onRemover={isMaster ? (id) => remover(id) : undefined}
        />
      )}

      {tab === "historico" && (
        <ReposicaoList
          items={reposicoes}
          casaNome={casaNome}
          perfumes={perfumes}
          onRemover={isMaster ? (id) => remover(id) : undefined}
        />
      )}
    </div>
  );
}

// ============ Subcomponentes ============

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="card p-8 text-center">
      <Icon size={32} className="text-muted-foreground mx-auto mb-2 opacity-50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SugestaoCard({
  perfume,
  estoqueDestino,
  falta,
  origensCandidatas,
  destino,
  onCriar,
}: {
  perfume: any;
  estoqueDestino: number;
  falta: number;
  origensCandidatas: Deposito[];
  destino: Deposito;
  onCriar: (origem: Deposito, qtd: number) => Promise<void>;
}) {
  const [origem, setOrigem] = useState<Deposito>(origensCandidatas[0]);
  const [qtd, setQtd] = useState(falta);
  const [saving, setSaving] = useState(false);

  const estoqueOrigem = perfume.estoques[origem] || 0;

  const handleClick = async () => {
    if (qtd < 1) return;
    setSaving(true);
    try {
      await onCriar(origem, Math.min(qtd, estoqueOrigem));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-3 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {perfume.codigo} — {perfume.marca} — {perfume.nome} — {perfume.concentracao} — {perfume.volume}ml
        </p>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
          <span>Estoque {destino}: <b className="text-amber-500">{estoqueDestino}</b></span>
          <span>Mín: {perfume.estoqueMinimo}</span>
          <span>Falta: <b className="text-foreground">{falta}</b></span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          className="input-primary text-xs py-1.5"
          value={origem}
          onChange={(e) => setOrigem(e.target.value as Deposito)}
        >
          {origensCandidatas.map((d) => (
            <option key={d} value={d}>{d} ({perfume.estoques[d] || 0})</option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={estoqueOrigem}
          className="input-primary text-xs py-1.5 w-16 no-spinner"
          value={qtd || ""}
          onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 0))}
          onWheel={(e) => (e.target as HTMLInputElement).blur()}
        />
        <button
          onClick={handleClick}
          disabled={saving || qtd < 1 || estoqueOrigem < 1}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : "Criar"}
        </button>
      </div>
    </div>
  );
}

function ReposicaoList({
  items,
  casaNome,
  perfumes,
  onEnviar,
  onReceber,
  onCancelar,
  onRemover,
}: {
  items: Reposicao[];
  casaNome: (s: string) => string;
  perfumes: any[];
  onEnviar?: (id: string) => void;
  onReceber?: (id: string) => void;
  onCancelar?: (id: string) => void;
  onRemover?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} text="Nenhuma reposição neste filtro." />;
  }
  return (
    <div className="grid gap-2">
      {items.map((r) => {
        const meta = STATUS_META[r.status];
        return (
          <div key={r.id} className="card p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.produto_nome}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.origem} → {r.destino} · Sug: <b>{r.quantidade_sugerida}</b>
                  {r.quantidade_enviada != null && <> · Env: <b>{r.quantidade_enviada}</b></>}
                  {r.quantidade_recebida != null && <> · Rec: <b>{r.quantidade_recebida}</b></>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Solicitado por {r.solicitado_por} · {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}
                  {r.conferido_por && <> · Enviado por {r.conferido_por}</>}
                  {r.recebido_por && <> · Recebido por {r.recebido_por}</>}
                </p>
                {r.observacao && (
                  <p className="text-[11px] text-muted-foreground italic mt-1">"{r.observacao}"</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.className} whitespace-nowrap`}>
                {meta.label}
              </span>
            </div>

            {(r.foto_saida_url || r.foto_chegada_url) && (
              <div className="flex gap-2 mt-2">
                {r.foto_saida_url && (
                  <div className="text-center">
                    <ReposicaoFotoPreview
                      path={r.foto_saida_url}
                      alt="Saída"
                      className="w-20 h-20 rounded-lg object-cover cursor-pointer"
                      onClick={() => window.open("", "_blank")}
                    />
                    <p className="text-[9px] text-muted-foreground mt-1">Saída</p>
                  </div>
                )}
                {r.foto_chegada_url && (
                  <div className="text-center">
                    <ReposicaoFotoPreview
                      path={r.foto_chegada_url}
                      alt="Chegada"
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <p className="text-[9px] text-muted-foreground mt-1">Chegada</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {r.status === "sugerida" && onEnviar && (
                <button onClick={() => onEnviar(r.id)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                  <Truck size={12} /> Enviar
                </button>
              )}
              {r.status === "em_transito" && onReceber && (
                <button onClick={() => onReceber(r.id)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Receber
                </button>
              )}
              {(r.status === "sugerida" || r.status === "em_transito") && onCancelar && (
                <button onClick={() => onCancelar(r.id)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                  <XCircle size={12} /> Cancelar
                </button>
              )}
              {onRemover && (
                <button onClick={() => { if (confirm("Excluir definitivamente?")) onRemover(r.id); }} className="text-xs px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-1">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EnviarModal({
  reposicao,
  onClose,
  onDone,
  uploadFn,
  nomeUsuario,
}: {
  reposicao: Reposicao;
  onClose: () => void;
  onDone: (qtdEnviada: number, path: string, conferente: string) => Promise<void>;
  uploadFn: (file: File, tipo: "saida" | "chegada") => Promise<string>;
  nomeUsuario: string;
}) {
  const { perfumes, baixarEstoque } = useApp();
  const [qtd, setQtd] = useState(reposicao.quantidade_sugerida);
  const [conferente, setConferente] = useState(nomeUsuario);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("Foto de saída é obrigatória");
      return;
    }
    if (qtd < 1) return;
    const p = perfumes.find((x) => x.id === reposicao.produto_id);
    const disponivel = p ? (p.estoques[reposicao.origem as Deposito] || 0) : 0;
    if (qtd > disponivel) {
      alert(`Estoque insuficiente em ${reposicao.origem}. Disponível: ${disponivel}`);
      return;
    }
    setSaving(true);
    try {
      const path = await uploadFn(file, "saida");
      await onDone(qtd, path, conferente);
      // baixa estoque origem
      if (p) await baixarEstoque(reposicao.produto_id, reposicao.origem as Deposito, qtd);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Truck size={16} className="text-gold" /> Enviar</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">{reposicao.produto_nome}</p>
        <p className="text-xs">{reposicao.origem} → {reposicao.destino}</p>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Qtd enviada</label>
          <input
            type="number"
            min={1}
            className="input-primary w-full no-spinner"
            value={qtd || ""}
            onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 0))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Conferente (quem está enviando)</label>
          <input
            type="text"
            className="input-primary w-full"
            value={conferente}
            onChange={(e) => setConferente(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Foto de saída (obrigatória)</label>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-lg" />
              <button onClick={() => { setFile(null); setPreview(""); }} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full">
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gold text-muted-foreground">
              <Camera size={24} />
              <span className="text-xs mt-1">Tirar foto / anexar</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <button onClick={handleSubmit} disabled={saving || !file} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
          {saving ? "Enviando..." : "Confirmar envio"}
        </button>
      </div>
    </div>
  );
}

function ReceberModal({
  reposicao,
  onClose,
  onDone,
  uploadFn,
  nomeUsuario,
}: {
  reposicao: Reposicao;
  onClose: () => void;
  onDone: (qtdRecebida: number, path: string, recebedor: string) => Promise<void>;
  uploadFn: (file: File, tipo: "saida" | "chegada") => Promise<string>;
  nomeUsuario: string;
}) {
  const { adicionarEstoque } = useApp();
  const [qtd, setQtd] = useState(reposicao.quantidade_enviada || reposicao.quantidade_sugerida);
  const [recebedor, setRecebedor] = useState(nomeUsuario);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("Foto de chegada é obrigatória");
      return;
    }
    if (qtd < 1) return;
    setSaving(true);
    try {
      const path = await uploadFn(file, "chegada");
      await onDone(qtd, path, recebedor);
      // adiciona no destino
      await adicionarEstoque(reposicao.produto_id, reposicao.destino as Deposito, qtd);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" /> Receber</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">{reposicao.produto_nome}</p>
        <p className="text-xs">{reposicao.origem} → {reposicao.destino}</p>
        <p className="text-[11px] text-muted-foreground">Qtd enviada: <b className="text-foreground">{reposicao.quantidade_enviada}</b></p>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Qtd recebida (confira)</label>
          <input
            type="number"
            min={1}
            className="input-primary w-full no-spinner"
            value={qtd || ""}
            onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 0))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
          />
          {reposicao.quantidade_enviada != null && qtd !== reposicao.quantidade_enviada && (
            <p className="text-[10px] text-amber-500 mt-1">
              ⚠ Divergência: {qtd - (reposicao.quantidade_enviada || 0)} unidade(s)
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Recebedor</label>
          <input
            type="text"
            className="input-primary w-full"
            value={recebedor}
            onChange={(e) => setRecebedor(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Foto de chegada (obrigatória)</label>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="preview" className="w-full h-40 object-cover rounded-lg" />
              <button onClick={() => { setFile(null); setPreview(""); }} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full">
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gold text-muted-foreground">
              <Camera size={24} />
              <span className="text-xs mt-1">Tirar foto / anexar</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <button onClick={handleSubmit} disabled={saving || !file} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {saving ? "Recebendo..." : "Confirmar recebimento"}
        </button>
      </div>
    </div>
  );
}
