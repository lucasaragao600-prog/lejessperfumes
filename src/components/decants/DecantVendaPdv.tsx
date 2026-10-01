import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Droplets, Minus, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import { useDecantConfig, usePdvCatalogoDecants, useVenderDecant } from "@/hooks/useDecants";
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

  const lista = catalogo.filter((c) => !busca || `${c.sku} ${c.marca} ${c.nome}`.toLowerCase().includes(busca.toLowerCase()));
  const itens = useMemo(() => Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ c: catalogo.find((x) => x.sku_id === id)!, q })).filter((x) => x.c), [cart, catalogo]);
  const total = Math.round(itens.reduce((a, i) => a + Number(i.c.preco_venda) * i.q, 0) * 100) / 100;
  const somaPag = Math.round(pags.reduce((a, p) => a + (Number(p.valor.replace(",", ".")) || 0), 0) * 100) / 100;

  const add = (id: string, d: number) => {
    const c = catalogo.find((x) => x.sku_id === id)!;
    const q = Math.max(0, (cart[id] || 0) + d);
    if (!sobDemanda && q > c.saldo) return toast.error(`Só há ${c.saldo} un de ${c.sku}.`);
    setCart({ ...cart, [id]: q });
  };

  const finalizar = async () => {
    if (!unidade) return toast.error("Escolha a filial.");
    if (!itens.length) return toast.error("Adicione decants.");
    const pagamentos = pags.length === 1 && !pags[0].valor ? [{ forma: pags[0].forma, valor: total }]
      : pags.map((p) => ({ forma: p.forma, valor: Number(p.valor.replace(",", ".")) || 0 })).filter((p) => p.valor > 0);
    const s = Math.round(pagamentos.reduce((a, p) => a + p.valor, 0) * 100) / 100;
    if (s !== total) return toast.error(`Pagamentos (${fmtBRL(s)}) diferentes do total (${fmtBRL(total)}).`);
    try {
      const r = await vender.mutateAsync({ unidadeId: unidade, itens: itens.map((i) => ({ sku_id: i.c.sku_id, quantidade: i.q })), pagamentos, canal, vendedora, chave });
      toast.success(`Venda de decant registrada: ${fmtBRL(r.total ?? total)}.${r.pendentes_producao ? ` ${r.pendentes_producao} un aguardando produção.` : ""}`);
      setCart({}); setPags([{ forma: "Pix", valor: "" }]); setChave(crypto.randomUUID()); onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Droplets className="w-5 h-5 text-gold" /> Vender decants</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select className="input-premium" value={unidade} onChange={(e) => { setUnidade(e.target.value); setCart({}); }}>
                <option value="">Filial</option>{unidadesVenda.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
              </select>
              <input className="input-premium" placeholder="Buscar SKU, marca ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            </div>
            {!unidade ? <p className="text-sm text-muted-foreground">Escolha a filial.</p>
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
            {itens.map((i) => (
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
            <button className="btn-primary w-full py-2.5" disabled={vender.isPending || !itens.length} onClick={finalizar}>{vender.isPending ? "Registrando…" : "Finalizar venda"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
