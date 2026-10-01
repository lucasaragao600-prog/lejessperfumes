import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Factory, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import {
  useDecantConfig, useFichas, useFrascosDisponiveis, useLotes, useSalvarSku, useCriarLote, useIniciarLote,
  useFinalizarLote, useConferirLote, useCancelarLote, useEditarLote, type FichaSku, type LoteDecant,
} from "@/hooks/useDecants";
import { fichaTecnica, fmtBRL, fmtMl, MOTIVOS_DIFERENCA, STATUS_LOTE, sugerirFifo, volumeNecessario } from "@/lib/decants";

const blurWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>
);
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);

/* ================= Produção ================= */
export function AbaProducao() {
  const [sub, setSub] = useState<"nova" | "fichas">("nova");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={`pill ${sub === "nova" ? "pill-active" : "pill-inactive"}`} onClick={() => setSub("nova")}>Nova produção</button>
        <button className={`pill ${sub === "fichas" ? "pill-active" : "pill-inactive"}`} onClick={() => setSub("fichas")}>SKUs e ficha técnica</button>
      </div>
      {sub === "nova" ? <NovaProducao /> : <Fichas />}
    </div>
  );
}

function NovaProducao() {
  const { unidadesEstoque } = useUnidades();
  const { data: fichas = [], isLoading } = useFichas();
  const criar = useCriarLote();
  const [produtoId, setProdutoId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [mlFrasco, setMlFrasco] = useState<Record<string, string>>({});
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const { data: frascos = [] } = useFrascosDisponiveis(produtoId, unidadeId);

  const perfumes = useMemo(() => {
    const m = new Map<string, FichaSku>();
    fichas.forEach((f) => { if (!m.has(f.produto_id)) m.set(f.produto_id, f); });
    return [...m.values()];
  }, [fichas]);
  const tamanhos = fichas.filter((f) => f.produto_id === produtoId);
  const itens = tamanhos.map((t) => ({ t, q: parseInt(qtds[t.tamanho_id] || "0") || 0 })).filter((x) => x.q > 0);
  const necessario = volumeNecessario(itens.map((x) => ({ volumeMl: Number(x.t.volume_ml), quantidade: x.q })));
  const disponivel = Math.round(frascos.reduce((a, f) => a + Math.max(0, f.disponivel_ml) * 1000, 0)) / 1000;
  const fifo = sugerirFifo(frascos, necessario);
  const somaManual = Math.round(frascos.reduce((a, f) => a + (num(mlFrasco[f.id] || "") || 0) * 1000, 0)) / 1000;
  const insuficiente = necessario > 0 && necessario > disponivel;

  const usarFifoNoManual = () => {
    const m: Record<string, string> = {};
    fifo.distribuicao.forEach((d) => (m[d.frasco_id] = String(d.ml)));
    setMlFrasco(m); setManual(true);
  };

  const salvar = async () => {
    if (!produtoId || !unidadeId) return toast.error("Escolha o perfume e a filial.");
    if (itens.length === 0) return toast.error("Informe a quantidade de pelo menos um tamanho.");
    if (insuficiente) return toast.error(`Volume insuficiente. Necessário: ${fmtMl(necessario).replace(" ml", "")} ml. Disponível: ${fmtMl(disponivel).replace(" ml", "")} ml.`);
    if (manual && somaManual !== necessario) return toast.error(`A soma dos frascos (${fmtMl(somaManual)}) precisa ser igual ao necessário (${fmtMl(necessario)}).`);
    try {
      const r = await criar.mutateAsync({
        produtoId, unidadeId, itens: itens.map((x) => ({ tamanho_id: x.t.tamanho_id, quantidade: x.q })),
        frascos: manual ? frascos.map((f) => ({ frasco_id: f.id, ml: num(mlFrasco[f.id] || "") || 0 })).filter((x) => x.ml > 0) : null,
        responsavel, observacao: obs, chave,
      });
      toast.success(`Lote ${r.codigo} planejado. ${fmtMl(r.volume_ml)} reservados.${r.fora_fifo ? " Atenção: frasco mais antigo não foi usado primeiro." : ""}`);
      setQtds({}); setMlFrasco({}); setManual(false); setObs(""); setChave(crypto.randomUUID());
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>;
  if (perfumes.length === 0) return (
    <div className="card-premium p-8 text-center text-muted-foreground">
      Marque perfumes como elegíveis (aba Perfumes) e cadastre tamanhos (aba Configurações) para produzir.
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card-premium p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Perfume"><select className="input-premium" value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setQtds({}); setMlFrasco({}); }}>
            <option value="">Selecione</option>
            {perfumes.map((p) => <option key={p.produto_id} value={p.produto_id}>{p.produto_codigo} - {p.marca} - {p.nome} - {p.concentracao}</option>)}
          </select></Campo>
          <Campo label="Filial"><select className="input-premium" value={unidadeId} onChange={(e) => { setUnidadeId(e.target.value); setMlFrasco({}); }}>
            <option value="">Selecione</option>{unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
          </select></Campo>
        </div>

        {produtoId && (
          <div>
            <p className="text-sm font-medium mb-2">Tamanhos e quantidades</p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {tamanhos.map((t) => (
                <Campo key={t.tamanho_id} label={`${fmtMl(Number(t.volume_ml))} · ${t.sku}`}>
                  <input type="number" min={0} onWheel={blurWheel} className="input-premium" value={qtds[t.tamanho_id] || ""}
                    onChange={(e) => setQtds({ ...qtds, [t.tamanho_id]: e.target.value })} placeholder="0" />
                </Campo>
              ))}
            </div>
          </div>
        )}

        {produtoId && unidadeId && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium">Frascos abertos (mais antigo primeiro)</p>
              <label className="text-xs flex items-center gap-2">
                <input type="checkbox" checked={manual} onChange={(e) => (e.target.checked ? usarFifoNoManual() : setManual(false))} />
                Escolher ml por frasco
              </label>
            </div>
            {frascos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum frasco aberto deste perfume nesta filial.</p> : (
              <div className="space-y-2">
                {frascos.map((f) => {
                  const sug = fifo.distribuicao.find((d) => d.frasco_id === f.id)?.ml || 0;
                  return (
                    <div key={f.id} className="flex flex-wrap items-center gap-3 text-sm border border-border rounded-lg p-2">
                      <span className="font-mono text-gold">{f.codigo}</span>
                      <span className="text-muted-foreground">saldo {fmtMl(f.saldo_ml)}{f.reservado_ml > 0 && ` · reservado ${fmtMl(f.reservado_ml)}`} · disponível {fmtMl(f.disponivel_ml)}</span>
                      <div className="flex-1" />
                      {manual ? (
                        <input inputMode="decimal" className="input-premium w-24" value={mlFrasco[f.id] || ""}
                          onChange={(e) => setMlFrasco({ ...mlFrasco, [f.id]: e.target.value })} placeholder="ml" />
                      ) : sug > 0 && <span className="font-semibold">usar {fmtMl(sug)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Responsável pela produção"><input className="input-premium" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></Campo>
          <Campo label="Observação"><input className="input-premium" value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        </div>
      </div>

      <div className="card-premium p-4 space-y-3 h-fit lg:sticky lg:top-4">
        <p className="font-medium flex items-center gap-2"><Factory className="w-4 h-4 text-gold" /> Resumo</p>
        {itens.length > 0 && (
          <p className="text-sm text-muted-foreground">{itens.map((x) => `${x.q}×${Number(x.t.volume_ml).toLocaleString("pt-BR")}`).join(" + ")} = <b className="text-foreground">{fmtMl(necessario)}</b></p>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><p className="text-xs text-muted-foreground">Necessário</p>{fmtMl(necessario)}</div>
          <div><p className="text-xs text-muted-foreground">Disponível</p>{fmtMl(disponivel)}</div>
          {manual && <div className="col-span-2"><p className="text-xs text-muted-foreground">Soma escolhida</p>
            <span className={somaManual === necessario ? "text-success" : "text-destructive"}>{fmtMl(somaManual)}</span></div>}
        </div>
        {insuficiente && (
          <p className="text-sm text-destructive flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Volume insuficiente. Necessário: {fmtMl(necessario)}. Disponível: {fmtMl(disponivel)}.</p>
        )}
        <button className="btn-primary w-full py-2.5" disabled={criar.isPending || insuficiente || necessario <= 0} onClick={salvar}>
          {criar.isPending ? "Reservando…" : "Planejar lote e reservar ml"}</button>
        <p className="text-xs text-muted-foreground">O ml fica reservado nos frascos até o envase terminar ou o lote ser cancelado.</p>
      </div>
    </div>
  );
}

function Fichas() {
  const { data: fichas = [], isLoading } = useFichas();
  const { data: cfg } = useDecantConfig();
  const [edit, setEdit] = useState<FichaSku | null>(null);
  const [busca, setBusca] = useState("");
  const minima = cfg?.margem_minima ?? 30;
  const lista = fichas.filter((f) => !busca || `${f.sku} ${f.marca} ${f.nome}`.toLowerCase().includes(busca.toLowerCase()));
  if (isLoading) return <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-3">
      <input className="input-premium max-w-sm" placeholder="Buscar SKU, marca ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {lista.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhum SKU. Marque perfumes elegíveis e cadastre tamanhos.</div> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => {
            const ft = f.ver_custos ? fichaTecnica({
              volumeMl: Number(f.volume_ml), custoMl: Number(f.custo_ml || 0), frasco: Number(f.custo_frasco || 0),
              atomizador: Number(f.custo_atomizador || 0), etiqueta: Number(f.custo_etiqueta || 0), embalagem: Number(f.custo_embalagem || 0),
              maoObra: Number(f.custo_mao_obra || 0), outros: Number(f.custo_adicional || 0), preco: Number(f.preco_venda),
            }) : null;
            const baixa = ft && f.ver_margem && ft.margemPct !== null && ft.margemPct < minima;
            return (
              <div key={f.produto_id + f.tamanho_id} className="card-premium p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-gold text-sm">{f.sku}</span>
                  <button className="text-muted-foreground hover:text-gold" onClick={() => setEdit(f)} aria-label="Editar SKU"><Pencil className="w-4 h-4" /></button>
                </div>
                <p className="text-sm font-medium truncate">{f.marca} - {f.nome} - {f.concentracao} - {fmtMl(Number(f.volume_ml))}</p>
                {!f.cadastrado && <p className="text-xs text-muted-foreground">SKU ainda não salvo (é criado na primeira produção ou ao editar).</p>}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Preço</span><span className="text-right">{fmtBRL(Number(f.preco_venda))}</span>
                  {ft && <>
                    <span className="text-muted-foreground">Líquido</span><span className="text-right">{fmtBRL(ft.custoLiquido)}</span>
                    <span className="text-muted-foreground">Embalagem</span><span className="text-right">{fmtBRL(ft.custoEmbalagem)}</span>
                    <span className="text-muted-foreground">Custo total</span><span className="text-right">{fmtBRL(ft.custoTotal)}</span>
                  </>}
                  {ft && f.ver_margem && <>
                    <span className="text-muted-foreground">Lucro bruto</span><span className="text-right">{fmtBRL(ft.lucroBruto)}</span>
                    <span className="text-muted-foreground">Margem / Markup</span><span className={`text-right ${baixa ? "text-destructive" : ""}`}>{pct(ft.margemPct)} / {pct(ft.markupPct)}</span>
                  </>}
                </div>
                {baixa && <p className="text-xs text-destructive flex gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Margem abaixo da mínima ({minima}%)</p>}
              </div>
            );
          })}
        </div>
      )}
      {edit && <DialogoSku f={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DialogoSku({ f, onClose }: { f: FichaSku; onClose: () => void }) {
  const salvar = useSalvarSku();
  const [sku, setSku] = useState(f.sku);
  const [preco, setPreco] = useState(String(f.preco_venda ?? ""));
  const [ativo, setAtivo] = useState(f.cadastrado ? f.ativo : true);
  const gravar = async () => {
    const p = num(preco);
    if (!(p >= 0)) return toast.error("Preço inválido.");
    try { await salvar.mutateAsync({ produtoId: f.produto_id, tamanhoId: f.tamanho_id, sku, preco: p, ativo }); toast.success("SKU salvo."); onClose(); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>SKU de decant</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">{f.marca} - {f.nome} - {fmtMl(Number(f.volume_ml))}</p>
          <Campo label="SKU (único)"><input className="input-premium font-mono" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} /></Campo>
          <Campo label="Preço de venda (R$)"><input inputMode="decimal" className="input-premium" value={preco} onChange={(e) => setPreco(e.target.value)} /></Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
          <p className="text-xs text-muted-foreground">Toda alteração fica registrada na auditoria.</p>
          <button className="btn-primary w-full py-2.5" disabled={salvar.isPending} onClick={gravar}>{salvar.isPending ? "Salvando…" : "Salvar"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Lotes ================= */
export function AbaLotes() {
  const { unidadesEstoque } = useUnidades();
  const [unidade, setUnidade] = useState("");
  const [status, setStatus] = useState("");
  const { data: lotes = [], isLoading, error } = useLotes(unidade || null, status || null);
  const [sel, setSel] = useState<string | null>(null);
  const atual = lotes.find((l) => l.id === sel) || null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className="input-premium max-w-xs" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
          <option value="">Todas as filiais</option>{unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
        </select>
        <select className="input-premium max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>{Object.entries(STATUS_LOTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : error ? <div className="card-premium p-8 text-center text-destructive">Não foi possível carregar os lotes.</div>
        : lotes.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhum lote ainda.</div>
        : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lotes.map((l) => (
              <button key={l.id} onClick={() => setSel(l.id)} className="card-premium p-4 text-left hover:border-gold transition-colors">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-gold text-sm">{l.codigo}</span>
                  <span className={`text-xs ${l.status === "concluido" ? "text-success" : l.status === "cancelado" ? "text-muted-foreground" : "text-gold"}`}>{STATUS_LOTE[l.status]}</span>
                </div>
                <p className="font-medium mt-1 truncate">{l.marca} - {l.nome}</p>
                <p className="text-xs text-muted-foreground">{l.unidade_nome} · {new Date(l.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}</p>
                <p className="text-sm mt-2">{l.itens.map((i) => `${i.qtd_planejada}×${Number(i.volume_ml).toLocaleString("pt-BR")} ml`).join(" + ")} = {fmtMl(l.volume_total_ml)}</p>
                <p className="text-xs text-muted-foreground mt-1">{l.frascos.map((f) => `${f.codigo}: ${fmtMl(f.ml_consumido ?? f.ml_reservado)}`).join(" · ")}</p>
              </button>
            ))}
          </div>
        )}
      {atual && <DialogoLote lote={atual} onClose={() => setSel(null)} />}
    </div>
  );
}

function DialogoLote({ lote, onClose }: { lote: LoteDecant; onClose: () => void }) {
  const iniciar = useIniciarLote(); const finalizar = useFinalizarLote(); const conferir = useConferirLote();
  const cancelar = useCancelarLote(); const editar = useEditarLote();
  const [consumo, setConsumo] = useState<Record<string, string>>(() => Object.fromEntries(lote.frascos.map((f) => [f.frasco_id, String(f.ml_reservado)])));
  const [fis, setFis] = useState<Record<string, { q: string; motivo: string; just: string }>>(() =>
    Object.fromEntries(lote.itens.map((i) => [i.id, { q: String(i.qtd_planejada), motivo: "", just: "" }])));
  const [respConf, setRespConf] = useState("");
  const [motivoCanc, setMotivoCanc] = useState("");
  const [ed, setEd] = useState({ obs: lote.observacao, resp: lote.responsavel_producao, motivo: "" });
  const exec = async (p: Promise<any>, ok: string) => { try { await p; toast.success(ok); } catch (e: any) { toast.error(e.message); } };

  const doFinalizar = () => {
    const c = lote.frascos.map((f) => ({ frasco_id: f.frasco_id, ml: num(consumo[f.frasco_id] || "") }));
    if (c.some((x) => !(x.ml >= 0))) return toast.error("Informe o ml usado de cada frasco.");
    exec(finalizar.mutateAsync({ id: lote.id, consumo: c }), "Envase finalizado. Consumo registrado nos frascos.");
  };
  const doConferir = () => {
    const itens = lote.itens.map((i) => ({ item_id: i.id, qtd_fisica: parseInt(fis[i.id].q), motivo: fis[i.id].motivo, justificativa: fis[i.id].just }));
    for (const [k, i] of itens.entries()) {
      const pl = lote.itens[k];
      if (!(i.qtd_fisica >= 0) || i.qtd_fisica > pl.qtd_planejada) return toast.error(`Quantidade física inválida em ${fmtMl(pl.volume_ml)}.`);
      if (i.qtd_fisica !== pl.qtd_planejada && (!i.motivo || i.justificativa.trim().length < 5)) return toast.error(`Informe motivo e justificativa da diferença em ${fmtMl(pl.volume_ml)}.`);
    }
    exec(conferir.mutateAsync({ id: lote.id, itens, responsavel: respConf }), "Conferência aprovada. Lote concluído.");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-mono">{lote.codigo} · {STATUS_LOTE[lote.status]}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">{lote.produto_codigo} - {lote.marca} - {lote.nome} - {lote.concentracao}</p>
            <p className="text-muted-foreground">{lote.unidade_nome} · criado por {lote.criado_por_nome || "—"} · produção: {lote.responsavel_producao || "—"}
              {lote.responsavel_conferencia && ` · conferência: ${lote.responsavel_conferencia}`}</p>
            {lote.fora_fifo && <p className="text-xs text-gold mt-1">Escolha de frascos fora da ordem do mais antigo (registrado).</p>}
            {lote.motivo_cancelamento && <p className="text-xs text-destructive mt-1">Cancelado: {lote.motivo_cancelamento}</p>}
          </div>

          <div className="card-premium p-3">
            <p className="font-medium mb-2">Frascos</p>
            {lote.frascos.map((f) => (
              <div key={f.frasco_id} className="flex items-center justify-between gap-2 py-1">
                <span className="font-mono text-gold">{f.codigo}</span>
                <span className="text-muted-foreground">reservado {fmtMl(f.ml_reservado)}{f.ml_consumido !== null && ` · usado ${fmtMl(f.ml_consumido)}`}</span>
                {lote.status === "em_producao" && (
                  <input inputMode="decimal" className="input-premium w-24" value={consumo[f.frasco_id]} aria-label={`ml usado ${f.codigo}`}
                    onChange={(e) => setConsumo({ ...consumo, [f.frasco_id]: e.target.value })} />
                )}
              </div>
            ))}
          </div>

          <div className="card-premium p-3 overflow-x-auto">
            <p className="font-medium mb-2">Tamanhos</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground text-left"><th>SKU</th><th>Planejado</th><th>Físico</th><th>Dif.</th>{lote.ver_custos && lote.status === "concluido" && <th>Custo un.</th>}</tr></thead>
              <tbody>
                {lote.itens.map((i) => {
                  const f = fis[i.id]; const dif = (parseInt(f.q) || 0) - i.qtd_planejada;
                  return (
                    <tr key={i.id} className="align-top">
                      <td className="py-1 font-mono text-xs">{i.sku}</td>
                      <td>{i.qtd_planejada}</td>
                      <td>{lote.status === "aguardando_conferencia" ? (
                        <input type="number" min={0} onWheel={blurWheel} className="input-premium w-20" value={f.q}
                          onChange={(e) => setFis({ ...fis, [i.id]: { ...f, q: e.target.value } })} />) : (i.qtd_fisica ?? "—")}</td>
                      <td className={(lote.status === "aguardando_conferencia" ? dif : i.diferenca ?? 0) < 0 ? "text-destructive" : ""}>
                        {lote.status === "aguardando_conferencia" ? dif : (i.diferenca ?? "—")}
                        {i.motivo && <span className="block text-xs text-muted-foreground">{MOTIVOS_DIFERENCA.find((m) => m.value === i.motivo)?.label}: {i.justificativa}</span>}
                      </td>
                      {lote.ver_custos && lote.status === "concluido" && <td>{fmtBRL(i.custo_unitario)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lote.status === "aguardando_conferencia" && lote.itens.filter((i) => (parseInt(fis[i.id].q) || 0) !== i.qtd_planejada).map((i) => (
              <div key={i.id} className="grid gap-2 sm:grid-cols-2 mt-2">
                <Campo label={`Motivo da diferença · ${fmtMl(i.volume_ml)}`}>
                  <select className="input-premium" value={fis[i.id].motivo} onChange={(e) => setFis({ ...fis, [i.id]: { ...fis[i.id], motivo: e.target.value } })}>
                    <option value="">Selecione</option>{MOTIVOS_DIFERENCA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></Campo>
                <Campo label="Justificativa"><input className="input-premium" value={fis[i.id].just}
                  onChange={(e) => setFis({ ...fis, [i.id]: { ...fis[i.id], just: e.target.value } })} /></Campo>
              </div>
            ))}
          </div>

          {lote.ver_custos && lote.status === "concluido" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 card-premium p-3">
              <div><p className="text-xs text-muted-foreground">Líquido</p>{fmtBRL(lote.custo_liquido)}</div>
              <div><p className="text-xs text-muted-foreground">Insumos</p>{fmtBRL(lote.custo_insumos)}</div>
              <div><p className="text-xs text-muted-foreground">Custo total</p>{fmtBRL(lote.custo_total)}</div>
              <div><p className="text-xs text-muted-foreground">Perdas</p>{fmtMl(lote.perdas_ml)}</div>
            </div>
          )}

          {lote.status === "planejado" && (
            <button className="btn-primary w-full py-2.5" disabled={iniciar.isPending} onClick={() => exec(iniciar.mutateAsync(lote.id), "Produção iniciada.")}>Iniciar produção</button>
          )}
          {lote.status === "em_producao" && (
            <button className="btn-primary w-full py-2.5" disabled={finalizar.isPending} onClick={doFinalizar}>Finalizar envase e registrar consumo</button>
          )}
          {lote.status === "aguardando_conferencia" && (
            <div className="space-y-2">
              <Campo label="Responsável pela conferência"><input className="input-premium" value={respConf} onChange={(e) => setRespConf(e.target.value)} /></Campo>
              <button className="btn-primary w-full py-2.5" disabled={conferir.isPending} onClick={doConferir}>Aprovar conferência</button>
            </div>
          )}
          {(lote.status === "planejado" || lote.status === "em_producao") && (
            <div className="flex gap-2">
              <input className="input-premium flex-1" placeholder="Motivo do cancelamento" value={motivoCanc} onChange={(e) => setMotivoCanc(e.target.value)} />
              <button className="btn-secondary px-4 text-sm" disabled={cancelar.isPending}
                onClick={() => exec(cancelar.mutateAsync({ id: lote.id, motivo: motivoCanc }), "Lote cancelado. Reserva liberada.")}>Cancelar lote</button>
            </div>
          )}
          {lote.status !== "cancelado" && (
            <details className="card-premium p-3">
              <summary className="cursor-pointer font-medium">Editar observação / responsável</summary>
              <div className="grid gap-2 mt-2">
                <Campo label="Responsável pela produção"><input className="input-premium" value={ed.resp} onChange={(e) => setEd({ ...ed, resp: e.target.value })} /></Campo>
                <Campo label="Observação"><input className="input-premium" value={ed.obs} onChange={(e) => setEd({ ...ed, obs: e.target.value })} /></Campo>
                {lote.status === "concluido" && <Campo label="Motivo da edição (fica na auditoria)"><input className="input-premium" value={ed.motivo} onChange={(e) => setEd({ ...ed, motivo: e.target.value })} /></Campo>}
                <button className="btn-secondary py-2 text-sm" disabled={editar.isPending}
                  onClick={() => exec(editar.mutateAsync({ id: lote.id, observacao: ed.obs, responsavel: ed.resp, motivo: ed.motivo }), "Lote atualizado.")}>Salvar alteração</button>
              </div>
            </details>
          )}

          <div>
            <p className="font-medium mb-1">Histórico</p>
            {lote.eventos.map((e, k) => (
              <p key={k} className="text-xs text-muted-foreground">
                {new Date(e.em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} · {ROTULO_EVENTO[e.evento] || e.evento} · {e.usuario || "—"}
              </p>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_EVENTO: Record<string, string> = {
  criado: "Lote planejado e ml reservado", iniciado: "Produção iniciada", envase_finalizado: "Envase finalizado",
  conferido: "Conferência aprovada", perda_producao: "Perda de produção registrada",
  entrada_estoque_pendente: "Pronto para entrada no estoque de decants", cancelado: "Lote cancelado", editado: "Lote editado",
};
