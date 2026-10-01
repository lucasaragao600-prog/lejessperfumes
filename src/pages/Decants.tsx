import { DialogoTesterFrasco } from "@/components/decants/DecantTesterFrasco";
import { ModelosEtiquetaConfig } from "@/components/decants/DecantsEtiquetas";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Droplets, PackageOpen, ClipboardCheck, History, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { useApp } from "@/context/AppContext";
import { useUnidades } from "@/hooks/useUnidades";
import {
  useDecantConfig, useSalvarDecantConfig, useFrascosAbertos, useFechadosSaldo, useHistoricoFrasco,
  usePerfumeConfigs, useSalvarPerfumeConfig, useTamanhos, useSalvarTamanho, useDestinar, useAbrirFrasco,
  useSaidaMl, useConferir, useDecidirConferencia, type FrascoAberto, type DecantTamanho, type DecantConfig,
} from "@/hooks/useDecants";
import { custoPorMl, fmtBRL, fmtMl, ROTULO_MOV_ML, TIPOS_SAIDA_ML } from "@/lib/decants";
import { getHojeManaus as hojeManaus } from "@/lib/dateUtils";
import { AbaProducao, AbaLotes } from "@/components/decants/DecantsProducao";
import { AbaEstoqueDecants, AbaMovimentacoesDecant, AbaVendasDecant, AbaTransferenciasDecant } from "@/components/decants/DecantsOperacao";
import { AbaReposicaoDecant, PainelAlertasDecant } from "@/components/decants/DecantsReposicao";
import { useAlertasDecant } from "@/hooks/useDecants";
import { AbaDashboardDecants, AbaPerdasDecant, AbaRentabilidadeDecant, AbaRelatoriosDecant, Perfume360 } from "@/components/decants/DecantsAnalise";

const ABAS = [
  { id: "dashboard", label: "Dashboard" }, { id: "perfumes", label: "Perfumes" },
  { id: "frascos", label: "Frascos Abertos" }, { id: "producao", label: "Produção" },
  { id: "lotes", label: "Lotes" }, { id: "estoque", label: "Estoque de Decants" },
  { id: "movimentacoes", label: "Movimentações" }, { id: "transferencias", label: "Transferências" }, { id: "perdas", label: "Perdas" },
  { id: "reposicao", label: "Reposição" }, { id: "vendas", label: "Vendas" }, { id: "rentabilidade", label: "Rentabilidade" },
  { id: "relatorios", label: "Relatórios" }, { id: "configuracoes", label: "Configurações" },
];
const PRONTAS = new Set(["perfumes", "frascos", "producao", "lotes", "estoque", "movimentacoes", "vendas", "transferencias", "configuracoes",
  "dashboard", "perdas", "reposicao", "rentabilidade", "relatorios"]);

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
const blurWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>
);

export default function Decants() {
  const [aba, setAba] = useState("dashboard");
  const { data: cfg } = useDecantConfig();
  const { data: alertas } = useAlertasDecant(null);
  const contagem = (id: string) => (alertas?.alertas ?? []).filter((a) => a.aba === id).reduce((s, a) => s + a.qtd, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><Droplets className="w-6 h-6 text-gold" /> Decants</h1>
          <p className="page-subtitle">Venda fracionada a partir de frascos abertos</p>
        </div>
        <span className={`pill ${cfg?.ativo ? "pill-active" : "pill-inactive"}`}>
          {cfg?.ativo ? "Módulo ligado" : "Módulo desligado (só Master vê)"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`pill whitespace-nowrap ${aba === a.id ? "pill-active" : "pill-inactive"}`}>
            {a.label}{!PRONTAS.has(a.id) && <span className="ml-1 text-[10px] opacity-70">em breve</span>}
            {a.id === "dashboard" && !!alertas?.total && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{alertas.total}</span>}
            {a.id !== "dashboard" && contagem(a.id) > 0 && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{contagem(a.id)}</span>}
          </button>
        ))}
      </div>
      {aba === "frascos" && <AbaFrascos />}
      {aba === "perfumes" && <AbaPerfumes />}
      {aba === "producao" && <AbaProducao />}
      {aba === "lotes" && <AbaLotes />}
      {aba === "estoque" && <AbaEstoqueDecants />}
      {aba === "movimentacoes" && <AbaMovimentacoesDecant />}
      {aba === "vendas" && <AbaVendasDecant />}
      {aba === "transferencias" && <AbaTransferenciasDecant />}
      {aba === "configuracoes" && <div className="space-y-4"><AbaConfiguracoes /><ModelosEtiquetaConfig /></div>}
      {aba === "dashboard" && <div className="space-y-4"><PainelAlertasDecant onIr={setAba} /><AbaDashboardDecants /></div>}
      {aba === "perdas" && <AbaPerdasDecant />}
      {aba === "rentabilidade" && <AbaRentabilidadeDecant />}
      {aba === "relatorios" && <AbaRelatoriosDecant />}
      {aba === "reposicao" && <AbaReposicaoDecant />}
      {!PRONTAS.has(aba) && (
        <div className="card-premium p-10 text-center text-muted-foreground">
          <p className="font-medium text-foreground">Em breve</p>
          <p className="text-sm mt-1">Esta parte será liberada nas próximas fases.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Frascos ---------------- */
function AbaFrascos() {
  const { unidadesEstoque } = useUnidades();
  const [unidade, setUnidade] = useState<string>("");
  const { data: frascos = [], isLoading, error } = useFrascosAbertos(unidade || null);
  const { data: fechados = [] } = useFechadosSaldo();
  const { perfumes } = useApp();
  const [dialogo, setDialogo] = useState<null | "destinar" | "abrir" | "tester">(null);
  const [sel, setSel] = useState<FrascoAberto | null>(null);
  const nomeProd = (id: string) => { const p = perfumes.find((x) => x.id === id); return p ? `${p.marca} - ${p.nome} ${p.volume}ml` : id; };
  const nomeUn = (id: string) => unidadesEstoque.find((u) => u.id === id)?.nomeExibicao || "";
  const fechadosFiltro = fechados.filter((f) => !unidade || f.unidade_id === unidade);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input-premium max-w-xs" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
          <option value="">Todas as filiais</option>
          {unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn-secondary px-4 py-2 text-sm" onClick={() => setDialogo("destinar")}>
          <Plus className="w-4 h-4 inline mr-1" />Destinar para decants</button>
        <button className="btn-secondary px-4 py-2 text-sm" onClick={() => setDialogo("tester")}>
          <Droplets className="w-4 h-4 inline mr-1" />Usar tester</button>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setDialogo("abrir")}>
          <PackageOpen className="w-4 h-4 inline mr-1" />Abrir frasco</button>
      </div>

      {fechadosFiltro.length > 0 && (
        <div className="card-premium p-4">
          <p className="text-sm font-medium mb-2">Frascos fechados reservados para decants</p>
          <div className="grid gap-1 text-sm">
            {fechadosFiltro.map((f) => (
              <div key={f.produto_id + f.unidade_id} className="flex justify-between gap-2">
                <span className="truncate">{nomeProd(f.produto_id)} <span className="text-muted-foreground">· {nomeUn(f.unidade_id)}</span></span>
                <span className="font-semibold">{f.quantidade} un</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : error ? <div className="card-premium p-8 text-center text-destructive">Não foi possível carregar os frascos.</div>
        : frascos.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhum frasco aberto ainda.</div>
        : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {frascos.map((f) => {
              const pct = f.volume_inicial_ml ? (f.saldo_ml / f.volume_inicial_ml) * 100 : 0;
              const critico = f.saldo_ml > 0 && pct <= 15;
              const status = f.status === "bloqueado" ? "Bloqueado" : f.saldo_ml <= 0 ? "Esgotado" : critico ? "Volume crítico" : "Aberto";
              return (
                <button key={f.id} onClick={() => setSel(f)} className="card-premium p-4 text-left hover:border-gold transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-gold text-sm">{f.codigo}</span>
                    <span className={`text-xs ${status === "Aberto" ? "text-success" : "text-destructive"}`}>{status}</span>
                  </div>
                  <p className="font-medium mt-1 truncate">{f.marca} - {f.nome}</p>
                  <p className="text-xs text-muted-foreground">{f.concentracao} · {f.unidade_nome}</p>
                  <div className="mt-3 h-2 rounded-full bg-surface-raised overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span>{fmtMl(f.saldo_ml)} de {fmtMl(f.volume_inicial_ml)}</span>
                    <span className="text-muted-foreground">{fmtBRL(f.custo_ml)}/ml</span>
                  </div>
                  {f.pendencias > 0 && <p className="text-xs text-destructive mt-1">{f.pendencias} divergência(s) aguardando aprovação</p>}
                </button>
              );
            })}
          </div>
        )}

      {dialogo === "destinar" && <DialogoDestinar onClose={() => setDialogo(null)} />}
      {dialogo === "abrir" && <DialogoAbrir onClose={() => setDialogo(null)} fechados={fechados} nomeProd={nomeProd} nomeUn={nomeUn} />}
      {sel && <DialogoFrasco frasco={frascos.find((x) => x.id === sel.id) || sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DialogoDestinar({ onClose }: { onClose: () => void }) {
  const { perfumes, concentracoesConfig } = useApp();
  const { unidadesEstoque } = useUnidades();
  const destinar = useDestinar();
  const [f, setF] = useState({ produtoId: "", unidadeId: "", quantidade: "1", responsavel: "", data: hojeManaus(), observacao: "" });
  const salvar = async () => {
    const q = parseInt(f.quantidade);
    if (!f.produtoId || !f.unidadeId || !(q > 0)) return toast.error("Informe perfume, filial e quantidade.");
    try {
      const r = await destinar.mutateAsync({ ...f, quantidade: q });
      toast.success(`Destinado. Frascos fechados para decant: ${r.saldo_fechados}`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Destinar frascos para decants</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo label="Perfume"><PerfumeSearchSelect perfumes={perfumes} value={f.produtoId} concentracoesConfig={concentracoesConfig}
            onChange={(id) => setF({ ...f, produtoId: id })} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Filial"><select className="input-premium" value={f.unidadeId} onChange={(e) => setF({ ...f, unidadeId: e.target.value })}>
              <option value="">Selecione</option>{unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}</select></Campo>
            <Campo label="Quantidade de frascos"><input type="number" min={1} onWheel={blurWheel} className="input-premium" value={f.quantidade}
              onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></Campo>
            <Campo label="Responsável"><input className="input-premium" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Campo>
            <Campo label="Data"><input type="date" className="input-premium" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          </div>
          <Campo label="Observação"><input className="input-premium" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
          <p className="text-xs text-muted-foreground">O estoque normal da filial diminui e os frascos ficam reservados para decants, ainda lacrados.</p>
          <button className="btn-primary w-full py-2.5" disabled={destinar.isPending} onClick={salvar}>
            {destinar.isPending ? "Salvando…" : "Confirmar"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoAbrir({ onClose, fechados, nomeProd, nomeUn }: {
  onClose: () => void; fechados: { produto_id: string; unidade_id: string; quantidade: number }[];
  nomeProd: (id: string) => string; nomeUn: (id: string) => string;
}) {
  const abrir = useAbrirFrasco();
  const { perfumes } = useApp();
  const { data: cfgs = [] } = usePerfumeConfigs();
  const [k, setK] = useState("");
  const [f, setF] = useState({ loteFabricante: "", validade: "", volumeInicial: "", responsavel: "", observacao: "" });
  const atual = fechados.find((x) => x.produto_id + "|" + x.unidade_id === k);
  const p = atual && perfumes.find((x) => x.id === atual.produto_id);
  const rend = (atual && cfgs.find((c) => c.produto_id === atual.produto_id)?.rendimento_util) || 100;
  const custo = p ? (p.custoMedio || p.custo) : 0;
  const salvar = async () => {
    if (!atual) return toast.error("Escolha um frasco fechado reservado para decants.");
    const vol = f.volumeInicial ? num(f.volumeInicial) : null;
    if (vol !== null && !(vol > 0)) return toast.error("Volume inicial inválido.");
    try {
      const r = await abrir.mutateAsync({ produtoId: atual.produto_id, unidadeId: atual.unidade_id, ...f, volumeInicial: vol });
      toast.success(`Frasco ${r.codigo} aberto.`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Abrir frasco para produção</DialogTitle></DialogHeader>
        {fechados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum frasco fechado reservado. Use "Destinar para decants" primeiro.</p>
        ) : (
          <div className="space-y-3">
            <Campo label="Frasco fechado reservado"><select className="input-premium" value={k} onChange={(e) => setK(e.target.value)}>
              <option value="">Selecione</option>
              {fechados.map((x) => <option key={x.produto_id + x.unidade_id} value={x.produto_id + "|" + x.unidade_id}>
                {nomeProd(x.produto_id)} · {nomeUn(x.unidade_id)} ({x.quantidade})</option>)}
            </select></Campo>
            {p && <div className="text-sm grid grid-cols-3 gap-2 card-premium p-3">
              <div><p className="text-xs text-muted-foreground">Volume</p>{p.volume} ml</div>
              <div><p className="text-xs text-muted-foreground">Custo</p>{fmtBRL(custo)}</div>
              <div><p className="text-xs text-muted-foreground">Custo/ml</p>{fmtBRL(custoPorMl(custo, p.volume, rend))}</div>
            </div>}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Lote do fabricante (opcional)"><input className="input-premium" value={f.loteFabricante} onChange={(e) => setF({ ...f, loteFabricante: e.target.value })} /></Campo>
              <Campo label="Validade (opcional)"><input type="date" className="input-premium" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} /></Campo>
              <Campo label={`Volume inicial (padrão ${p?.volume ?? "-"} ml)`}><input inputMode="decimal" className="input-premium" value={f.volumeInicial} onChange={(e) => setF({ ...f, volumeInicial: e.target.value })} /></Campo>
              <Campo label="Responsável"><input className="input-premium" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Campo>
            </div>
            <Campo label="Observação"><input className="input-premium" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
            <button className="btn-primary w-full py-2.5" disabled={abrir.isPending} onClick={salvar}>{abrir.isPending ? "Abrindo…" : "Abrir e gerar código FR"}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogoFrasco({ frasco, onClose }: { frasco: FrascoAberto; onClose: () => void }) {
  const { data, isLoading } = useHistoricoFrasco(frasco.id);
  const saida = useSaidaMl(); const conferir = useConferir(); const decidir = useDecidirConferencia();
  const [modo, setModo] = useState<"historico" | "saida" | "conferir">("historico");
  const [s, setS] = useState({ tipo: "tester", ml: "", motivo: "" });
  const [c, setC] = useState({ fisico: "", justificativa: "", acao: "manter_pendente" });
  const dif = Number.isNaN(num(c.fisico)) ? null : Math.round((num(c.fisico) - frasco.saldo_ml) * 1000) / 1000;

  const registrarSaida = async () => {
    const ml = num(s.ml);
    if (!(ml > 0)) return toast.error("Informe os ml.");
    try { await saida.mutateAsync({ frascoId: frasco.id, tipo: s.tipo, ml, motivo: s.motivo }); toast.success("Saída registrada."); setS({ ...s, ml: "", motivo: "" }); setModo("historico"); }
    catch (e: any) { toast.error(e.message); }
  };
  const registrarConferencia = async () => {
    const fis = num(c.fisico);
    if (!(fis >= 0)) return toast.error("Informe o saldo físico.");
    try {
      const r = await conferir.mutateAsync({ frascoId: frasco.id, saldoFisico: fis, justificativa: c.justificativa, acao: c.acao });
      toast.success(r.status === "pendente" ? "Divergência registrada, aguardando aprovação." : r.status === "ok" ? "Conferência sem diferença." : "Ajustado dentro da tolerância.");
      setModo("historico");
    } catch (e: any) { toast.error(e.message); }
  };
  const decidirConf = async (id: string, aprovar: boolean, acao: string) => {
    try { await decidir.mutateAsync({ id, aprovar, acao, obs: "" }); toast.success(aprovar ? "Aprovado." : "Rejeitado."); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle><span className="font-mono text-gold">{frasco.codigo}</span> · {frasco.marca} - {frasco.nome}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="kpi-card p-3"><p className="text-xs text-muted-foreground">Saldo teórico</p><p className="font-semibold">{fmtMl(frasco.saldo_ml)}</p></div>
          <div className="kpi-card p-3"><p className="text-xs text-muted-foreground">Volume inicial</p><p>{fmtMl(frasco.volume_inicial_ml)}</p></div>
          <div className="kpi-card p-3"><p className="text-xs text-muted-foreground">Custo/ml</p><p>{fmtBRL(frasco.custo_ml)}</p></div>
          <div className="kpi-card p-3"><p className="text-xs text-muted-foreground">Filial</p><p className="truncate">{frasco.unidade_nome}</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Aberto em {new Date(frasco.aberto_em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} por {frasco.aberto_por_nome}
          {frasco.lote_fabricante && ` · Lote ${frasco.lote_fabricante}`}{frasco.validade && ` · Validade ${frasco.validade.split("-").reverse().join("/")}`}</p>
        <div className="flex gap-2">
          <button className={`pill ${modo === "historico" ? "pill-active" : "pill-inactive"}`} onClick={() => setModo("historico")}><History className="w-3 h-3 inline mr-1" />Histórico</button>
          <button className={`pill ${modo === "saida" ? "pill-active" : "pill-inactive"}`} onClick={() => setModo("saida")}>Registrar saída</button>
          <button className={`pill ${modo === "conferir" ? "pill-active" : "pill-inactive"}`} onClick={() => setModo("conferir")}><ClipboardCheck className="w-3 h-3 inline mr-1" />Conferir</button>
        </div>

        {modo === "saida" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo"><select className="input-premium" value={s.tipo} onChange={(e) => setS({ ...s, tipo: e.target.value })}>
                {TIPOS_SAIDA_ML.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Campo>
              <Campo label="Quantidade (ml)"><input inputMode="decimal" className="input-premium" value={s.ml} onChange={(e) => setS({ ...s, ml: e.target.value })} /></Campo>
            </div>
            <Campo label="Motivo"><input className="input-premium" value={s.motivo} onChange={(e) => setS({ ...s, motivo: e.target.value })} /></Campo>
            <button className="btn-primary w-full py-2.5" disabled={saida.isPending} onClick={registrarSaida}>Registrar</button>
          </div>
        )}

        {modo === "conferir" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 items-end">
              <Campo label="Saldo teórico"><input className="input-premium" disabled value={fmtMl(frasco.saldo_ml)} /></Campo>
              <Campo label="Saldo físico (ml)"><input inputMode="decimal" className="input-premium" value={c.fisico} onChange={(e) => setC({ ...c, fisico: e.target.value })} /></Campo>
              <Campo label="Diferença"><input className={`input-premium ${dif && dif < 0 ? "text-destructive" : ""}`} disabled value={dif === null ? "" : `${dif > 0 ? "+" : ""}${fmtMl(dif)}`} /></Campo>
            </div>
            <Campo label="Justificativa (obrigatória se houver diferença acima da tolerância)"><input className="input-premium" value={c.justificativa} onChange={(e) => setC({ ...c, justificativa: e.target.value })} /></Campo>
            <Campo label="O que fazer com a diferença"><select className="input-premium" value={c.acao} onChange={(e) => setC({ ...c, acao: e.target.value })}>
              <option value="manter_pendente">Manter pendente para aprovação</option>
              <option value="ajuste">Solicitar ajuste de estoque</option>
              <option value="perda">Solicitar registro como perda</option>
            </select></Campo>
            <button className="btn-primary w-full py-2.5" disabled={conferir.isPending} onClick={registrarConferencia}>Registrar conferência</button>
          </div>
        )}

        {modo === "historico" && (isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-4">
            {(data?.conferencias || []).filter((x: any) => x.status === "pendente").map((x: any) => (
              <div key={x.id} className="card-alert p-3 text-sm space-y-2">
                <p><b>Divergência {fmtMl(x.diferenca)}</b> (teórico {fmtMl(x.saldo_teorico)}, físico {fmtMl(x.saldo_fisico)}) · {x.executado_por_nome}</p>
                <p className="text-muted-foreground">{x.justificativa}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => decidirConf(x.id, true, "ajuste")}>Aprovar como ajuste</button>
                  {Number(x.diferenca) < 0 && <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => decidirConf(x.id, true, "perda")}>Aprovar como perda</button>}
                  <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => decidirConf(x.id, false, "")}>Rejeitar</button>
                </div>
              </div>
            ))}
            <div className="divide-y divide-border text-sm">
              {(data?.movimentos || []).slice().reverse().map((m: any) => (
                <div key={m.id} className="py-2 flex justify-between gap-2">
                  <div className="min-w-0">
                    <p>{ROTULO_MOV_ML[m.tipo] || m.tipo}{m.motivo && <span className="text-muted-foreground"> · {m.motivo}</span>}</p>
                    <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} · {m.usuario_nome}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={Number(m.ml) < 0 ? "text-destructive" : "text-success"}>{Number(m.ml) > 0 ? "+" : ""}{fmtMl(m.ml)}</p>
                    <p className="text-xs text-muted-foreground">saldo {fmtMl(m.saldo_apos)}</p>
                  </div>
                </div>
              ))}
            </div>
            {(data?.conferencias || []).filter((x: any) => x.status !== "pendente").length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-sm">Conferências</p>
                {(data?.conferencias || []).filter((x: any) => x.status !== "pendente").map((x: any) => (
                  <p key={x.id}>{new Date(x.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}: físico {fmtMl(x.saldo_fisico)}, diferença {fmtMl(x.diferenca)} · {x.status}
                    {x.aprovado_por_nome && ` por ${x.aprovado_por_nome}`} (executado por {x.executado_por_nome})</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Perfumes ---------------- */
function AbaPerfumes() {
  const { perfumes, concentracoesConfig } = useApp();
  const { data: cfgs = [] } = usePerfumeConfigs();
  const salvar = useSalvarPerfumeConfig();
  const [busca, setBusca] = useState("");
  const [soElegiveis, setSoElegiveis] = useState(true);
  const [novo, setNovo] = useState("");
  const mapa = useMemo(() => new Map(cfgs.map((c) => [c.produto_id, c])), [cfgs]);
  const [ver360, setVer360] = useState<string | null>(null);
  const lista = useMemo(() => {
    const t = busca.toLowerCase().trim();
    return perfumes.filter((p) => (!soElegiveis || mapa.get(p.id)?.elegivel)
      && (!t || `${p.codigo} ${p.marca} ${p.nome}`.toLowerCase().includes(t))).slice(0, 60);
  }, [perfumes, busca, soElegiveis, mapa]);

  const atualizar = async (produtoId: string, patch: Partial<{ elegivel: boolean; ativo: boolean; estoque_minimo_ml: number; rendimento_util: number }>) => {
    const atual = mapa.get(produtoId) || { produto_id: produtoId, elegivel: false, ativo: true, estoque_minimo_ml: 0, rendimento_util: 100 };
    try { await salvar.mutateAsync({ ...atual, ...patch, produto_id: produtoId }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="card-premium p-4 space-y-2">
        <p className="text-sm font-medium">Tornar perfume elegível para decant</p>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[240px]"><PerfumeSearchSelect perfumes={perfumes} value={novo} concentracoesConfig={concentracoesConfig} onChange={setNovo} /></div>
          <button className="btn-primary px-4 py-2 text-sm" disabled={!novo} onClick={async () => { await atualizar(novo, { elegivel: true }); setNovo(""); toast.success("Perfume elegível."); }}>Adicionar</button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input className="input-premium max-w-sm" placeholder="Buscar código, marca ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={soElegiveis} onCheckedChange={setSoElegiveis} /> Só elegíveis</label>
      </div>
      {lista.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhum perfume elegível ainda.</div> : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((p) => {
            const c = mapa.get(p.id);
            const custo = p.custoMedio || p.custo;
            const rend = c?.rendimento_util ?? 100;
            return (
              <div key={p.id} className="card-premium p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{p.codigo}</p>
                    <p className="font-medium truncate">{p.marca} - {p.nome}</p>
                    <p className="text-xs text-muted-foreground">{concentracoesConfig[p.concentracao] || p.concentracao} · {p.volume} ml · Frasco {fmtBRL(p.precoVenda)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <label className="flex items-center gap-1">Elegível <Switch checked={!!c?.elegivel} onCheckedChange={(v) => atualizar(p.id, { elegivel: v })} /></label>
                    <label className="flex items-center gap-1">Ativo <Switch checked={c?.ativo ?? true} onCheckedChange={(v) => atualizar(p.id, { ativo: v })} /></label>
                    <button className="text-gold hover:underline" onClick={() => setVer360(p.id)}>Visão 360°</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Custo</p>{fmtBRL(custo)}</div>
                  <div><p className="text-xs text-muted-foreground">Custo/ml</p>{fmtBRL(custoPorMl(custo, p.volume, rend))}</div>
                  <Campo label="Rendimento %"><input type="number" onWheel={blurWheel} className="input-premium py-1" defaultValue={rend}
                    onBlur={(e) => { const v = num(e.target.value); if (v > 0 && v <= 100 && v !== rend) atualizar(p.id, { rendimento_util: v }); }} /></Campo>
                  <Campo label="Mínimo (ml)"><input type="number" onWheel={blurWheel} className="input-premium py-1" defaultValue={c?.estoque_minimo_ml ?? 0}
                    onBlur={(e) => { const v = num(e.target.value); if (v >= 0) atualizar(p.id, { estoque_minimo_ml: v }); }} /></Campo>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {ver360 && <Perfume360 produtoId={ver360} unidadeId={null} onClose={() => setVer360(null)} />}
    </div>
  );
}

/* ---------------- Configurações ---------------- */
const TAM_VAZIO: DecantTamanho = { nome: "", volume_ml: 0, frasco_descricao: "", custo_frasco: 0, custo_atomizador: 0,
  custo_etiqueta: 0, custo_embalagem: 0, custo_adicional: 0, custo_mao_obra: 0, ativo: true };

function AbaConfiguracoes() {
  const { data: cfg } = useDecantConfig();
  const salvarCfg = useSalvarDecantConfig();
  const { data: tamanhos = [] } = useTamanhos();
  const salvarTam = useSalvarTamanho();
  const [editando, setEditando] = useState<DecantTamanho | null>(null);

  const mudar = async (patch: Partial<DecantConfig>) => {
    if (!cfg) return;
    try { await salvarCfg.mutateAsync({ ...cfg, ...patch }); toast.success("Configuração salva."); }
    catch (e: any) { toast.error(e.message); }
  };
  const gravarTam = async () => {
    if (!editando || !(editando.volume_ml > 0)) return toast.error("Informe o volume.");
    try { await salvarTam.mutateAsync({ ...editando, nome: editando.nome || `${editando.volume_ml} ml` }); toast.success("Tamanho salvo."); setEditando(null); }
    catch (e: any) { toast.error(e.message); }
  };
  const campoNum = (k: keyof DecantTamanho, label: string) => (
    <Campo label={label}><input type="number" step="0.01" onWheel={blurWheel} className="input-premium"
      value={String(editando?.[k] ?? "")} onChange={(e) => setEditando({ ...editando!, [k]: e.target.value === "" ? 0 : Number(e.target.value) })} /></Campo>
  );

  return (
    <div className="space-y-5">
      {cfg && (
        <div className="card-premium p-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-sm">Módulo ligado para as lojas <Switch checked={cfg.ativo} onCheckedChange={(v) => mudar({ ativo: v })} /></label>
          <label className="flex items-center justify-between gap-2 text-sm">Venda sob demanda (sem estoque pronto) <Switch checked={!!cfg.venda_sob_demanda} onCheckedChange={(v) => mudar({ venda_sob_demanda: v })} /></label>
          <label className="flex items-center justify-between gap-2 text-sm">Permitir transferir frasco aberto <Switch checked={!!cfg.transferir_frasco_aberto} onCheckedChange={(v) => mudar({ transferir_frasco_aberto: v })} /></label>
          <label className="flex items-center justify-between gap-2 text-sm">Conferência de produção obrigatória <Switch checked={cfg.conferencia_obrigatoria} onCheckedChange={(v) => mudar({ conferencia_obrigatoria: v })} /></label>
          <Campo label="Tolerância de divergência (ml)"><input type="number" step="0.1" onWheel={blurWheel} className="input-premium" defaultValue={cfg.tolerancia_ml}
            onBlur={(e) => { const v = num(e.target.value); if (v >= 0 && v !== cfg.tolerancia_ml) mudar({ tolerancia_ml: v }); }} /></Campo>
          <Campo label="Rendimento útil padrão (%)"><input type="number" onWheel={blurWheel} className="input-premium" defaultValue={cfg.rendimento_padrao}
            onBlur={(e) => { const v = num(e.target.value); if (v > 0 && v <= 100 && v !== cfg.rendimento_padrao) mudar({ rendimento_padrao: v }); }} /></Campo>
          <Campo label="Volume crítico por perfume/filial (ml)"><input type="number" onWheel={blurWheel} className="input-premium" defaultValue={cfg.volume_critico_ml ?? 10}
            onBlur={(e) => { const v = num(e.target.value); if (v > 0 && v !== cfg.volume_critico_ml) mudar({ volume_critico_ml: v }); }} /></Campo>
          <Campo label="Alerta de perfume aberto há (dias)"><input type="number" onWheel={blurWheel} className="input-premium" defaultValue={cfg.dias_aberto_alerta}
            onBlur={(e) => { const v = parseInt(e.target.value); if (v > 0 && v !== cfg.dias_aberto_alerta) mudar({ dias_aberto_alerta: v }); }} /></Campo>
          <Campo label="Margem mínima dos decants (%)"><input type="number" onWheel={blurWheel} className="input-premium" defaultValue={cfg.margem_minima ?? 30}
            onBlur={(e) => { const v = num(e.target.value); if (v >= 0 && v < 100 && v !== (cfg.margem_minima ?? 30)) mudar({ margem_minima: v }); }} /></Campo>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="font-medium">Tamanhos de decant</h2>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setEditando({ ...TAM_VAZIO })}><Plus className="w-4 h-4 inline mr-1" />Novo tamanho</button>
      </div>
      {tamanhos.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhum tamanho cadastrado.</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tamanhos.map((t) => {
            const insumos = Number(t.custo_frasco) + Number(t.custo_atomizador) + Number(t.custo_etiqueta) + Number(t.custo_embalagem) + Number(t.custo_adicional) + Number(t.custo_mao_obra);
            return (
              <button key={t.id} onClick={() => setEditando({ ...t, volume_ml: Number(t.volume_ml) })} className="card-premium p-4 text-left hover:border-gold">
                <div className="flex justify-between"><span className="font-semibold">{t.nome}</span><span className={`text-xs ${t.ativo ? "text-success" : "text-muted-foreground"}`}>{t.ativo ? "Ativo" : "Inativo"}</span></div>
                <p className="text-sm text-muted-foreground">{fmtMl(Number(t.volume_ml))} · {t.frasco_descricao || "frasco não informado"}</p>
                <p className="text-sm mt-1">Insumos + mão de obra: <b>{fmtBRL(insumos)}</b></p>
              </button>
            );
          })}
        </div>
      )}
      {editando && (
        <Dialog open onOpenChange={() => setEditando(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editando.id ? "Editar tamanho" : "Novo tamanho"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Volume (ml)"><input inputMode="decimal" className="input-premium" value={editando.volume_ml || ""}
                onChange={(e) => setEditando({ ...editando, volume_ml: Number(e.target.value.replace(",", ".")) || 0 })} /></Campo>
              <Campo label="Nome"><input className="input-premium" placeholder="ex.: 5 ml" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></Campo>
              <div className="col-span-2"><Campo label="Frasco usado"><input className="input-premium" value={editando.frasco_descricao} onChange={(e) => setEditando({ ...editando, frasco_descricao: e.target.value })} /></Campo></div>
              {campoNum("custo_frasco", "Custo do frasco")}{campoNum("custo_atomizador", "Atomizador")}
              {campoNum("custo_etiqueta", "Etiqueta")}{campoNum("custo_embalagem", "Embalagem")}
              {campoNum("custo_adicional", "Custo adicional")}{campoNum("custo_mao_obra", "Mão de obra estimada")}
              <label className="flex items-center gap-2 text-sm col-span-2"><Switch checked={editando.ativo} onCheckedChange={(v) => setEditando({ ...editando, ativo: v })} /> Ativo</label>
            </div>
            <button className="btn-primary w-full py-2.5" disabled={salvarTam.isPending} onClick={gravarTam}>Salvar</button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
