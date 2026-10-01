import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Eye, FileSpreadsheet, FileText, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import {
  useDecantDashboard, usePerdasPainel, useRegistrarPerda, useRentabilidadeDecant, usePerfume360, useRelatorioDecant,
  useFrascosAbertos, useDecantConfig, useSalvarDecantConfig,
} from "@/hooks/useDecants";
import {
  fmtBRL, fmtMl, periodoPreset, comparativoFechado, ROTULO_PERDA, TIPOS_PERDA, RELATORIOS, ROTULO_MOV, CANAIS, type PresetPeriodo,
} from "@/lib/decants";
import { exportarRelatorio } from "@/lib/decantsExport";
import { getHojeManaus } from "@/lib/dateUtils";

/* ---------- Filtros compartilhados ---------- */
const PRESETS: { id: PresetPeriodo; label: string }[] = [
  { id: "hoje", label: "Hoje" }, { id: "ontem", label: "Ontem" }, { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" }, { id: "mes", label: "Mês atual" }, { id: "personalizado", label: "Personalizado" },
];

function useFiltro(inicial: PresetPeriodo = "30d") {
  const hoje = getHojeManaus();
  const [preset, setPreset] = useState<PresetPeriodo>(inicial);
  const base = periodoPreset(inicial === "personalizado" ? "30d" : inicial, hoje);
  const [ini, setIni] = useState(base.ini);
  const [fim, setFim] = useState(base.fim);
  const [unidade, setUnidade] = useState("");
  const escolher = (p: PresetPeriodo) => {
    setPreset(p);
    if (p !== "personalizado") { const r = periodoPreset(p, hoje); setIni(r.ini); setFim(r.fim); }
  };
  return { preset, escolher, ini, fim, setIni, setFim, unidade, setUnidade, unidadeId: unidade || null };
}
type Filtro = ReturnType<typeof useFiltro>;

function BarraFiltro({ f, semPeriodo }: { f: Filtro; semPeriodo?: boolean }) {
  const { unidadesEstoque } = useUnidades();
  return (
    <div className="card-premium p-3 space-y-2">
      {!semPeriodo && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => f.escolher(p.id)} className={`pill whitespace-nowrap ${f.preset === p.id ? "pill-active" : "pill-inactive"}`}>{p.label}</button>
          ))}
        </div>
      )}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
        <select className="input-premium" value={f.unidade} onChange={(e) => f.setUnidade(e.target.value)}>
          <option value="">Todas as filiais</option>
          {unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
        </select>
        {!semPeriodo && f.preset === "personalizado" && (
          <>
            <input type="date" className="input-premium" value={f.ini} max={f.fim} onChange={(e) => e.target.value && f.setIni(e.target.value)} aria-label="Data inicial" />
            <input type="date" className="input-premium" value={f.fim} min={f.ini} onChange={(e) => e.target.value && f.setFim(e.target.value)} aria-label="Data final" />
          </>
        )}
      </div>
    </div>
  );
}

const n = (v: unknown) => Number(v ?? 0);
const pct = (v: unknown) => (v === null || v === undefined ? "—" : `${n(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const brl = (v: unknown) => (v === null || v === undefined ? "—" : fmtBRL(n(v)));
const num = (v: unknown) => n(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Card({ titulo, valor, sub, alerta }: { titulo: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div className={`card-premium p-3 ${alerta ? "border-destructive" : ""}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`text-lg font-semibold mt-0.5 ${alerta ? "text-destructive" : ""}`}>{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
const Estado = ({ q, vazio }: { q: { isLoading: boolean; error: unknown }; vazio?: boolean }) =>
  q.isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
  : q.error ? <div className="card-premium p-8 text-center text-destructive">{(q.error as Error).message || "Não foi possível carregar."}</div>
  : vazio ? <div className="card-premium p-8 text-center text-muted-foreground">Nada no período.</div> : null;

function Ranking({ titulo, itens, valor }: { titulo: string; itens: any[] | null | undefined; valor: (i: any) => string }) {
  if (!itens) return null;
  return (
    <div className="card-premium p-4">
      <p className="text-sm font-medium mb-2">{titulo}</p>
      {itens.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados no período.</p> : (
        <ol className="space-y-1 text-sm">
          {itens.map((i, k) => (
            <li key={k} className="flex justify-between gap-2"><span className="truncate"><span className="text-gold mr-1">{k + 1}.</span>{i.rotulo}</span><span className="whitespace-nowrap font-medium">{valor(i)}</span></li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------- Dashboard ---------- */
export function AbaDashboardDecants() {
  const f = useFiltro("hoje");
  const q = useDecantDashboard(f.unidadeId, f.ini, f.fim);
  const d = q.data as any;
  const c = d?.cards ?? {};
  return (
    <div className="space-y-4">
      <BarraFiltro f={f} />
      {Estado({ q }) ?? (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <Card titulo="Faturamento no período" valor={brl(c.faturamento_periodo)} sub={`Hoje ${brl(c.faturamento_hoje)} · Mês ${brl(c.faturamento_mes)}`} />
            <Card titulo="Decants vendidos" valor={`${num(c.vendidos_un)} un`} sub={`${fmtMl(n(c.ml_vendido))} vendidos`} />
            <Card titulo="Quantidade produzida" valor={`${num(c.produzidos_un)} un`} />
            <Card titulo="ml disponível" valor={fmtMl(n(c.ml_disponivel))} sub={`Saldo ${fmtMl(n(c.ml_saldo))} (com reservas)`} />
            <Card titulo="Perfumes abertos" valor={num(c.perfumes_abertos)} sub={`${num(c.frascos_abertos)} frascos abertos`} />
            <Card titulo="Frascos fechados p/ decant" valor={num(c.fechados_reservados)} />
            <Card titulo="Decants prontos" valor={`${num(c.unidades_prontas)} un`} sub={`Valor potencial ${brl(c.potencial_venda)}`} />
            {d?.ver_custos && <Card titulo="Custo total do estoque" valor={brl(c.custo_estoque)} sub="Prontos + ml aberto + fechados" />}
            {d?.ver_margem && <Card titulo="Margem bruta estimada" valor={pct(c.margem_pct)} sub={`Lucro ${brl(c.lucro_bruto)}`} />}
            <Card titulo="Perdas" valor={fmtMl(n(c.perdas_ml))} sub={d?.ver_custos ? brl(c.perdas_valor) : undefined} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Ranking titulo="Decants mais vendidos" itens={d.rankings.mais_vendidos} valor={(i) => `${num(i.qtd)} un`} />
            <Ranking titulo="Perfumes mais usados" itens={d.rankings.perfumes_mais_usados} valor={(i) => fmtMl(n(i.ml))} />
            <Ranking titulo="Maior faturamento" itens={d.rankings.maior_faturamento} valor={(i) => brl(i.receita)} />
            {d.ver_margem && <Ranking titulo="Maior margem" itens={d.rankings.maior_margem} valor={(i) => pct(i.margem_pct)} />}
            <Ranking titulo="Maior perda" itens={d.rankings.maior_perda} valor={(i) => fmtMl(n(i.ml))} />
            <Ranking titulo="Tamanhos mais vendidos" itens={d.rankings.tamanhos} valor={(i) => `${num(i.qtd)} un`} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Perdas ---------- */
export function AbaPerdasDecant() {
  const f = useFiltro("30d");
  const q = usePerdasPainel(f.unidadeId, f.ini, f.fim);
  const d = q.data as any;
  const [novo, setNovo] = useState(false);
  const { data: cfg } = useDecantConfig();
  const salvarCfg = useSalvarDecantConfig();
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary px-4 py-2 text-sm" onClick={() => setNovo(true)}><Plus className="w-4 h-4 inline mr-1" />Registrar perda</button></div>
      <BarraFiltro f={f} />
      {Estado({ q }) ?? (
        <>
          {d.alerta && (
            <div className="card-premium p-3 border-destructive flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Perdas em {pct(d.pct)} do ml movimentado, acima do máximo de {pct(d.max_pct)}.
            </div>
          )}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card titulo="Perdas no período" valor={fmtMl(n(d.ml))} sub={d.ver_custos ? brl(d.valor) : undefined} alerta={d.alerta} />
            <Card titulo="% do ml movimentado" valor={pct(d.pct)} sub={`Máximo ${pct(d.max_pct)} · ${fmtMl(n(d.ml_movimentado))} movimentados`} alerta={d.alerta} />
            <Card titulo="Na produção" valor={fmtMl(n(d.ml_producao))} sub="Entram no custo do lote" />
            <Card titulo="Fora de lote" valor={fmtMl(n(d.ml_fora_lote))} sub="Não entram no custo dos decants" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Ranking titulo="Por tipo" itens={(d.por_tipo || []).map((t: any) => ({ ...t, rotulo: ROTULO_PERDA[t.tipo] || t.tipo }))}
              valor={(i) => `${fmtMl(n(i.ml))}${d.ver_custos ? ` · ${brl(i.valor)}` : ""}`} />
            <Ranking titulo="Perfumes com maior perda" itens={(d.por_perfume || []).map((p: any) => ({ ...p, rotulo: p.perfume }))}
              valor={(i) => `${fmtMl(n(i.ml))}${d.ver_custos ? ` · ${brl(i.valor)}` : ""}`} />
          </div>
          {cfg && (
            <label className="card-premium p-3 flex flex-wrap items-center gap-2 text-sm">
              Alerta quando as perdas passarem de
              <input type="number" className="input-premium w-20 py-1" defaultValue={cfg.perda_max_pct ?? 5} onWheel={(e) => e.currentTarget.blur()}
                onBlur={async (e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  if (!(v >= 0 && v <= 100) || v === (cfg.perda_max_pct ?? 5)) return;
                  try { await salvarCfg.mutateAsync({ ...cfg, perda_max_pct: v }); toast.success("Limite de perdas salvo."); q.refetch(); } catch (err: any) { toast.error(err.message); }
                }} />
              % do ml movimentado
            </label>
          )}
          {d.linhas.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhuma perda no período.</div> : (
            <div className="grid gap-2">
              {d.linhas.map((l: any) => (
                <div key={l.id} className="card-premium p-3 text-sm flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{ROTULO_PERDA[l.tipo] || l.tipo} · {l.perfume}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.data).toLocaleString("pt-BR", { timeZone: "America/Manaus", dateStyle: "short", timeStyle: "short" })} · {l.filial}
                      {l.frasco && ` · ${l.frasco}`}{l.lote && ` · ${l.lote}`} · {l.usuario || "—"}{l.absorvida_custo && " · no custo do lote"}
                    </p>
                    {l.justificativa && <p className="text-xs mt-0.5">{l.justificativa}</p>}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-semibold text-destructive">−{fmtMl(n(l.ml))}</p>
                    {d.ver_custos && <p className="text-xs text-muted-foreground">{brl(l.valor)} · {brl(l.custo_ml)}/ml</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {novo && <NovaPerda onClose={() => setNovo(false)} />}
    </div>
  );
}

function NovaPerda({ onClose }: { onClose: () => void }) {
  const { data: frascos = [] } = useFrascosAbertos(null);
  const registrar = useRegistrarPerda();
  const [frasco, setFrasco] = useState("");
  const [tipo, setTipo] = useState("vazamento");
  const [ml, setMl] = useState("");
  const [just, setJust] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const f = frascos.find((x) => x.id === frasco);
  const salvar = async () => {
    const v = Number(ml.replace(",", "."));
    if (!frasco) return toast.error("Escolha o frasco.");
    if (!(v > 0)) return toast.error("Informe os ml perdidos.");
    if (just.trim().length < 5) return toast.error("Escreva a justificativa.");
    try { await registrar.mutateAsync({ frascoId: frasco, tipo, ml: v, justificativa: just, chave }); toast.success("Perda registrada."); onClose(); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar perda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select className="input-premium" value={frasco} onChange={(e) => setFrasco(e.target.value)}>
            <option value="">Frasco aberto</option>
            {frascos.filter((x) => x.status === "aberto" && x.saldo_ml > 0).map((x) => (
              <option key={x.id} value={x.id}>{x.codigo} · {x.marca} - {x.nome} · {x.unidade_nome} · {fmtMl(x.saldo_ml)}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select className="input-premium" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_PERDA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input inputMode="decimal" className="input-premium" placeholder="ml perdidos" value={ml} onChange={(e) => setMl(e.target.value)} />
          </div>
          {f && <p className="text-xs text-muted-foreground">Saldo do frasco: {fmtMl(f.saldo_ml)} (ml reservado para produção não pode ser usado).</p>}
          <textarea className="input-premium min-h-[80px]" placeholder="Justificativa (obrigatória)" value={just} onChange={(e) => setJust(e.target.value)} />
          <button className="btn-primary w-full py-2.5" disabled={registrar.isPending} onClick={salvar}>{registrar.isPending ? "Registrando…" : "Registrar perda"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Rentabilidade ---------- */
export function AbaRentabilidadeDecant() {
  const f = useFiltro("mes");
  const [agrupar, setAgrupar] = useState<"perfume" | "tamanho" | "filial">("perfume");
  const q = useRentabilidadeDecant(agrupar, f.unidadeId, f.ini, f.fim);
  const d = q.data as any;
  const [p360, setP360] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["perfume", "tamanho", "filial"] as const).map((a) => (
          <button key={a} onClick={() => setAgrupar(a)} className={`pill ${agrupar === a ? "pill-active" : "pill-inactive"}`}>Por {a}</button>
        ))}
      </div>
      <BarraFiltro f={f} />
      <p className="text-xs text-muted-foreground">Receita e custo consumido são das vendas do período. Volumes e custo dos frascos mostram a situação atual.</p>
      {Estado({ q, vazio: d?.linhas?.length === 0 }) ?? (
        <div className="grid gap-3 md:grid-cols-2">
          {d.linhas.map((l: any) => (
            <div key={String(l.chave)} className="card-premium p-4 space-y-2">
              <div className="flex justify-between gap-2">
                <p className="font-medium truncate">{l.rotulo}</p>
                {agrupar === "perfume" && <button className="text-xs text-gold flex items-center gap-1 whitespace-nowrap" onClick={() => setP360(String(l.chave))}><Eye className="w-3.5 h-3.5" />Visão 360°</button>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <Mini t="Vendidos" v={`${num(l.qtd)} un`} />
                <Mini t="Receita" v={brl(l.receita)} />
                {d.ver_custos && <Mini t="Custo consumido" v={brl(l.custo_consumido)} />}
                {d.ver_margem && <Mini t="Lucro bruto" v={brl(l.lucro_bruto)} />}
                {d.ver_margem && <Mini t="Margem" v={pct(l.margem_pct)} />}
                {agrupar === "perfume" && <>
                  {d.ver_custos && <Mini t="Custo dos frascos" v={brl(l.custo_frasco)} />}
                  <Mini t="Volume utilizado" v={fmtMl(n(l.volume_utilizado))} />
                  <Mini t="Volume restante" v={fmtMl(n(l.volume_restante))} />
                  <Mini t="Receita potencial" v={brl(l.receita_potencial)} />
                </>}
                {agrupar === "filial" && <Mini t="Perdas" v={`${fmtMl(n(l.perdas_ml))}${d.ver_custos ? ` · ${brl(l.perdas_valor)}` : ""}`} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {p360 && <Perfume360 produtoId={p360} unidadeId={f.unidadeId} onClose={() => setP360(null)} />}
    </div>
  );
}
const Mini = ({ t, v }: { t: string; v: string }) => <div><p className="text-[11px] text-muted-foreground">{t}</p><p className="font-medium">{v}</p></div>;

/* ---------- Visão 360° + comparativo ---------- */
const ABAS_360 = [
  { id: "historico", label: "Histórico" }, { id: "lotes", label: "Lotes" }, { id: "vendas", label: "Vendas" },
  { id: "producao", label: "Produção" }, { id: "perdas", label: "Perdas" }, { id: "estoque", label: "Estoque" },
];
const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus", dateStyle: "short", timeStyle: "short" });

export function Perfume360({ produtoId, unidadeId, onClose }: { produtoId: string; unidadeId: string | null; onClose: () => void }) {
  const q = usePerfume360(produtoId, unidadeId);
  const d = q.data as any;
  const [aba, setAba] = useState("historico");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{d?.perfume?.rotulo || "Visão 360°"}</DialogTitle></DialogHeader>
        {Estado({ q }) ?? (
          <div className="space-y-4">
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              <Card titulo="Volume original" valor={fmtMl(n(d.perfume.volume))} sub={`Código ${d.perfume.codigo}`} />
              {d.ver_custos && <Card titulo="Custo do frasco" valor={brl(d.perfume.custo)} sub={`${brl(d.custo_ml)}/ml`} />}
              <Card titulo="Frascos" valor={`${num(d.frascos_fechados)} fechados · ${num(d.frascos_abertos)} abertos`} />
              <Card titulo="Volume aberto disponível" valor={fmtMl(n(d.volume_disponivel))} />
              <Card titulo="Vendido no mês" valor={`${num(d.vendido_mes)} un`} sub={`Faturamento ${brl(d.faturamento_mes)}`} />
              {d.ver_margem && <Card titulo="Margem no mês" valor={pct(d.margem_mes)} sub={`Lucro ${brl(d.lucro_mes)}`} />}
              <Card titulo="Perdas" valor={fmtMl(n(d.perdas_ml))} sub={d.ver_custos ? brl(d.perdas_valor) : `${pct(d.perda_media_pct)} do ml usado`} />
            </div>
            <div className="card-premium p-3">
              <p className="text-sm font-medium mb-2">Decants prontos por tamanho</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {d.tamanhos.map((t: any) => <span key={t.tamanho_id} className="pill pill-inactive">{fmtMl(n(t.volume_ml))}: <b className="ml-1">{num(t.prontos)}</b></span>)}
              </div>
            </div>
            {d.ver_custos && <Comparativo d={d} />}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {ABAS_360.map((a) => <button key={a.id} onClick={() => setAba(a.id)} className={`pill whitespace-nowrap ${aba === a.id ? "pill-active" : "pill-inactive"}`}>{a.label}</button>)}
            </div>
            <Lista360 aba={aba} d={d} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Lista360({ aba, d }: { aba: string; d: any }) {
  const linhas: { k: string; a: string; b: string; c?: string }[] = useMemo(() => {
    switch (aba) {
      case "historico": return d.historico.map((h: any, i: number) => ({ k: String(i), a: `${ROTULO_MOV[h.tipo] || h.tipo} · ${h.item}`, b: `${dataHora(h.data)} · ${h.filial} · ${h.usuario || "—"}${h.motivo ? ` · ${h.motivo}` : ""}`, c: `${n(h.quantidade) > 0 ? "+" : ""}${num(h.quantidade)} ${h.medida}` }));
      case "lotes": return d.lotes.map((l: any) => ({ k: l.codigo, a: `${l.codigo} · ${l.status.replace(/_/g, " ")}`, b: `${dataHora(l.data)} · ${l.filial} · consumido ${fmtMl(n(l.ml_consumido))} · perdas ${fmtMl(n(l.perdas_ml))}`, c: d.ver_custos ? brl(l.custo_total) : fmtMl(n(l.volume_total_ml)) }));
      case "vendas": return d.vendas.map((v: any, i: number) => ({ k: String(i), a: `${v.sku} · ${v.status === "cancelada" ? "Cancelada" : v.status === "pendente_producao" ? "Aguardando produção" : "Concluída"}`, b: `${dataHora(v.data)} · ${v.filial} · ${CANAIS.find((c) => c.value === v.canal)?.label || v.canal}${v.vendedora ? ` · ${v.vendedora}` : ""}${n(v.devolvida) ? ` · ${v.devolvida} devolvida(s)` : ""}`, c: `${v.quantidade} un · ${brl(v.total)}` }));
      case "producao": return d.lotes.filter((l: any) => l.status === "concluido").map((l: any) => ({ k: l.codigo, a: l.codigo, b: (l.itens || []).map((i: any) => `${fmtMl(n(i.volume_ml))}: ${i.fisico ?? "—"}/${i.planejado}`).join(" · "), c: dataHora(l.data) }));
      case "perdas": return d.perdas.map((p: any, i: number) => ({ k: String(i), a: `${ROTULO_PERDA[p.tipo] || p.tipo}${p.origem === "producao" ? " · produção" : ""}`, b: `${dataHora(p.data)} · ${p.usuario || "—"} · ${p.justificativa}`, c: `−${fmtMl(n(p.ml))}${d.ver_custos ? ` · ${brl(p.valor)}` : ""}` }));
      default: return d.estoque.map((e: any, i: number) => ({ k: String(i), a: e.sku, b: `${e.filial} · ${brl(e.preco)}${d.ver_custos ? ` · custo ${brl(e.custo_unit)}` : ""}`, c: `${num(e.quantidade)} un` }));
    }
  }, [aba, d]);
  if (linhas.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nada registrado.</p>;
  return (
    <div className="grid gap-1.5">
      {linhas.map((l) => (
        <div key={l.k} className="flex justify-between gap-2 border border-border rounded-lg p-2 text-sm">
          <div className="min-w-0"><p className="truncate">{l.a}</p><p className="text-xs text-muted-foreground truncate">{l.b}</p></div>
          {l.c && <span className="whitespace-nowrap font-medium">{l.c}</span>}
        </div>
      ))}
    </div>
  );
}

function Comparativo({ d }: { d: any }) {
  const tams = (d.tamanhos as any[]).filter((t) => n(t.preco) > 0);
  const [tamId, setTamId] = useState<string>(tams[0]?.tamanho_id || "");
  const [rend, setRend] = useState(String(d.perfume.rendimento_util ?? 100));
  const [perda, setPerda] = useState(String(d.perda_media_pct ?? 0));
  const [preco, setPreco] = useState(String(d.perfume.preco_venda ?? 0));
  const t = tams.find((x) => x.tamanho_id === tamId);
  const p = (s: string) => Number(s.replace(",", ".")) || 0;
  if (!tams.length) return <div className="card-premium p-3 text-sm text-muted-foreground">Comparativo fechado × decants: cadastre o preço de pelo menos um tamanho deste perfume.</div>;
  const r = t ? comparativoFechado({ precoFechado: p(preco), custoFrasco: n(d.perfume.custo), volumeMl: n(d.perfume.volume), rendimentoPct: p(rend),
    perdaPct: p(perda), tamanhoMl: n(t.volume_ml), precoDecant: n(t.preco), insumosUnit: n(t.insumos) }) : null;
  return (
    <div className="card-premium p-4 space-y-3">
      <p className="text-sm font-medium">Comparativo: vender fechado × vender em decants</p>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <label className="text-xs text-muted-foreground space-y-1"><span>Tamanho</span>
          <select className="input-premium" value={tamId} onChange={(e) => setTamId(e.target.value)}>{tams.map((x) => <option key={x.tamanho_id} value={x.tamanho_id}>{fmtMl(n(x.volume_ml))} · {brl(x.preco)}</option>)}</select></label>
        <label className="text-xs text-muted-foreground space-y-1"><span>Preço do fechado</span><input inputMode="decimal" className="input-premium" value={preco} onChange={(e) => setPreco(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground space-y-1"><span>Rendimento útil %</span><input inputMode="decimal" className="input-premium" value={rend} onChange={(e) => setRend(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground space-y-1"><span>Perda média %</span><input inputMode="decimal" className="input-premium" value={perda} onChange={(e) => setPerda(e.target.value)} /></label>
      </div>
      {r && (
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-sm">
          <Mini t="Fechado: venda (X)" v={brl(p(preco))} />
          <Mini t="Decants possíveis" v={`${r.unidades} × ${fmtMl(n(t!.volume_ml))} (${fmtMl(r.mlUtil)} úteis)`} />
          <Mini t="Receita em decants (Y)" v={brl(r.receitaDecants)} />
          <Mini t="Embalagens (Z)" v={brl(r.custoEmbalagens)} />
          <Mini t="Margem vendendo fechado" v={brl(r.margemFechado)} />
          <Mini t="Margem em decants (Y − Z − frasco)" v={brl(r.margemDecants)} />
          <Mini t="Diferença" v={brl(r.diferenca)} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Apenas apresenta os números. Nenhuma ação é tomada automaticamente.</p>
    </div>
  );
}

/* ---------- Relatórios ---------- */
const SEM_PERIODO = new Set(["estoque", "estoque_filial", "volume_disponivel", "perfumes_abertos_fechados", "custos", "reposicao"]);
const ehDinheiro = (k: string) => /receita|valor|custo|lucro|preco|insumos/.test(k) && k !== "custo_ml_txt";
const fmtCelula = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "margem_pct") return pct(v);
  if (k === "tipo" && typeof v === "string") return ROTULO_PERDA[v] || ROTULO_MOV[v] || v;
  if (typeof v === "number") return ehDinheiro(k) ? fmtBRL(v) : num(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dataHora(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  return s;
};

export function AbaRelatoriosDecant({ fixo }: { fixo?: string }) {
  const [tipo, setTipo] = useState(fixo || "vendas");
  const f = useFiltro("30d");
  const q = useRelatorioDecant(tipo, f.unidadeId, f.ini, f.fim);
  const d = q.data;
  const nome = RELATORIOS.find((r) => r.value === tipo)?.label || tipo;
  const exp = (fmt: "csv" | "xlsx" | "pdf") => {
    if (!d?.linhas.length) return toast.error("Nada para exportar.");
    try { exportarRelatorio(d.colunas, d.linhas, nome.toLowerCase().replace(/\s+/g, "_"), fmt); } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {!fixo && (
          <select className="input-premium max-w-xs" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {RELATORIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}
        {fixo === "reposicao" && <p className="text-sm text-muted-foreground">Decants abaixo do estoque mínimo da filial, com sugestão de produção.</p>}
        <div className="flex-1" />
        <button className="btn-secondary px-3 py-2 text-sm" onClick={() => exp("csv")}><Download className="w-4 h-4 inline mr-1" />CSV</button>
        <button className="btn-secondary px-3 py-2 text-sm" onClick={() => exp("xlsx")}><FileSpreadsheet className="w-4 h-4 inline mr-1" />Excel</button>
        <button className="btn-secondary px-3 py-2 text-sm" onClick={() => exp("pdf")}><FileText className="w-4 h-4 inline mr-1" />PDF</button>
      </div>
      <BarraFiltro f={f} semPeriodo={SEM_PERIODO.has(tipo)} />
      {Estado({ q, vazio: d?.linhas.length === 0 }) ?? (
        <div className="card-premium overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{d!.colunas.map((c) => <th key={c.k} className="text-left font-medium text-xs text-muted-foreground p-2 whitespace-nowrap">{c.l}</th>)}</tr></thead>
            <tbody>
              {d!.linhas.slice(0, 300).map((l, i) => (
                <tr key={i} className="border-b border-border/50">{d!.colunas.map((c) => <td key={c.k} className="p-2 whitespace-nowrap">{fmtCelula(c.k, l[c.k])}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {d!.linhas.length > 300 && <p className="text-xs text-muted-foreground p-2">Mostrando 300 de {d!.linhas.length} linhas. A exportação traz todas.</p>}
        </div>
      )}
    </div>
  );
}
