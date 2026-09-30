import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/data/mockData";
import { getHojeManaus } from "@/lib/dateUtils";
import { useGrupoVenda, useAcoesVenda, usePrazoDevolucao } from "@/hooks/useDevolucoes";
import {
  DESTINOS_ITEM, FORMAS_REEMBOLSO, diferencaTroca, foraDoPrazo, round2, saldoDevolvivel, valorUnitarioLiquido,
  type DestinoItem, type FormaReembolso,
} from "@/lib/devolucao";

export type ModoAcaoVenda = "cancelar" | "devolver" | "trocar";

const TIPOS_PAG = ["Dinheiro", "Pix", "Débito", "Crédito"];
const fmtData = (d: string) => d.split("-").reverse().join("/");

interface Props {
  grupoVenda: string | null;
  modo: ModoAcaoVenda;
  onClose: () => void;
}

function imprimirComprovante(p: {
  titulo: string; numero: string; loja: string; motivo: string; itens: { nome: string; qtd: number; valor: number; destino?: string }[];
  totalDevolvido: number; novos?: { nome: string; qtd: number; valor: number }[]; totalNovo?: number; diferenca?: number; forma?: string;
}) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { toast.error("Libere as janelas pop-up para imprimir"); return; }
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" });
  const linhas = (arr: { nome: string; qtd: number; valor: number; destino?: string }[]) =>
    arr.map(i => `<div>${i.qtd}x ${i.nome}${i.destino ? ` <small>(${i.destino})</small>` : ""}</div><div class="r">${formatCurrency(i.valor)}</div>`).join("");
  w.document.write(`<html><head><title>${p.numero}</title><style>
    body{font-family:Arial;font-weight:900;width:72mm;margin:0 auto;font-size:13px}
    h1{font-size:16px;text-align:center;margin:6px 0} .r{text-align:right} hr{border:0;border-top:1px dashed #000}
    .row{display:flex;justify-content:space-between} small{font-weight:400}
  </style></head><body>
  <h1>${p.titulo}</h1><div style="text-align:center">${p.numero}</div><div style="text-align:center">${p.loja} · ${agora}</div><hr/>
  <b>Itens devolvidos</b>${linhas(p.itens)}
  <div class="row"><span>Total devolvido</span><span>${formatCurrency(p.totalDevolvido)}</span></div>
  ${p.novos?.length ? `<hr/><b>Itens levados</b>${linhas(p.novos)}<div class="row"><span>Total novos</span><span>${formatCurrency(p.totalNovo || 0)}</span></div>` : ""}
  ${p.diferenca !== undefined ? `<div class="row"><span>${p.diferenca >= 0 ? "Cliente pagou" : "Devolvido ao cliente"}</span><span>${formatCurrency(Math.abs(p.diferenca))}</span></div>` : ""}
  ${p.forma ? `<div>Reembolso: ${p.forma}</div>` : ""}
  <hr/><div>Motivo: ${p.motivo}</div><br/><br/><div style="text-align:center">_____________________<br/>Assinatura do cliente</div>
  <script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}

export default function AcoesVendaDialog({ grupoVenda, modo, onClose }: Props) {
  const { data: grupo, isLoading, error } = useGrupoVenda(grupoVenda);
  const { data: prazo = 30 } = usePrazoDevolucao();
  const { cancelar, devolver, trocar } = useAcoesVenda();
  const { perfumes, concentracoesConfig } = useApp();

  const [motivo, setMotivo] = useState("");
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [destinos, setDestinos] = useState<Record<string, DestinoItem>>({});
  const [forma, setForma] = useState<FormaReembolso>("dinheiro");
  const [novos, setNovos] = useState<{ produtoId: string; quantidade: number; preco: number }[]>([]);
  const [novoSel, setNovoSel] = useState("");
  const [pagDif, setPagDif] = useState("Pix");
  const [resultado, setResultado] = useState<null | (() => void)>(null);

  useEffect(() => { setMotivo(""); setQtds({}); setDestinos({}); setNovos([]); setResultado(null); }, [grupoVenda, modo]);

  const itensSel = useMemo(() => (grupo?.itens || [])
    .filter(i => (qtds[i.id] || 0) > 0)
    .map(i => ({ ...i, qtd: qtds[i.id], unit: valorUnitarioLiquido(i.total, i.quantidade), destino: destinos[i.id] || "estoque" })), [grupo, qtds, destinos]);
  const totalDevolvido = round2(itensSel.reduce((s, i) => s + i.unit * i.qtd, 0));
  const totalNovo = round2(novos.reduce((s, n) => s + n.preco * n.quantidade, 0));
  const dif = diferencaTroca(totalDevolvido, totalNovo);
  const fora = grupo ? foraDoPrazo(grupo.data, getHojeManaus(), prazo) : false;
  const totalVenda = round2((grupo?.itens || []).reduce((s, i) => s + i.total, 0));
  const pending = cancelar.isPending || devolver.isPending || trocar.isPending;
  const precisaCliente = (forma === "credito_loja" || forma === "vale_troca") && !grupo?.clienteId;

  const titulo = modo === "cancelar" ? "Cancelar venda" : modo === "devolver" ? "Devolver itens" : "Trocar itens";

  const confirmar = async () => {
    if (!grupo) return;
    if (!motivo.trim()) { toast.error("Informe o motivo"); return; }
    const itens = itensSel.map(i => ({ venda_id: i.id, quantidade: i.qtd, destino: i.destino }));
    try {
      if (modo === "cancelar") {
        const r = await cancelar.mutateAsync({ grupoVenda: grupo.grupoVenda, motivo: motivo.trim() });
        toast.success(`Venda cancelada (${formatCurrency(Number(r.valor))}). Estoque devolvido.`);
        onClose();
        return;
      }
      if (!itens.length) { toast.error("Selecione ao menos um item"); return; }
      const nomeDest = (d: string) => DESTINOS_ITEM.find(x => x.value === d)?.label || d;
      const itensPrint = itensSel.map(i => ({ nome: i.perfumeNome, qtd: i.qtd, valor: i.unit * i.qtd, destino: nomeDest(i.destino) }));
      if (modo === "devolver") {
        if (precisaCliente) { toast.error("Esta venda não tem cliente: escolha outra forma de reembolso"); return; }
        const r = await devolver.mutateAsync({ grupoVenda: grupo.grupoVenda, itens, motivo: motivo.trim(), forma });
        toast.success(`Devolução ${r.numero} registrada (${formatCurrency(Number(r.valor))})`);
        const f = FORMAS_REEMBOLSO.find(x => x.value === forma)?.label;
        setResultado(() => () => imprimirComprovante({ titulo: "COMPROVANTE DE DEVOLUÇÃO", numero: r.numero, loja: grupo.deposito,
          motivo: motivo.trim(), itens: itensPrint, totalDevolvido: Number(r.valor), forma: f }));
      } else {
        if (!novos.length) { toast.error("Adicione os novos produtos"); return; }
        if (dif.aReceber > 0 && precisaCliente) { toast.error("Esta venda não tem cliente: escolha outra forma para a diferença"); return; }
        const r = await trocar.mutateAsync({
          grupoVenda: grupo.grupoVenda, itensDevolvidos: itens, motivo: motivo.trim(),
          itensNovos: novos.map(n => ({ produto_id: n.produtoId, quantidade: n.quantidade, preco_unitario: n.preco })),
          pagamentos: dif.aPagar > 0 ? [{ tipo_pagamento: pagDif, bandeira: ["Débito", "Crédito"].includes(pagDif) ? "Visa" : "N/A", valor: dif.aPagar }] : [],
          formaDiferenca: dif.aReceber > 0 ? forma : null,
        });
        toast.success(`Troca ${r.numero} registrada`);
        const nome = (id: string) => perfumes.find(p => p.id === id)?.nome || "";
        setResultado(() => () => imprimirComprovante({ titulo: "COMPROVANTE DE TROCA", numero: r.numero, loja: grupo.deposito, motivo: motivo.trim(),
          itens: itensPrint, totalDevolvido: Number(r.valor_devolvido),
          novos: novos.map(n => ({ nome: nome(n.produtoId), qtd: n.quantidade, valor: n.preco * n.quantidade })), totalNovo: Number(r.valor_novo),
          diferenca: Number(r.diferenca), forma: dif.aReceber > 0 ? FORMAS_REEMBOLSO.find(x => x.value === forma)?.label : pagDif }));
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível concluir. Nada foi gravado.");
    }
  };

  const addNovo = (id: string) => {
    const p = perfumes.find(x => x.id === id);
    if (!p) return;
    setNovos(prev => prev.some(n => n.produtoId === id) ? prev : [...prev, { produtoId: id, quantidade: 1, preco: p.precoVenda }]);
    setNovoSel("");
  };

  const input = "px-2 py-1.5 rounded-lg text-xs text-foreground outline-none bg-background border border-border";

  return (
    <Dialog open={!!grupoVenda} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[80]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {grupo ? `${fmtData(grupo.data)} · ${grupo.deposito} · ${formatCurrency(totalVenda)}` : "Carregando venda..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gold" /></div>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {resultado && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">Operação concluída com sucesso.</p>
            <div className="flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2" onClick={resultado}><Printer size={14} /> Imprimir comprovante</button>
              <button className="btn-secondary flex-1 py-2 text-sm" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {grupo && !resultado && (
          <div className="space-y-4">
            {grupo.cancelada && <p className="text-sm text-destructive">Esta venda já está cancelada.</p>}
            {fora && modo !== "cancelar" && (
              <p className="text-xs flex items-center gap-1.5 text-warning"><AlertTriangle size={14} /> Venda com mais de {prazo} dias: exige aprovação de gerente.</p>
            )}
            {modo === "cancelar" && grupo.devolucoes.length > 0 && (
              <p className="text-sm text-destructive">Esta venda já tem devolução/troca e não pode ser cancelada.</p>
            )}

            {modo === "cancelar" ? (
              <div className="space-y-1 text-sm">
                {grupo.itens.map(i => (
                  <div key={i.id} className="flex justify-between"><span>{i.quantidade}x {i.perfumeNome}</span><span>{formatCurrency(i.total)}</span></div>
                ))}
                <p className="text-xs text-muted-foreground pt-2">Todos os itens voltam ao estoque da loja da venda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Itens a devolver</p>
                {grupo.itens.map(i => {
                  const max = saldoDevolvivel(i.quantidade, i.jaDevolvido);
                  return (
                    <div key={i.id} className="rounded-xl p-2.5 space-y-2 bg-surface-raised">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{i.perfumeNome}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{formatCurrency(valorUnitarioLiquido(i.total, i.quantidade))}/un</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input type="number" min={0} max={max} disabled={max === 0} value={qtds[i.id] ?? ""} placeholder="0"
                          onWheel={e => (e.target as HTMLInputElement).blur()}
                          onChange={e => setQtds(q => ({ ...q, [i.id]: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                          className={`${input} w-16 text-right`} />
                        <span className="text-[11px] text-muted-foreground">de {max}{i.jaDevolvido ? ` (já devolvido ${i.jaDevolvido})` : ""}</span>
                        <select value={destinos[i.id] || "estoque"} onChange={e => setDestinos(d => ({ ...d, [i.id]: e.target.value as DestinoItem }))}
                          className={`${input} ml-auto`}>
                          {DESTINOS_ITEM.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm font-semibold pt-1"><span>Total devolvido</span><span className="text-gold">{formatCurrency(totalDevolvido)}</span></div>
              </div>
            )}

            {modo === "trocar" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Novos produtos</p>
                <PerfumeSearchSelect perfumes={perfumes} value={novoSel} onChange={addNovo} concentracoesConfig={concentracoesConfig} />
                {novos.map((n, idx) => {
                  const p = perfumes.find(x => x.id === n.produtoId);
                  return (
                    <div key={n.produtoId} className="flex gap-2 items-center text-sm">
                      <span className="flex-1 min-w-0 truncate">{p?.nome}</span>
                      <input type="number" min={1} value={n.quantidade} onWheel={e => (e.target as HTMLInputElement).blur()}
                        onChange={e => setNovos(arr => arr.map((x, i) => i === idx ? { ...x, quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x))}
                        className={`${input} w-14 text-right`} />
                      <span className="w-24 text-right">{formatCurrency(n.preco * n.quantidade)}</span>
                      <button onClick={() => setNovos(arr => arr.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
                {!novos.length && <p className="text-xs text-muted-foreground flex items-center gap-1"><Plus size={12} /> Busque o produto que o cliente vai levar</p>}
                <div className="flex justify-between text-sm"><span>Total novos</span><span>{formatCurrency(totalNovo)}</span></div>
                {novos.length > 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{dif.aPagar > 0 ? "Cliente paga" : dif.aReceber > 0 ? "Cliente recebe" : "Sem diferença"}</span>
                    <span className={dif.aPagar > 0 ? "text-gold" : "text-success"}>{formatCurrency(dif.aPagar || dif.aReceber)}</span>
                  </div>
                )}
                {dif.aPagar > 0 && (
                  <label className="flex items-center gap-2 text-xs">Pagamento da diferença
                    <select value={pagDif} onChange={e => setPagDif(e.target.value)} className={`${input} ml-auto`}>
                      {TIPOS_PAG.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}

            {(modo === "devolver" || (modo === "trocar" && dif.aReceber > 0)) && (
              <label className="flex items-center gap-2 text-xs">Forma de reembolso
                <select value={forma} onChange={e => setForma(e.target.value as FormaReembolso)} className={`${input} ml-auto`}>
                  {FORMAS_REEMBOLSO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
            )}
            {precisaCliente && (modo === "devolver" || dif.aReceber > 0) && (
              <p className="text-xs text-destructive">Crédito e vale-troca exigem cliente cadastrado na venda.</p>
            )}

            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (obrigatório)" rows={2}
              className={`${input} w-full text-sm`} />

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Voltar</button>
              <button onClick={confirmar}
                disabled={pending || grupo.cancelada || !motivo.trim() || (modo === "cancelar" && grupo.devolucoes.length > 0)}
                className={`flex-1 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${modo === "cancelar" ? "rounded-xl bg-destructive text-destructive-foreground" : "btn-primary"}`}>
                {pending && <Loader2 size={14} className="animate-spin" />} Confirmar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
