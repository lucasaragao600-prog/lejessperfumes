import { useMemo, useState } from "react";
import { Camera, Search, Plus, Minus, Trash2, CheckCircle2, Loader2, PackageOpen, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useReposicao, STATUS_META, TIPOS_DIVERGENCIA, type Reposicao } from "@/hooks/useReposicao";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import { uploadReposicaoFoto } from "@/hooks/useReposicao";
import { formatarDataHora, produtoLabel } from "@/lib/reposicaoUtils";

export default function ReceberReposicao() {
  const { perfumes, concentracoesConfig } = useApp();
  const { profile, user } = useAuth();
  const { can } = usePermissoes();
  const {
    reposicoes,
    itens,
    conferencias,
    registrarConferencia,
    removerConferencia,
    finalizarConferencia,
    registrarDivergencia,
  } = useReposicao();

  const usuario = { id: user?.id, nome: profile?.nome || user?.email || "Sistema" };
  const [ativa, setAtiva] = useState<Reposicao | null>(null);
  const [busca, setBusca] = useState("");
  const [scanner, setScanner] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const pendentes = reposicoes.filter((r) => ["aguardando_conferencia", "em_conferencia"].includes(r.status));
  const rep = ativa ? reposicoes.find((r) => r.id === ativa.id) || ativa : null;
  const meusItens = useMemo(() => (rep ? itens.filter((i) => i.reposicao_id === rep.id) : []), [itens, rep]);
  const lidos = useMemo(() => (rep ? conferencias.filter((c) => c.reposicao_id === rep.id) : []), [conferencias, rep]);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    const termos = q.split(/\s+/);
    return perfumes
      .filter((p) => `${p.codigo} ${p.codigoBarras || ""} ${p.nome} ${p.marca}`.toLowerCase().split(/\s+/).join(" ").includes(q) ||
        termos.every((t) => `${p.codigo} ${p.codigoBarras || ""} ${p.nome} ${p.marca}`.toLowerCase().includes(t)))
      .slice(0, 12);
  }, [busca, perfumes]);

  const registrar = async (produtoId: string, delta = 1) => {
    if (!rep) return;
    const p = perfumes.find((x) => x.id === produtoId);
    if (!p) return;
    const atual = lidos.find((c) => c.produto_id === produtoId)?.quantidade ?? 0;
    const nova = atual + delta;
    if (nova <= 0) {
      const existente = lidos.find((c) => c.produto_id === produtoId);
      if (existente) await removerConferencia(existente.id);
      return;
    }
    await registrarConferencia({
      reposicao: rep,
      produto_id: produtoId,
      produto_nome: produtoLabel(p, concentracoesConfig),
      quantidade: nova,
      usuario,
    });
    setBusca("");
  };

  const onScan = async (codigo: string) => {
    const p = perfumes.find((x) => (x.codigoBarras || "").trim() === codigo.trim());
    if (!p) return toast.error("Produto não encontrado para este código de barras.");
    await registrar(p.id, 1);
    toast.success(`${p.nome} registrado`);
  };

  const finalizar = async () => {
    if (!rep) return;
    setCarregando(true);
    try {
      await finalizarConferencia({ reposicao: rep, itensRep: meusItens, lidos, usuario });
      setComparando(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível finalizar a conferência.");
    } finally {
      setCarregando(false);
    }
  };

  const comparacao = meusItens.map((i) => {
    const esperado = i.quantidade_enviada ?? i.quantidade_solicitada;
    const recebido = lidos.find((c) => c.produto_id === i.produto_id)?.quantidade ?? 0;
    return {
      item: i,
      esperado,
      recebido,
      situacao: recebido === esperado ? "OK" : recebido < esperado ? "FALTANDO" : "EXCEDENTE",
    };
  });
  const extras = lidos.filter((c) => !meusItens.some((i) => i.produto_id === c.produto_id));

  if (!rep) {
    return (
      <div className="space-y-3">
        {pendentes.length === 0 && (
          <div className="card-premium p-8 text-center text-sm text-muted-foreground">
            <PackageOpen size={28} className="mx-auto mb-3 opacity-40" />
            Nenhuma reposição aguardando conferência.
          </div>
        )}
        {pendentes.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              if (!can("reposicao_receber") && !can("reposicao_conferir")) {
                return toast.error("Você não tem permissão para receber reposições.");
              }
              setAtiva(r);
              setComparando(false);
            }}
            className="card-premium w-full text-left p-4 hover:border-gold/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{r.codigo}</p>
                <p className="text-[11px] text-muted-foreground">{r.origem} → {r.destino}</p>
                <p className="text-[11px] text-muted-foreground">Enviada em {formatarDataHora(r.enviado_em)}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full border ${STATUS_META[r.status]?.className}`}>
                {STATUS_META[r.status]?.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (comparando) {
    return (
      <ComparacaoConferencia
        rep={rep}
        comparacao={comparacao}
        extras={extras}
        onVoltar={() => {
          setAtiva(null);
          setComparando(false);
        }}
        registrarDivergencia={registrarDivergencia}
        usuario={usuario}
      />
    );
  }

  const totalLido = lidos.reduce((s, c) => s + c.quantidade, 0);

  return (
    <div className="space-y-4 pb-28">
      <button onClick={() => setAtiva(null)} className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="card-premium p-4">
        <p className="text-sm font-semibold text-foreground">{rep.codigo}</p>
        <p className="text-[11px] text-muted-foreground">Origem: {rep.origem} · Destino: {rep.destino}</p>
        <p className="text-xs text-gold mt-2">Escaneie ou informe os produtos que você recebeu.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          A quantidade enviada só aparece depois de finalizar a conferência.
        </p>
      </div>

      <button onClick={() => setScanner(true)} className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-sm">
        <Camera size={18} /> Bipar produto
      </button>

      <div className="card-premium p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto recebido"
            className="input-premium w-full pl-9 bg-surface text-foreground"
          />
        </div>
        {resultados.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {resultados.map((p) => (
              <button key={p.id} onClick={() => registrar(p.id, 1)} className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface-raised">
                {produtoLabel(p, concentracoesConfig)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lidos.map((c) => (
          <div key={c.id} className="card-premium p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-foreground break-words flex-1">{c.produto_nome}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => registrar(c.produto_id, -1)} className="btn-secondary w-10 h-10 flex items-center justify-center">
                <Minus size={15} />
              </button>
              <span className="w-8 text-center text-base font-semibold text-foreground">{c.quantidade}</span>
              <button onClick={() => registrar(c.produto_id, 1)} className="btn-secondary w-10 h-10 flex items-center justify-center">
                <Plus size={15} />
              </button>
              <button onClick={() => removerConferencia(c.id)} className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {lidos.length === 0 && (
          <div className="card-premium p-8 text-center text-sm text-muted-foreground">
            Nenhum produto conferido ainda.
          </div>
        )}
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-60 px-4 py-3 bg-background border-t border-border flex items-center justify-between gap-3 z-40">
        <span className="text-xs text-muted-foreground">{totalLido} unidade(s) conferida(s)</span>
        <button onClick={finalizar} disabled={carregando} className="btn-primary px-5 py-3 text-sm flex items-center gap-2">
          {carregando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Finalizar conferência
        </button>
      </div>

      <BarcodeScannerDialog open={scanner} onClose={() => setScanner(false)} onDetected={onScan} />
    </div>
  );
}

interface ComparacaoProps {
  rep: Reposicao;
  comparacao: { item: { id: string; produto_id: string; produto_nome: string }; esperado: number; recebido: number; situacao: string }[];
  extras: { id: string; produto_id: string; produto_nome: string; quantidade: number }[];
  onVoltar: () => void;
  usuario: { id?: string; nome: string };
  registrarDivergencia: ReturnType<typeof useReposicao>["registrarDivergencia"];
}

function ComparacaoConferencia({ rep, comparacao, extras, onVoltar, usuario, registrarDivergencia }: ComparacaoProps) {
  const [tipo, setTipo] = useState<string>(TIPOS_DIVERGENCIA[0]);
  const [justificativa, setJustificativa] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [registradas, setRegistradas] = useState<string[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const divergentes = comparacao.filter((c) => c.situacao !== "OK");

  const salvar = async (linha: ComparacaoProps["comparacao"][number]) => {
    if (justificativa.trim().length < 3) return toast.error("Descreva o que aconteceu.");
    setSalvando(true);
    try {
      let fotoPath: string | null = null;
      if (foto) fotoPath = await uploadReposicaoFoto(foto, rep.id, "divergencia");
      await registrarDivergencia({
        reposicao_id: rep.id,
        produto_id: linha.item.produto_id,
        produto_nome: linha.item.produto_nome,
        tipo,
        quantidade_esperada: linha.esperado,
        quantidade_recebida: linha.recebido,
        justificativa: justificativa.trim(),
        foto_url: fotoPath,
        usuario,
      });
      setRegistradas((prev) => [...prev, linha.item.id]);
      setJustificativa("");
      setFoto(null);
      setSelecionado(null);
      toast.success("Divergência registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a divergência.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-premium p-4">
        <p className="text-sm font-semibold text-foreground">{rep.codigo} · Comparação</p>
        <p className="text-[11px] text-muted-foreground">{rep.origem} → {rep.destino}</p>
      </div>

      <div className="card-premium p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-raised text-muted-foreground">
            <tr>
              <th className="text-left p-3">Produto</th>
              <th className="p-3">Enviado</th>
              <th className="p-3">Recebido</th>
              <th className="p-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {comparacao.map((c) => (
              <tr key={c.item.id} className="border-t border-border">
                <td className="p-3 text-foreground">{c.item.produto_nome}</td>
                <td className="p-3 text-center text-foreground">{c.esperado}</td>
                <td className="p-3 text-center text-foreground">{c.recebido}</td>
                <td className={`p-3 text-center ${c.situacao === "OK" ? "text-emerald-400" : "text-destructive"}`}>{c.situacao}</td>
              </tr>
            ))}
            {extras.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 text-foreground">{e.produto_nome}</td>
                <td className="p-3 text-center text-muted-foreground">0</td>
                <td className="p-3 text-center text-foreground">{e.quantidade}</td>
                <td className="p-3 text-center text-destructive">NÃO ENVIADO</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {divergentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-destructive">Registrar divergências</p>
          {divergentes.map((c) => (
            <div key={c.item.id} className="card-premium p-3 space-y-2">
              <p className="text-sm text-foreground">{c.item.produto_nome}</p>
              <p className="text-[11px] text-muted-foreground">Enviado {c.esperado} · Recebido {c.recebido}</p>
              {registradas.includes(c.item.id) ? (
                <p className="text-[11px] text-emerald-400">Divergência registrada.</p>
              ) : selecionado === c.item.id ? (
                <div className="space-y-2">
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-premium w-full bg-surface text-foreground text-xs">
                    {TIPOS_DIVERGENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={2}
                    placeholder="Observação obrigatória"
                    className="input-premium w-full bg-surface text-foreground text-xs"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setFoto(e.target.files?.[0] || null)}
                    className="text-[11px] text-muted-foreground"
                  />
                  <button onClick={() => salvar(c)} disabled={salvando} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
                    {salvando && <Loader2 size={13} className="animate-spin" />} Registrar divergência
                  </button>
                </div>
              ) : (
                <button onClick={() => setSelecionado(c.item.id)} className="btn-secondary px-4 py-2 text-xs">
                  Registrar divergência
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={onVoltar} className="btn-secondary px-5 py-2.5 text-xs">Concluir</button>
    </div>
  );
}
