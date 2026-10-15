import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Droplets, Minus, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import { useDecantConfig, usePdvCatalogoDecants, useVenderDecant, useFrascosAbertos, useApcs, useVenderFrasco, useVenderApc } from "@/hooks/useDecants";
import { tamanhosVendaveis } from "@/lib/decantsApc";
import { CANAIS, fmtBRL, fmtMl } from "@/lib/decants";

const FORMAS = ["Dinheiro", "Pix", "Débito", "Crédito"];

/** Venda de decants a partir do PDV (botão separado). Estoque, caixa e auditoria ficam no banco (fn_decant_vender). */
export function DecantVendaPdv({ open, onClose, vendedoras }: { open: boolean; onClose: () => void; vendedoras: string[] }) {
  const { unidadesVenda } = useUnidades({ contexto: "operacional" });
  const { data: cfg } = useDecantConfig();
  const [unidade, setUnidade] = useState(unidadesVenda.length === 1 ? unidadesVenda[0].id : "");
  const { data: catalogo = [], isLoading } = usePdvCatalogoDecants(unidade);
  const vender = useVenderDecant();
  const [busca, setBusca] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [canal, setCanal] = useState("loja_fisica");
  const [vendedora, setVendedora] = useState("");
  const [pags, setPags] = useState<{ forma: string; valor: string }[]>([{ forma: "Pix", valor: "" }]);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const sobDemanda = !!cfg?.venda_sob_demanda;
  const [modo, setModo] = useState<"pronto" | "frasco" | "apc">("pronto");
  const { data: frascos = [] } = useFrascosAbertos(unidade || null);
  const { data: apcs = [] } = useApcs(unidade || null);
  const venderFrasco = useVenderFrasco();
  const venderApc = useVenderApc();
  const [frascoId, setFrascoId] = useState("");
  const [cartF, setCartF] = useState<Record<string, number>>({});
  const [apcId, setApcId] = useState("");
  const fr = frascos.find((x) => x.id === frascoId);
  const granel = fr ? Math.round((fr.saldo_ml - (fr.reservado_ml ?? 0)) * 1000) / 1000 : 0;
  const skusFrasco = fr ? catalogo.filter((c) => c.produto_id === fr.produto_id) : [];
  const itensF = skusFrasco.filter((c) => (cartF[c.sku_id] || 0) > 0).map((c) => ({ c, q: cartF[c.sku_id] }));
  const mlPedido = Math.round(itensF.reduce((a, i) => a + Number(i.c.volume_ml) * i.q * 1000, 0)) / 1000;
  const apcSel = apcs.find((a) => a.id === apcId);
  const apcsVenda = apcs.filter((a) => a.status !== "cancelado" && a.status !== "vendido");
  const pendente = vender.isPending || venderFrasco.isPending || venderApc.isPending;

  const lista = catalogo.filter((c) => !busca || `${c.sku} ${c.marca} ${c.nome}`.toLowerCase().includes(busca.toLowerCase()));
  const itens = useMemo(() => Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ c: catalogo.find((x) => x.sku_id === id)!, q })).filter((x) => x.c), [cart, catalogo]);
  const totalPronto = Math.round(itens.reduce((a, i) => a + Number(i.c.preco_venda) * i.q, 0) * 100) / 100;
  const totalFrasco = Math.round(itensF.reduce((a, i) => a + Number(i.c.preco_venda) * i.q, 0) * 100) / 100;
  const total = modo === "pronto" ? totalPronto : modo === "frasco" ? totalFrasco : apcSel?.status === "disponivel" ? Number(apcSel.preco) : 0;
  const addF = (c: { sku_id: string; volume_ml: number; sku: string }, d: number) => {
    const q = Math.max(0, (cartF[c.sku_id] || 0) + d);
    const novo = mlPedido + Number(c.volume_ml) * d;
    if (d > 0 && Math.round(novo * 1000) > Math.round(granel * 1000)) return toast.error(`Saldo de decants do frasco: ${fmtMl(granel - mlPedido)} livres. A reserva de APC não é usada.`);
    setCartF({ ...cartF, [c.sku_id]: q });
  };
  const somaPag = Math.round(pags.reduce((a, p) => a + (Number(p.valor.replace(",", ".")) || 0), 0) * 100) / 100;

  const add = (id: string, d: number) => {
    const c = catalogo.find((x) => x.sku_id === id)!;
    const q = Math.max(0, (cart[id] || 0) + d);
    if (!sobDemanda && q > c.saldo) return toast.error(`Só há ${c.saldo} un de ${c.sku}.`);
    setCart({ ...cart, [id]: q });
  };

  const finalizar = async () => {
    if (!unidade) return toast.error("Escolha a filial.");
    if (modo === "pronto" && !itens.length) return toast.error("Adicione decants.");
    if (modo === "frasco" && (!fr || !itensF.length)) return toast.error("Escolha o frasco e os tamanhos.");
    if (modo === "apc" && apcSel?.status !== "disponivel") return toast.error("Escolha um APC disponível.");
    const pagamentos = pags.length === 1 && !pags[0].valor ? [{ forma: pags[0].forma, valor: total }]
      : pags.map((p) => ({ forma: p.forma, valor: Number(p.valor.replace(",", ".")) || 0 })).filter((p) => p.valor > 0);
    const s = Math.round(pagamentos.reduce((a, p) => a + p.valor, 0) * 100) / 100;
    if (s !== total) return toast.error(`Pagamentos (${fmtBRL(s)}) diferentes do total (${fmtBRL(total)}).`);
    try {
      if (modo === "frasco") {
        const r = await venderFrasco.mutateAsync({ frascoId: fr!.id, itens: itensF.map((i) => ({ sku_id: i.c.sku_id, quantidade: i.q })), pagamentos, canal, vendedora, chave });
        toast.success(`Venda registrada: ${fmtBRL(r.total ?? total)}. Frasco ${fr!.codigo} ficou com ${fmtMl(Number(r.granel_depois ?? 0))} para decants.`);
      } else if (modo === "apc") {
        await venderApc.mutateAsync({ apcId: apcSel!.id, pagamentos, canal, vendedora, chave });
        toast.success(`APC vendido: ${fmtBRL(total)}.`);
      } else {
        const r = await vender.mutateAsync({ unidadeId: unidade, itens: itens.map((i) => ({ sku_id: i.c.sku_id, quantidade: i.q })), pagamentos, canal, vendedora, chave });
        toast.success(`Venda de decant registrada: ${fmtBRL(r.total ?? total)}.${r.pendentes_producao ? ` ${r.pendentes_producao} un aguardando produção.` : ""}`);
      }
      setCart({}); setCartF({}); setApcId(""); setPags([{ forma: "Pix", valor: "" }]); setChave(crypto.randomUUID()); onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Droplets className="w-5 h-5 text-gold" /> Vender decants</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select className="input-premium" value={unidade} onChange={(e) => { setUnidade(e.target.value); setCart({}); setCartF({}); setFrascoId(""); setApcId(""); }}>
                <option value="">Filial</option>{unidadesVenda.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
              </select>
              <input className="input-premium" placeholder="Buscar SKU, marca ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2">
              {([["pronto", "Estoque pronto"], ["frasco", "Do frasco (sob demanda)"], ["apc", "APC"]] as const).map(([m, l]) => (
                <button key={m} className={`pill ${modo === m ? "pill-active" : "pill-inactive"}`} onClick={() => { setModo(m); setChave(crypto.randomUUID()); }}>{l}</button>
              ))}
            </div>
            {modo === "frasco" && unidade && (
              !sobDemanda ? <p className="text-sm text-muted-foreground">Venda sob demanda está desligada em Decants → Configurações.</p> : (
              <div className="space-y-2">
                <select className="input-premium" value={frascoId} onChange={(e) => { setFrascoId(e.target.value); setCartF({}); }}>
                  <option value="">Frasco de origem</option>
                  {frascos.filter((x) => x.status !== "bloqueado" && x.saldo_ml - (x.reservado_ml ?? 0) > 0).map((x) => (
                    <option key={x.id} value={x.id}>{x.codigo} · {x.marca} - {x.nome} · {fmtMl(x.saldo_ml - (x.reservado_ml ?? 0))} para decants{x.apc ? ` · APC ${fmtMl(Number(x.apc.ml))} protegido` : ""}</option>
                  ))}
                </select>
                {fr && (
                  <>
                    <p className="text-xs text-muted-foreground">Saldo para decants: <b>{fmtMl(granel)}</b> · no carrinho: {fmtMl(mlPedido)} · sobra: {fmtMl(granel - mlPedido)}</p>
                    {[5, 8, 10].map((v) => {
                      const c = skusFrasco.find((x) => Number(x.volume_ml) === v);
                      const cabe = tamanhosVendaveis(granel - mlPedido).includes(v);
                      return (
                        <div key={v} className="flex items-center gap-2 border border-border rounded-lg p-2 text-sm">
                          <div className="flex-1">
                            <p>{v} ml {c ? `· ${fmtBRL(Number(c.preco_venda))}` : ""}</p>
                            {!c ? <p className="text-xs text-destructive">Sem preço cadastrado: venda bloqueada</p>
                              : !cabe && <p className="text-xs text-destructive">Não cabe no saldo restante</p>}
                          </div>
                          {c && <>
                            <button className="btn-secondary p-1.5" aria-label="Menos" onClick={() => addF(c, -1)}><Minus className="w-3.5 h-3.5" /></button>
                            <span className="w-6 text-center">{cartF[c.sku_id] || 0}</span>
                            <button className="btn-primary p-1.5" aria-label="Mais" disabled={!cabe} onClick={() => addF(c, 1)}><Plus className="w-3.5 h-3.5" /></button>
                          </>}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>)
            )}
            {modo === "apc" && unidade && (
              apcsVenda.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum APC nesta filial. Crie em Decants → Frascos Abertos → Dividir frasco.</p> : (
              <div className="grid gap-2">
                {apcsVenda.map((a) => (
                  <button key={a.id} disabled={a.status !== "disponivel"} onClick={() => setApcId(a.id)}
                    className={`text-left border rounded-lg p-2 text-sm ${apcId === a.id ? "border-gold" : "border-border"} disabled:opacity-60`}>
                    <p>{a.nome} — APC com {fmtMl(a.ml_reservado)} remanescentes / frasco original de {fmtMl(a.volume_nominal_ml)}</p>
                    <p className="text-xs text-muted-foreground">{fmtBRL(a.preco)} · {a.tem_tampa ? "com tampa" : "sem tampa"} · {a.tem_caixa ? "com caixa" : "sem caixa"}{a.condicao ? ` · ${a.condicao}` : ""}</p>
                    {a.status !== "disponivel" && <p className="text-xs text-destructive">{a.granel_ml > 0 ? `Ainda há ${fmtMl(a.granel_ml)} de decants no frasco — não pode ser entregue.` : "Libere o APC em Decants → Frascos Abertos."}</p>}
                  </button>
                ))}
              </div>)
            )}
            {modo !== "pronto" ? null : !unidade ? <p className="text-sm text-muted-foreground">Escolha a filial.</p>
              : isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
              : lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum decant com preço cadastrado.</p> : (
                <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                  {lista.map((c) => (
                    <div key={c.sku_id} className="flex items-center gap-2 border border-border rounded-lg p-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="truncate"><span className="font-mono text-gold text-xs">{c.sku}</span> {c.marca} - {c.nome} - {fmtMl(Number(c.volume_ml))}</p>
                        <p className={`text-xs ${c.saldo > 0 ? "text-muted-foreground" : "text-destructive"}`}>{fmtBRL(Number(c.preco_venda))} · {c.saldo > 0 ? `${c.saldo} em estoque` : sobDemanda ? "sob demanda" : "sem estoque"}</p>
                      </div>
                      <button className="btn-secondary p-1.5" aria-label="Menos" onClick={() => add(c.sku_id, -1)}><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-6 text-center">{cart[c.sku_id] || 0}</span>
                      <button className="btn-primary p-1.5" aria-label="Mais" disabled={!sobDemanda && c.saldo <= (cart[c.sku_id] || 0)} onClick={() => add(c.sku_id, 1)}><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <div className="card-premium p-3 space-y-3 h-fit text-sm">
            {modo === "frasco" && itensF.map((i) => (
              <div key={i.c.sku_id} className="flex justify-between gap-2"><span className="truncate">{i.q}× {fmtMl(Number(i.c.volume_ml))}</span><span>{fmtBRL(Number(i.c.preco_venda) * i.q)}</span></div>
            ))}
            {modo === "apc" && apcSel && <div className="flex justify-between gap-2"><span className="truncate">APC {fmtMl(apcSel.ml_reservado)}</span><span>{fmtBRL(apcSel.preco)}</span></div>}
            {modo === "pronto" && itens.map((i) => (
              <div key={i.c.sku_id} className="flex justify-between gap-2"><span className="truncate">{i.q}× {i.c.sku}</span><span>{fmtBRL(Number(i.c.preco_venda) * i.q)}</span></div>
            ))}
            <div className="flex justify-between font-semibold text-base border-t border-border pt-2"><span>Total</span><span className="text-gold">{fmtBRL(total)}</span></div>
            <select className="input-premium" value={canal} onChange={(e) => setCanal(e.target.value)}>{CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            <select className="input-premium" value={vendedora} onChange={(e) => setVendedora(e.target.value)}>
              <option value="">Vendedora</option>{vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {pags.map((p, k) => (
              <div key={k} className="flex gap-1">
                <select className="input-premium flex-1" value={p.forma} onChange={(e) => setPags(pags.map((x, j) => j === k ? { ...x, forma: e.target.value } : x))}>
                  {FORMAS.map((f) => <option key={f}>{f}</option>)}</select>
                <input inputMode="decimal" className="input-premium w-24" placeholder={pags.length === 1 ? "total" : "valor"} value={p.valor}
                  onChange={(e) => setPags(pags.map((x, j) => j === k ? { ...x, valor: e.target.value } : x))} />
                {pags.length > 1 && <button className="text-muted-foreground" aria-label="Remover" onClick={() => setPags(pags.filter((_, j) => j !== k))}><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
            <button className="text-xs text-gold" onClick={() => setPags([...pags, { forma: "Dinheiro", valor: "" }])}>+ dividir pagamento</button>
            {pags.length > 1 && <p className={`text-xs ${somaPag === total ? "text-success" : "text-destructive"}`}>Soma {fmtBRL(somaPag)}</p>}
            <button className="btn-primary w-full py-2.5" disabled={pendente || total <= 0} onClick={finalizar}>{pendente ? "Registrando…" : "Finalizar venda"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
