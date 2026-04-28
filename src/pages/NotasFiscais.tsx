import { useState, useRef, useEffect } from "react";
import { FileText, Upload, Check, X, Plus, Pencil } from "lucide-react";
import { useNotasFiscais, type NotaFiscal } from "@/hooks/useNotasFiscais";
import { useProdutoCustos } from "@/hooks/useProdutoCustos";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import FiscalCostCalculator, { type FiscalBreakdown } from "@/components/FiscalCostCalculator";
import { formatCurrency, formatDate, type Deposito } from "@/data/mockData";
import { processarXmlNFe } from "@/lib/nfeXmlParser";

type SubTab = "pendentes" | "conciliadas" | "canceladas";

interface EditableQty {
  [itemId: string]: number;
}

export default function NotasFiscais() {
  const { notas, isLoading, criarNota, atualizarCorrespondencia, conciliarNota, cancelarNota } = useNotasFiscais();
  const { perfumes, adicionarEstoque, concentracoesConfig } = useApp();
  const { profile } = useAuth();
  const { atualizarCustoMedio } = useProdutoCustos();
  const [subTab, setSubTab] = useState<SubTab>("pendentes");
  const [notaSelecionada, setNotaSelecionada] = useState<NotaFiscal | null>(null);
  const [depositoDestino, setDepositoDestino] = useState<string>("Casa");
  const [editableQtds, setEditableQtds] = useState<EditableQty>({});
  const [showManual, setShowManual] = useState(false);
  const [manualFiscal, setManualFiscal] = useState<FiscalBreakdown | null>(null);
  const [conciliando, setConciliando] = useState(false);
  const [salvandoManual, setSalvandoManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual invoice form
  const [manualForm, setManualForm] = useState({
    fornecedor: "",
    perfumeId: "",
    quantidade: 1,
    custoUnitario: 0,
    data: new Date().toISOString().split("T")[0],
    observacao: "",
    deposito: "Casa" as Deposito,
  });

  // Mantém notaSelecionada sincronizada com refetch após atualizar correspondência
  useEffect(() => {
    if (!notaSelecionada) return;
    const atualizada = notas.find((n) => n.id === notaSelecionada.id);
    if (atualizada && atualizada !== notaSelecionada) {
      setNotaSelecionada(atualizada);
    }
  }, [notas]);

  const filtradas = notas.filter((n) => {
    if (subTab === "pendentes") return n.status === "pendente";
    if (subTab === "conciliadas") return n.status === "conciliada";
    return n.status === "cancelada";
  });

  const parseXML = (xmlString: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const getTag = (el: Element | Document, tag: string) => {
      const found = el.getElementsByTagName(tag);
      return found.length > 0 ? found[0].textContent || "" : "";
    };

    const nNF = getTag(doc, "nNF");
    const xNome = getTag(doc, "xNome");
    const CNPJ = getTag(doc, "CNPJ");
    const dhEmi = getTag(doc, "dhEmi");
    const dataEmissao = dhEmi ? dhEmi.split("T")[0] : undefined;

    // Motor fiscal: ratea frete/seguro/outros/desconto e calcula custo real
    const fiscal = processarXmlNFe(xmlString);
    const dets = doc.getElementsByTagName("det");
    const itens: {
      descricaoXml: string;
      codigoXml?: string;
      quantidade: number;
      valorUnitario: number;
      valorProdutoUnit: number;
      valorIcmsUnit: number;
      valorIpiUnit: number;
      valorFreteUnit: number;
      valorSeguroUnit: number;
      valorOutrosUnit: number;
      valorDescontoUnit: number;
    }[] = [];

    for (let i = 0; i < dets.length; i++) {
      const det = dets[i];
      const xProd = getTag(det, "xProd");
      const cProd = getTag(det, "cProd");
      const qCom = parseFloat(getTag(det, "qCom")) || 0;
      const vUnCom = parseFloat(getTag(det, "vUnCom")) || 0;
      const r = fiscal.resultado[i];
      const real = r?.custo_final_unitario;
      const custoUnit = real && real > 0 ? real : vUnCom;
      itens.push({
        descricaoXml: xProd,
        codigoXml: cProd || undefined,
        quantidade: qCom,
        valorUnitario: custoUnit,
        valorProdutoUnit: r?.valor_unitario ?? vUnCom,
        valorIcmsUnit: r?.icms_unitario ?? 0,
        valorIpiUnit: r?.ipi_unitario ?? 0,
        valorFreteUnit: r?.frete_unitario ?? 0,
        valorSeguroUnit: r?.seguro_unitario ?? 0,
        valorOutrosUnit: r?.outros_unitario ?? 0,
        valorDescontoUnit: r?.desconto_unitario ?? 0,
      });
    }

    return { numero: nNF, fornecedor: xNome, cnpj: CNPJ, dataEmissao, itens };
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = parseXML(text);
      if (!parsed.numero) {
        alert("XML inválido: número da nota não encontrado.");
        return;
      }
      await criarNota(parsed);
    } catch (err) {
      alert("Erro ao processar XML: " + (err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCorrespondencia = async (itemId: string, perfumeId: string | null) => {
    await atualizarCorrespondencia({ itemId, perfumeId });
  };

  const getEditableQty = (itemId: string, originalQty: number) => {
    return editableQtds[itemId] !== undefined ? editableQtds[itemId] : originalQty;
  };

  const handleConciliar = async () => {
    if (!notaSelecionada || conciliando) return;
    setConciliando(true);
    try {
    const itensCorrespondidos = notaSelecionada.itens.filter((i) => i.perfumeId);

    for (const item of itensCorrespondidos) {
      if (!item.perfumeId) continue;
      const p = perfumes.find((x) => x.id === item.perfumeId);
      if (!p) continue;

      const qtdFinal = getEditableQty(item.id, item.quantidade);

      // Add stock with final confirmed quantity
      await adicionarEstoque(item.perfumeId, depositoDestino as any, qtdFinal);

      // Update cost (custo real da nota = valorUnitario que já contém ICMS+IPI+frete+...)
      const estoqueTotal = Object.values(p.estoques).reduce((a, b) => a + b, 0);
      await atualizarCustoMedio(
        item.perfumeId,
        estoqueTotal,
        p.custo,
        qtdFinal,
        item.valorUnitario,
        {
          notaId: notaSelecionada.id,
          valorProduto: (item.valorProdutoUnit || 0) * qtdFinal,
          valorIcms: (item.valorIcmsUnit || 0) * qtdFinal,
          valorIpi: (item.valorIpiUnit || 0) * qtdFinal,
          valorFrete: (item.valorFreteUnit || 0) * qtdFinal,
          valorSeguro: (item.valorSeguroUnit || 0) * qtdFinal,
          valorOutros: (item.valorOutrosUnit || 0) * qtdFinal,
          valorDesconto: (item.valorDescontoUnit || 0) * qtdFinal,
          observacao: `NF ${notaSelecionada.numero} · ${notaSelecionada.fornecedor}`,
        }
      );
    }

    await conciliarNota({ notaId: notaSelecionada.id, conciliadaPor: profile?.nome || "Sistema" });
    setNotaSelecionada(null);
    setEditableQtds({});
    } finally {
      setConciliando(false);
    }
  };

  const handleManualCreate = async () => {
    if (!manualForm.fornecedor || !manualForm.perfumeId || manualForm.quantidade < 1) return;
    if (salvandoManual) return;
    setSalvandoManual(true);
    try {

    const p = perfumes.find((x) => x.id === manualForm.perfumeId);
    if (!p) return;

    // Custo final: usa fiscal aplicado se houver, senão custo digitado
    const custoFinal = manualFiscal ? manualFiscal.custoReal : manualForm.custoUnitario;

    // Create a manual invoice entry com discriminação fiscal
    await criarNota({
      numero: `MAN-${Date.now()}`,
      fornecedor: manualForm.fornecedor,
      cnpj: "Manual",
      dataEmissao: manualForm.data,
      itens: [{
        descricaoXml: p.nome,
        codigoXml: p.codigo,
        quantidade: manualForm.quantidade,
        valorUnitario: custoFinal,
        valorProdutoUnit: manualFiscal?.precoUnitario ?? manualForm.custoUnitario,
        valorIcmsUnit: manualFiscal?.valorIcmsUnit ?? 0,
        valorIpiUnit: manualFiscal?.valorIpiUnit ?? 0,
        valorFreteUnit: manualFiscal?.freteUnit ?? 0,
        valorOutrosUnit: manualFiscal?.outrosUnit ?? 0,
        valorDescontoUnit: manualFiscal?.descontoUnit ?? 0,
      }],
    });

    // Directly add stock and update cost com discriminação
    await adicionarEstoque(manualForm.perfumeId, manualForm.deposito, manualForm.quantidade);
    const estoqueTotal = Object.values(p.estoques).reduce((a, b) => a + b, 0);
    const qtd = manualForm.quantidade;
    await atualizarCustoMedio(
      manualForm.perfumeId,
      estoqueTotal,
      p.custo,
      qtd,
      custoFinal,
      manualFiscal
        ? {
            valorProduto: manualFiscal.precoUnitario * qtd,
            valorIcms: manualFiscal.valorIcmsUnit * qtd,
            valorIpi: manualFiscal.valorIpiUnit * qtd,
            valorFrete: manualFiscal.freteUnit * qtd,
            valorOutros: manualFiscal.outrosUnit * qtd,
            valorDesconto: manualFiscal.descontoUnit * qtd,
            observacao: `Entrada manual · ${manualForm.fornecedor} · ICMS ${manualFiscal.aliquotaIcms}% · IPI ${manualFiscal.aliquotaIpi}%`,
          }
        : { observacao: `Entrada manual · ${manualForm.fornecedor}` }
    );

    setManualForm({ fornecedor: "", perfumeId: "", quantidade: 1, custoUnitario: 0, data: new Date().toISOString().split("T")[0], observacao: "", deposito: "Casa" });
    setManualFiscal(null);
    setShowManual(false);
    } finally {
      setSalvandoManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4" style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Notas Fiscais</h1>
            <p className="page-subtitle mt-1">{filtradas.length} notas</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowManual(!showManual)} className="btn-secondary px-3 py-2 text-xs">
              <Plus size={14} /> Manual
            </button>
            <div>
              <input type="file" accept=".xml" ref={fileRef} onChange={handleUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="btn-primary px-4 py-2">
                <Upload size={14} /> XML
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {([
            { key: "pendentes", label: "Pendentes" },
            { key: "conciliadas", label: "Conciliadas" },
            { key: "canceladas", label: "Canceladas" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setSubTab(key)}
              className={`pill ${subTab === key ? "pill-active" : "pill-inactive"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual invoice form */}
      {showManual && (
        <div className="mx-4 mb-5 card-premium p-5 animate-fade-in" style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-lg text-foreground mb-4">Entrada Manual</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Fornecedor</label>
              <input type="text" value={manualForm.fornecedor}
                onChange={(e) => setManualForm({ ...manualForm, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
                className="input-premium px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Produto</label>
              <PerfumeSearchSelect perfumes={perfumes} value={manualForm.perfumeId}
                onChange={(id) => setManualForm({ ...manualForm, perfumeId: id })} concentracoesConfig={concentracoesConfig} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Qtd</label>
                <input type="number" min={1} value={manualForm.quantidade}
                  onChange={(e) => setManualForm({ ...manualForm, quantidade: parseInt(e.target.value) || 1 })}
                  className="input-premium px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Custo Un.</label>
                <input type="number" min={0} step="0.01" value={manualForm.custoUnitario || ""}
                  onChange={(e) => setManualForm({ ...manualForm, custoUnitario: parseFloat(e.target.value) || 0 })}
                  className="input-premium px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Depósito</label>
                <select value={manualForm.deposito}
                  onChange={(e) => setManualForm({ ...manualForm, deposito: e.target.value as Deposito })}
                  className="input-premium px-3 py-2.5 text-sm">
                  <option value="Casa">Casa</option>
                  <option value="Sumaúma">Sumaúma</option>
                  <option value="Amazonas">Amazonas</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Data</label>
                <input type="date" value={manualForm.data}
                  onChange={(e) => setManualForm({ ...manualForm, data: e.target.value })}
                  className="input-premium px-3 py-2.5 text-sm [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">Observação</label>
                <input type="text" value={manualForm.observacao}
                  onChange={(e) => setManualForm({ ...manualForm, observacao: e.target.value })}
                  placeholder="Opcional"
                  className="input-premium px-3 py-2.5 text-sm" />
              </div>
            </div>

            {/* Calculadora Fiscal: ICMS/IPI/Frete -> Custo Real */}
            {manualForm.custoUnitario > 0 && (
              <FiscalCostCalculator
                precoUnitario={manualForm.custoUnitario}
                onApply={(b) => {
                  setManualFiscal(b);
                  setManualForm({ ...manualForm, custoUnitario: b.custoReal });
                }}
              />
            )}
            {manualFiscal && (
              <div className="text-[10px] text-gold/80">
                ✓ Custo real aplicado: {formatCurrency(manualFiscal.custoReal)} — discriminação ficará no histórico do produto.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowManual(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleManualCreate}
                disabled={salvandoManual || !manualForm.fornecedor || !manualForm.perfumeId || manualForm.quantidade < 1}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}>
                <Check size={14} className="inline mr-1" /> {salvandoManual ? "Salvando..." : "Dar Entrada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nota detail / conferência */}
      {notaSelecionada && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-border">
            <div>
              <h2 className="font-display text-xl text-gold">Conferência NF #{notaSelecionada.numero}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{notaSelecionada.fornecedor} · {notaSelecionada.cnpj}</p>
            </div>
            <button onClick={() => { setNotaSelecionada(null); setEditableQtds({}); }} className="p-2 rounded-full bg-surface border border-border text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
            {/* Depósito destino */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Depósito de Destino</label>
              <select value={depositoDestino} onChange={(e) => setDepositoDestino(e.target.value)}
                className="input-premium px-3 py-2.5 text-sm">
                <option value="Casa">Casa</option>
                <option value="Sumaúma">Sumaúma</option>
                <option value="Amazonas">Amazonas</option>
              </select>
            </div>

            {/* Itens */}
            <div className="space-y-3">
              {notaSelecionada.itens.map((item) => {
                const perfCorr = item.perfumeId ? perfumes.find((p) => p.id === item.perfumeId) : null;
                const editQty = getEditableQty(item.id, item.quantidade);
                const isEdited = editableQtds[item.id] !== undefined && editableQtds[item.id] !== item.quantidade;

                return (
                  <div key={item.id} className="card-premium p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{item.descricaoXml}</p>
                        {item.codigoXml && <p className="text-[10px] text-muted-foreground mt-0.5">Cód: {item.codigoXml}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground">Custo real</p>
                        <p className="text-xs font-semibold text-gold">{formatCurrency(item.valorUnitario)}/un</p>
                      </div>
                    </div>

                    {/* Discriminação fiscal */}
                    {(item.valorIcmsUnit > 0 || item.valorIpiUnit > 0 || item.valorFreteUnit > 0 || item.valorSeguroUnit > 0 || item.valorOutrosUnit > 0 || item.valorDescontoUnit > 0) && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-surface-overlay border border-border">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Composição do custo (un.)</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                          <div className="flex justify-between"><span className="text-muted-foreground">Produto</span><span className="text-foreground">{formatCurrency(item.valorProdutoUnit)}</span></div>
                          {item.valorIcmsUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">ICMS</span><span className="text-foreground">{formatCurrency(item.valorIcmsUnit)}</span></div>}
                          {item.valorIpiUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IPI</span><span className="text-foreground">{formatCurrency(item.valorIpiUnit)}</span></div>}
                          {item.valorFreteUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span className="text-foreground">{formatCurrency(item.valorFreteUnit)}</span></div>}
                          {item.valorSeguroUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Seguro</span><span className="text-foreground">{formatCurrency(item.valorSeguroUnit)}</span></div>}
                          {item.valorOutrosUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Outros</span><span className="text-foreground">{formatCurrency(item.valorOutrosUnit)}</span></div>}
                          {item.valorDescontoUnit > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="text-destructive">−{formatCurrency(item.valorDescontoUnit)}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* Editable quantity */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Qtd. NF</label>
                        <div className="input-premium px-3 py-2 text-xs text-muted-foreground bg-surface-overlay">
                          {item.quantidade} un.
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1">
                          Qtd. Recebida <Pencil size={9} />
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editQty}
                          onChange={(e) => setEditableQtds({
                            ...editableQtds,
                            [item.id]: parseInt(e.target.value) || 0,
                          })}
                          className={`input-premium px-3 py-2 text-xs ${isEdited ? "border-gold-muted text-gold" : ""}`}
                        />
                      </div>
                    </div>

                    {isEdited && (
                      <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-gold/10 border border-gold-muted">
                        <p className="text-[10px] text-gold">
                          ⚠️ Quantidade ajustada: {item.quantidade} → {editQty}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Produto correspondente</label>
                      <PerfumeSearchSelect
                        perfumes={perfumes}
                        value={item.perfumeId || ""}
                        onChange={(id) => handleCorrespondencia(item.id, id || null)}
                        concentracoesConfig={concentracoesConfig}
                      />
                    </div>

                    {perfCorr && (
                      <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20">
                        <Check size={12} className="text-success" />
                        <span className="text-[10px] text-success font-medium">{perfCorr.nome} · {formatCurrency(perfCorr.custo)} atual</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
            <div className="flex gap-3">
              <button onClick={() => { cancelarNota(notaSelecionada.id); setNotaSelecionada(null); setEditableQtds({}); }}
                className="btn-secondary flex-1 py-3 text-destructive">
                Cancelar Nota
              </button>
              <button onClick={handleConciliar}
                disabled={conciliando || notaSelecionada.itens.filter((i) => i.perfumeId).length === 0}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}>
                <Check size={16} className="inline mr-1" /> {conciliando ? "Processando..." : "Conciliar e dar entrada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      <div className="px-4 pt-3 space-y-2.5">
        {filtradas.map((nota) => (
          <div key={nota.id} className="card-premium p-4 cursor-pointer hover:border-gold-muted transition-colors"
            onClick={() => nota.status === "pendente" && setNotaSelecionada(nota)}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-gold" />
                  <span className="text-sm font-semibold text-foreground">NF #{nota.numero}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    nota.status === "pendente" ? "bg-gold/15 text-gold" :
                    nota.status === "conciliada" ? "bg-success/15 text-success" :
                    "bg-destructive/15 text-destructive"
                  }`}>
                    {nota.status.charAt(0).toUpperCase() + nota.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{nota.fornecedor}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {nota.cnpj} · {nota.itens.length} itens
                  {nota.dataEmissao && ` · ${formatDate(nota.dataEmissao)}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-foreground">
                  {formatCurrency(nota.itens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0))}
                </p>
                <p className="text-[9px] text-muted-foreground">total</p>
              </div>
            </div>
          </div>
        ))}
        {filtradas.length === 0 && (
          <div className="text-center py-20">
            <FileText size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhuma nota fiscal encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
