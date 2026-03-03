import { useState, useRef } from "react";
import { FileText, Upload, Check, X } from "lucide-react";
import { useNotasFiscais, type NotaFiscal } from "@/hooks/useNotasFiscais";
import { useProdutoCustos } from "@/hooks/useProdutoCustos";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { formatCurrency, formatDate } from "@/data/mockData";

type SubTab = "pendentes" | "conciliadas" | "canceladas";

export default function NotasFiscais() {
  const { notas, isLoading, criarNota, atualizarCorrespondencia, conciliarNota, cancelarNota } = useNotasFiscais();
  const { perfumes, adicionarEstoque, concentracoesConfig } = useApp();
  const { profile } = useAuth();
  const { atualizarCustoMedio } = useProdutoCustos();
  const [subTab, setSubTab] = useState<SubTab>("pendentes");
  const [notaSelecionada, setNotaSelecionada] = useState<NotaFiscal | null>(null);
  const [depositoDestino, setDepositoDestino] = useState<string>("Casa");
  const fileRef = useRef<HTMLInputElement>(null);

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

    const dets = doc.getElementsByTagName("det");
    const itens: { descricaoXml: string; codigoXml?: string; quantidade: number; valorUnitario: number }[] = [];

    for (let i = 0; i < dets.length; i++) {
      const det = dets[i];
      const xProd = getTag(det, "xProd");
      const cProd = getTag(det, "cProd");
      const qCom = parseFloat(getTag(det, "qCom")) || 0;
      const vUnCom = parseFloat(getTag(det, "vUnCom")) || 0;
      itens.push({ descricaoXml: xProd, codigoXml: cProd || undefined, quantidade: qCom, valorUnitario: vUnCom });
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

  const handleConciliar = async () => {
    if (!notaSelecionada) return;
    const itensCorrespondidos = notaSelecionada.itens.filter((i) => i.perfumeId);

    for (const item of itensCorrespondidos) {
      if (!item.perfumeId) continue;
      const p = perfumes.find((x) => x.id === item.perfumeId);
      if (!p) continue;

      // Add stock
      await adicionarEstoque(item.perfumeId, depositoDestino as any, item.quantidade);

      // Update cost
      const estoqueTotal = Object.values(p.estoques).reduce((a, b) => a + b, 0);
      await atualizarCustoMedio(item.perfumeId, estoqueTotal, p.custo, item.quantidade, item.valorUnitario);
    }

    await conciliarNota({ notaId: notaSelecionada.id, conciliadaPor: profile?.nome || "Sistema" });
    setNotaSelecionada(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4" style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Notas Fiscais</h1>
            <p className="page-subtitle mt-1">{filtradas.length} notas</p>
          </div>
          <div>
            <input type="file" accept=".xml" ref={fileRef} onChange={handleUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn-primary px-4 py-2">
              <Upload size={14} /> Upload XML
            </button>
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

      {/* Nota detail / conferência */}
      {notaSelecionada && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-border">
            <div>
              <h2 className="font-display text-xl text-gold">Conferência NF #{notaSelecionada.numero}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{notaSelecionada.fornecedor} · {notaSelecionada.cnpj}</p>
            </div>
            <button onClick={() => setNotaSelecionada(null)} className="p-2 rounded-full bg-surface border border-border text-muted-foreground">
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
                return (
                  <div key={item.id} className="card-premium p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{item.descricaoXml}</p>
                        {item.codigoXml && <p className="text-[10px] text-muted-foreground mt-0.5">Cód: {item.codigoXml}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{item.quantidade} un.</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(item.valorUnitario)}/un</p>
                      </div>
                    </div>

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
              <button onClick={() => { cancelarNota(notaSelecionada.id); setNotaSelecionada(null); }}
                className="btn-secondary flex-1 py-3 text-destructive">
                Cancelar Nota
              </button>
              <button onClick={handleConciliar}
                disabled={notaSelecionada.itens.filter((i) => i.perfumeId).length === 0}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}>
                <Check size={16} className="inline mr-1" /> Conciliar e dar entrada
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
