import { useState } from "react";
import CartaoNotaTransferencia from "@/components/transferencias/CartaoNotaTransferencia";
import { toast } from "sonner";
import { AlertTriangle, Download, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import {
  useEstoqueDecants, useMovimentacoesDecant, exportarMovimentacoes, useVendasDecant, useQuarentena, useInventariosPendentes,
  useCancelarVendaDecant, useDevolverDecant, useDecidirQuarentena, useContarInventario, useDecidirInventario, useSalvarMinIdeal,
  useTransferenciasDecant, useCriarTransfDecant, useAcaoTransfDecant, useFechadosSaldo, useFrascosAbertos, useDecantConfig,
  type EstoqueSku,
} from "@/hooks/useDecants";
import { CANAIS, estoquePotencial, fmtBRL, fmtMl, ROTULO_MOV } from "@/lib/decants";

const blurWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>
);
const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" });
const exec = async (p: Promise<any>, ok: string) => { try { await p; toast.success(ok); return true; } catch (e: any) { toast.error(e.message); return false; } };

function FiltroUnidade({ value, onChange, todas = true }: { value: string; onChange: (v: string) => void; todas?: boolean }) {
  const { unidadesEstoque } = useUnidades();
  return (
    <select className="input-premium max-w-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {todas && <option value="">Todas as filiais</option>}
      {!todas && <option value="">Selecione a filial</option>}
      {unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
    </select>
  );
}

/* ================= Estoque ================= */
export function AbaEstoqueDecants() {
  const [unidade, setUnidade] = useState("");
  const { data, isLoading, error } = useEstoqueDecants(unidade || null);
  const { data: quarentena = [] } = useQuarentena();
  const { data: inventarios = [] } = useInventariosPendentes();
  const decidirQ = useDecidirQuarentena(); const decidirI = useDecidirInventario();
  const [sel, setSel] = useState<EstoqueSku | null>(null);
  const skus = data?.skus || [];
  return (
    <div className="space-y-4">
      <FiltroUnidade value={unidade} onChange={setUnidade} />

      {(quarentena.length > 0 || inventarios.length > 0) && (
        <div className="card-premium p-4 space-y-2">
          <p className="font-medium text-sm">Aguardando aprovação</p>
          {quarentena.map((q: any) => (
            <div key={q.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-2">
              <span className="font-mono text-gold">{q.decant_skus?.sku}</span>
              <span>{q.quantidade} un em quarentena · {q.motivo}</span>
              <div className="flex-1" />
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => exec(decidirQ.mutateAsync({ id: q.id, acao: "descartar", lacrado: false, obs: "" }), "Descartado.")}>Descartar</button>
              <button className="btn-primary px-3 py-1 text-xs" onClick={() => exec(decidirQ.mutateAsync({ id: q.id, acao: "retornar", lacrado: true, obs: "Lacrado e íntegro" }), "Voltou ao estoque.")}>Lacrado: voltar ao estoque</button>
            </div>
          ))}
          {inventarios.map((i: any) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-2">
              <span className="font-mono text-gold">{i.decant_skus?.sku}</span>
              <span>Inventário: sistema {i.saldo_sistema}, contado {i.contado} ({i.diferenca > 0 ? "+" : ""}{i.diferenca}) · {i.justificativa}</span>
              <div className="flex-1" />
              <button className="btn-secondary px-3 py-1 text-xs" onClick={() => exec(decidirI.mutateAsync({ id: i.id, aprovar: false }), "Rejeitado.")}>Rejeitar</button>
              <button className="btn-primary px-3 py-1 text-xs" onClick={() => exec(decidirI.mutateAsync({ id: i.id, aprovar: true }), "Ajuste aprovado.")}>Aprovar ajuste</button>
            </div>
          ))}
        </div>
      )}

      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : error ? <div className="card-premium p-8 text-center text-destructive">Não foi possível carregar o estoque.</div>
        : (
          <>
            <div>
              <p className="font-medium mb-2">Decants prontos</p>
              {skus.length === 0 ? <div className="card-premium p-6 text-center text-muted-foreground">Nenhum decant pronto. Eles entram aqui depois da conferência da produção.</div> : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {skus.map((s) => {
                    const baixo = s.estoque_minimo > 0 && s.quantidade <= s.estoque_minimo;
                    return (
                      <button key={s.sku_id + s.unidade_id} onClick={() => setSel(s)} className="card-premium p-4 text-left hover:border-gold transition-colors">
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-gold text-sm">{s.sku}</span>
                          <span className={`font-semibold ${s.quantidade === 0 || baixo ? "text-destructive" : "text-success"}`}>{s.quantidade} un</span>
                        </div>
                        <p className="text-sm font-medium truncate mt-1">{s.marca} - {s.nome} - {fmtMl(Number(s.volume_ml))}</p>
                        <p className="text-xs text-muted-foreground">{s.unidade_nome} · {fmtBRL(Number(s.preco_venda))}{s.custo_medio !== null && ` · custo ${fmtBRL(Number(s.custo_medio))}`}</p>
                        <p className="text-xs text-muted-foreground">Mín. {s.estoque_minimo} · Ideal {s.estoque_ideal}
                          {s.quarentena > 0 && ` · ${s.quarentena} em quarentena`}{s.sob_demanda_pendente > 0 && ` · ${s.sob_demanda_pendente} sob demanda`}</p>
                        {baixo && <p className="text-xs text-destructive flex gap-1 mt-1"><AlertTriangle className="w-3.5 h-3.5" /> Abaixo do mínimo</p>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium">Estoque potencial <span className="text-xs text-muted-foreground font-normal">(simulação: o que dá para produzir; não é estoque)</span></p>
              {(data?.potencial || []).length === 0 ? <p className="text-sm text-muted-foreground mt-1">Nenhum frasco aberto.</p> : (
                <div className="grid gap-2 sm:grid-cols-2 mt-2">
                  {data!.potencial.map((p) => (
                    <div key={p.produto_id + p.unidade_id} className="card-premium p-3 text-sm border-dashed">
                      <p className="font-medium truncate">{p.marca} - {p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.unidade_nome} · {fmtMl(p.disponivel_ml)} disponíveis</p>
                      <p className="mt-1">{estoquePotencial(p.disponivel_ml, data!.tamanhos).map((t) => `${t.quantidade}×${t.volumeMl.toLocaleString("pt-BR")} ml`).join(" ou ")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      {sel && <DialogoSkuEstoque s={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DialogoSkuEstoque({ s, onClose }: { s: EstoqueSku; onClose: () => void }) {
  const salvar = useSalvarMinIdeal(); const contar = useContarInventario();
  const [min, setMin] = useState(String(s.estoque_minimo)); const [ideal, setIdeal] = useState(String(s.estoque_ideal));
  const [contado, setContado] = useState(""); const [just, setJust] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-mono">{s.sku} · {s.unidade_nome}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <p>{s.marca} - {s.nome} - {fmtMl(Number(s.volume_ml))} · <b>{s.quantidade} un</b></p>
          {s.lotes.length > 0 && <p className="text-xs text-muted-foreground">Por lote: {s.lotes.map((l) => `${l.lote || "sem lote"}: ${l.quantidade}`).join(" · ")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Estoque mínimo"><input type="number" min={0} onWheel={blurWheel} className="input-premium" value={min} onChange={(e) => setMin(e.target.value)} /></Campo>
            <Campo label="Estoque ideal"><input type="number" min={0} onWheel={blurWheel} className="input-premium" value={ideal} onChange={(e) => setIdeal(e.target.value)} /></Campo>
          </div>
          <button className="btn-secondary w-full py-2" disabled={salvar.isPending}
            onClick={() => exec(salvar.mutateAsync({ skuId: s.sku_id, unidadeId: s.unidade_id, minimo: parseInt(min) || 0, ideal: parseInt(ideal) || 0 }), "Salvo.")}>Salvar mínimo e ideal</button>
          <div className="card-premium p-3 space-y-2">
            <p className="font-medium">Inventário (contagem)</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Quantidade contada"><input type="number" min={0} onWheel={blurWheel} className="input-premium" value={contado} onChange={(e) => setContado(e.target.value)} /></Campo>
              <Campo label="Justificativa (se diferente)"><input className="input-premium" value={just} onChange={(e) => setJust(e.target.value)} /></Campo>
            </div>
            <button className="btn-primary w-full py-2" disabled={contar.isPending || contado === ""}
              onClick={async () => {
                try {
                  const r = await contar.mutateAsync({ skuId: s.sku_id, unidadeId: s.unidade_id, contado: parseInt(contado), justificativa: just });
                  toast.success(r.status === "ok" ? "Contagem confere." : `Diferença de ${r.diferenca}. Aguardando aprovação.`); onClose();
                } catch (e: any) { toast.error(e.message); }
              }}>Registrar contagem</button>
            <p className="text-xs text-muted-foreground">Diferenças só mudam o estoque depois de aprovadas.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Movimentações ================= */
export function AbaMovimentacoesDecant() {
  const [f, setF] = useState({ unidade_id: "", tipo: "", de: "", ate: "", busca: "" });
  const [limite, setLimite] = useState(30);
  const { data: movs = [], isLoading } = useMovimentacoesDecant(f, limite);
  const exportar = async () => {
    try {
      const rows = await exportarMovimentacoes(f);
      const head = ["Data", "Hora", "Tipo", "Produto", "Frasco", "Lote", "Quantidade", "ml", "Origem", "Destino", "Usuário", "Motivo"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const linhas = rows.map((m) => { const d = new Date(m.em);
        return [d.toLocaleDateString("pt-BR", { timeZone: "America/Manaus" }), d.toLocaleTimeString("pt-BR", { timeZone: "America/Manaus" }),
          ROTULO_MOV[m.tipo] || m.tipo, m.produto, m.frasco, m.lote, m.quantidade, m.ml != null ? String(m.ml).replace(".", ",") : "",
          m.origem, m.destino, m.usuario, m.motivo].map(esc).join(";"); });
      const blob = new Blob(["\ufeff" + [head.join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "movimentacoes-decants.csv"; a.click();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-6">
        <FiltroUnidade value={f.unidade_id} onChange={(v) => setF({ ...f, unidade_id: v })} />
        <select className="input-premium" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos os tipos</option>{Object.entries(ROTULO_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className="input-premium" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
        <input type="date" className="input-premium" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
        <input className="input-premium" placeholder="Buscar produto, frasco, lote" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
        <button className="btn-secondary px-3 py-2 text-sm" onClick={exportar}><Download className="w-4 h-4 inline mr-1" />Exportar</button>
      </div>
      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : movs.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhuma movimentação.</div> : (
          <div className="card-premium overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground text-left">{["Data", "Tipo", "Produto", "Frasco", "Lote", "Qtd", "ml", "Origem", "Destino", "Usuário", "Motivo"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
              <tbody>
                {movs.map((m, k) => (
                  <tr key={k} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{dataHora(m.em)}</td><td className="p-2">{ROTULO_MOV[m.tipo] || m.tipo}</td>
                    <td className="p-2 min-w-[180px]">{m.produto}</td><td className="p-2 font-mono text-xs">{m.frasco}</td>
                    <td className="p-2 font-mono text-xs">{m.lote}</td>
                    <td className={`p-2 ${m.quantidade < 0 ? "text-destructive" : ""}`}>{m.quantidade ?? ""}</td>
                    <td className={`p-2 ${m.ml < 0 ? "text-destructive" : ""}`}>{m.ml != null ? fmtMl(Number(m.ml)) : ""}</td>
                    <td className="p-2">{m.origem}</td><td className="p-2">{m.destino}</td><td className="p-2">{m.usuario}</td>
                    <td className="p-2 text-xs text-muted-foreground">{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movs.length >= limite && <button className="btn-secondary w-full py-2 text-sm" onClick={() => setLimite(limite + 30)}>Carregar mais</button>}
          </div>
        )}
    </div>
  );
}

/* ================= Vendas (visão filtrada) ================= */
export function AbaVendasDecant() {
  const [f, setF] = useState({ unidade_id: "", canal: "", de: "", ate: "" });
  const { data: vendas = [], isLoading } = useVendasDecant(f);
  const cancelar = useCancelarVendaDecant(); const devolver = useDevolverDecant();
  const [acao, setAcao] = useState<{ tipo: "cancelar" | "devolver"; v: any } | null>(null);
  const [motivo, setMotivo] = useState(""); const [qtd, setQtd] = useState("1"); const [estornar, setEstornar] = useState(false);
  const total = vendas.filter((v) => v.status !== "cancelada").reduce((a, v) => a + Number(v.total), 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <FiltroUnidade value={f.unidade_id} onChange={(v) => setF({ ...f, unidade_id: v })} />
        <select className="input-premium" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
          <option value="">Todos os canais</option>{CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="date" className="input-premium" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
        <input type="date" className="input-premium" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">Vendas feitas no PDV pelo botão "Decants". Total no filtro: <b className="text-foreground">{fmtBRL(total)}</b></p>
      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : vendas.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhuma venda de decant.</div> : (
          <div className="grid gap-2">
            {vendas.map((v) => (
              <div key={v.id} className="card-premium p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs text-muted-foreground">{dataHora(v.created_at)}</span>
                <span className="font-mono text-gold">{v.sku}</span>
                <span>{v.quantidade}× {fmtBRL(Number(v.preco_unit))} = <b>{fmtBRL(Number(v.total))}</b></span>
                <span className="text-xs">{CANAIS.find((c) => c.value === v.canal)?.label} · {v.unidade_nome} · {v.pagamentos}</span>
                {v.margem_pct != null && <span className="text-xs">margem {Number(v.margem_pct).toLocaleString("pt-BR")}%</span>}
                <span className={`text-xs ${v.status === "cancelada" ? "text-destructive" : v.status === "pendente_producao" ? "text-gold" : "text-success"}`}>
                  {v.status === "cancelada" ? `Cancelada: ${v.motivo_cancelamento}` : v.status === "pendente_producao" ? `Aguardando produção ${v.lote_producao || ""}` : "Concluída"}
                  {v.qtd_devolvida > 0 && ` · ${v.qtd_devolvida} devolvido(s)`}</span>
                <div className="flex-1" />
                {v.status !== "cancelada" && v.qtd_devolvida === 0 && <button className="btn-secondary px-3 py-1 text-xs" onClick={() => { setAcao({ tipo: "cancelar", v }); setMotivo(""); }}>Cancelar (não saiu)</button>}
                {v.status === "concluida" && v.qtd_devolvida < v.quantidade && <button className="btn-secondary px-3 py-1 text-xs" onClick={() => { setAcao({ tipo: "devolver", v }); setMotivo(""); setQtd("1"); setEstornar(false); }}>Devolução</button>}
              </div>
            ))}
          </div>
        )}
      {acao && (
        <Dialog open onOpenChange={() => setAcao(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{acao.tipo === "cancelar" ? "Cancelar venda de decant" : "Devolução de decant"}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>{acao.v.sku} · {acao.v.quantidade} un · {fmtBRL(Number(acao.v.total))}</p>
              {acao.tipo === "cancelar"
                ? <p className="text-xs text-muted-foreground">Use quando o produto não saiu da loja: volta ao estoque. Cancela a venda inteira e devolve o dinheiro no caixa.</p>
                : <p className="text-xs text-muted-foreground">Produto entregue e devolvido vai para quarentena. Só volta ao estoque se aprovado como lacrado e íntegro.</p>}
              {acao.tipo === "devolver" && <>
                <Campo label="Quantidade"><input type="number" min={1} onWheel={blurWheel} className="input-premium" value={qtd} onChange={(e) => setQtd(e.target.value)} /></Campo>
                <label className="flex items-center gap-2"><input type="checkbox" checked={estornar} onChange={(e) => setEstornar(e.target.checked)} /> Devolver o valor em dinheiro pelo caixa</label>
              </>}
              <Campo label="Motivo"><input className="input-premium" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
              <button className="btn-primary w-full py-2.5" disabled={cancelar.isPending || devolver.isPending} onClick={async () => {
                const ok = acao.tipo === "cancelar"
                  ? await exec(cancelar.mutateAsync({ grupo: acao.v.grupo_venda, motivo }), "Venda cancelada. Estoque restaurado.")
                  : await exec(devolver.mutateAsync({ vendaId: acao.v.id, quantidade: parseInt(qtd), motivo, estornar }), "Devolução registrada em quarentena.");
                if (ok) setAcao(null);
              }}>Confirmar</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ================= Transferências ================= */
const STATUS_TR: Record<string, string> = { solicitada: "Solicitada", separada: "Separada", em_transito: "Em trânsito", divergencia: "Divergência", finalizada: "Finalizada", cancelada: "Cancelada" };

export function AbaTransferenciasDecant() {
  const [unidade, setUnidade] = useState("");
  const { data: lista = [], isLoading } = useTransferenciasDecant(unidade || null);
  const [nova, setNova] = useState(false);
  const [sel, setSel] = useState<any | null>(null);
  const atual = sel && (lista.find((t) => t.id === sel.id) || sel);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FiltroUnidade value={unidade} onChange={setUnidade} />
        <div className="flex-1" />
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setNova(true)}><Truck className="w-4 h-4 inline mr-1" />Nova transferência</button>
      </div>
      {isLoading ? <div className="card-premium p-8 text-center text-muted-foreground">Carregando…</div>
        : lista.length === 0 ? <div className="card-premium p-8 text-center text-muted-foreground">Nenhuma transferência de decants.</div> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((t) => (
              <button key={t.id} onClick={() => setSel(t)} className="card-premium p-4 text-left hover:border-gold transition-colors">
                <div className="flex justify-between"><span className="font-mono text-gold text-sm">{t.codigo}</span>
                  <span className={`text-xs ${t.status === "divergencia" ? "text-destructive" : t.status === "finalizada" ? "text-success" : "text-gold"}`}>{STATUS_TR[t.status]}</span></div>
                <p className="text-sm mt-1">{t.origem_nome} → {t.destino_nome}</p>
                <p className="text-xs text-muted-foreground">{t.itens.map((i: any) => `${i.quantidade}× ${i.descricao}`).join(" · ")}</p>
              </button>
            ))}
          </div>
        )}
      {nova && <DialogoNovaTransf onClose={() => setNova(false)} />}
      {atual && <DialogoTransf t={atual} onClose={() => setSel(null)} />}
    </div>
  );
}

function DialogoNovaTransf({ onClose }: { onClose: () => void }) {
  const { unidadesEstoque } = useUnidades();
  const { data: cfg } = useDecantConfig();
  const [origem, setOrigem] = useState(""); const [destino, setDestino] = useState(""); const [obs, setObs] = useState("");
  const { data: est } = useEstoqueDecants(origem || null);
  const { data: fechados = [] } = useFechadosSaldo();
  const { data: frascos = [] } = useFrascosAbertos(origem || null);
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [chave] = useState(() => crypto.randomUUID());
  const criar = useCriarTransfDecant();
  const prontos = (est?.skus || []).filter((s) => s.quantidade > 0 && s.unidade_id === origem);
  const fech = fechados.filter((f) => f.unidade_id === origem);
  const salvar = async () => {
    const itens: any[] = [];
    prontos.forEach((s) => { const q = parseInt(qtd["p" + s.sku_id] || "0"); if (q > 0) itens.push({ tipo: "pronto", sku_id: s.sku_id, quantidade: q }); });
    fech.forEach((f) => { const q = parseInt(qtd["f" + f.produto_id] || "0"); if (q > 0) itens.push({ tipo: "fechado", produto_id: f.produto_id, quantidade: q }); });
    frascos.forEach((f) => { if (qtd["a" + f.id] === "1") itens.push({ tipo: "frasco", frasco_id: f.id }); });
    if (!origem || !destino || origem === destino) return toast.error("Escolha origem e destino diferentes.");
    if (!itens.length) return toast.error("Informe ao menos um item.");
    if (await exec(criar.mutateAsync({ origem, destino, itens, obs, chave }), "Transferência solicitada.")) onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova transferência de decants</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Origem"><select className="input-premium" value={origem} onChange={(e) => { setOrigem(e.target.value); setQtd({}); }}>
              <option value="">Selecione</option>{unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}</select></Campo>
            <Campo label="Destino"><select className="input-premium" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecione</option>{unidadesEstoque.filter((u) => u.id !== origem).map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}</select></Campo>
          </div>
          {origem && <>
            {prontos.length > 0 && <p className="font-medium">Decants prontos</p>}
            {prontos.map((s) => (
              <div key={s.sku_id} className="flex items-center gap-2"><span className="flex-1 truncate"><span className="font-mono text-gold">{s.sku}</span> ({s.quantidade})</span>
                <input type="number" min={0} max={s.quantidade} onWheel={blurWheel} className="input-premium w-20" value={qtd["p" + s.sku_id] || ""} onChange={(e) => setQtd({ ...qtd, ["p" + s.sku_id]: e.target.value })} /></div>
            ))}
            {fech.length > 0 && <p className="font-medium">Frascos fechados para decant</p>}
            {fech.map((f) => (
              <div key={f.produto_id} className="flex items-center gap-2"><span className="flex-1 truncate">{(est?.skus.find((s) => s.produto_id === f.produto_id)?.nome) || "Perfume"} ({f.quantidade})</span>
                <input type="number" min={0} max={f.quantidade} onWheel={blurWheel} className="input-premium w-20" value={qtd["f" + f.produto_id] || ""} onChange={(e) => setQtd({ ...qtd, ["f" + f.produto_id]: e.target.value })} /></div>
            ))}
            {cfg?.transferir_frasco_aberto && frascos.length > 0 && <>
              <p className="font-medium">Frascos abertos <span className="text-xs text-muted-foreground font-normal">(autorização especial)</span></p>
              {frascos.filter((f) => f.status === "aberto").map((f) => (
                <label key={f.id} className="flex items-center gap-2"><input type="checkbox" checked={qtd["a" + f.id] === "1"} onChange={(e) => setQtd({ ...qtd, ["a" + f.id]: e.target.checked ? "1" : "" })} />
                  <span className="font-mono text-gold">{f.codigo}</span> {f.marca} - {f.nome} · {fmtMl(f.saldo_ml)}</label>
              ))}
            </>}
            {!prontos.length && !fech.length && <p className="text-muted-foreground">Nada disponível para transferir nesta filial.</p>}
          </>}
          <Campo label="Observação"><input className="input-premium" value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
          <button className="btn-primary w-full py-2.5" disabled={criar.isPending} onClick={salvar}>Solicitar transferência</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoTransf({ t, onClose }: { t: any; onClose: () => void }) {
  const acao = useAcaoTransfDecant();
  const [transp, setTransp] = useState(""); const [motivo, setMotivo] = useState("");
  const [rec, setRec] = useState<Record<string, string>>(() => Object.fromEntries(t.itens.map((i: any) => [i.id, String(i.quantidade)])));
  const run = (a: any, extra: any, ok: string) => exec(acao.mutateAsync({ acao: a, id: t.id, extra }), ok);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">{t.codigo} · {STATUS_TR[t.status]}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>{t.origem_nome} → {t.destino_nome}{t.transportador && ` · ${t.transportador}`}</p>
          <CartaoNotaTransferencia tipo="decant" origemId={t.id} />
          {t.itens.map((i: any) => (
            <div key={i.id} className="flex items-center gap-2">
              <span className="flex-1">{i.quantidade}× {i.descricao}{i.qtd_recebida != null && ` · recebido ${i.qtd_recebida}`}{i.diferenca < 0 && <span className="text-destructive"> ({i.diferenca})</span>}</span>
              {t.status === "em_transito" && <input type="number" min={0} max={i.quantidade} onWheel={blurWheel} className="input-premium w-20" aria-label="Recebido"
                value={rec[i.id]} onChange={(e) => setRec({ ...rec, [i.id]: e.target.value })} />}
            </div>
          ))}
          {t.resolucao && <p className="text-xs text-muted-foreground">{t.resolucao}</p>}
          {t.status === "solicitada" && <>
            <button className="btn-primary w-full py-2" onClick={() => run("separar", null, "Separado. Itens saíram da origem.")}>Separar (tira da origem)</button>
            <div className="flex gap-2"><input className="input-premium flex-1" placeholder="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <button className="btn-secondary px-3 text-xs" onClick={() => run("cancelar", motivo, "Cancelada.")}>Cancelar</button></div>
          </>}
          {t.status === "separada" && <>
            <Campo label="Transportador"><input className="input-premium" value={transp} onChange={(e) => setTransp(e.target.value)} /></Campo>
            <button className="btn-primary w-full py-2" onClick={() => run("enviar", transp, "Em trânsito.")}>Enviar</button>
          </>}
          {t.status === "em_transito" && <>
            <p className="text-xs text-muted-foreground">Confira o que chegou. Só entra no destino o que for recebido; falta gera divergência.</p>
            <button className="btn-primary w-full py-2" onClick={() => run("receber", t.itens.map((i: any) => ({ item_id: i.id, qtd_recebida: parseInt(rec[i.id]) })), "Recebimento registrado.")}>Confirmar recebimento</button>
          </>}
          {t.status === "divergencia" && <>
            <Campo label="Justificativa"><input className="input-premium" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary py-2" onClick={() => run("resolver", { resolucao: "retorno_origem", justificativa: motivo }, "Falta devolvida à origem.")}>Falta volta à origem</button>
              <button className="btn-secondary py-2" onClick={() => run("resolver", { resolucao: "perda", justificativa: motivo }, "Falta registrada como perda.")}>Registrar perda</button>
            </div>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
