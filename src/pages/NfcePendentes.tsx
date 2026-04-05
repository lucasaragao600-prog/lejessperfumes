import { useState, useMemo } from "react";
import { Search, FileText, AlertTriangle, CheckCircle2, Loader2, Calendar, User, CreditCard, ShieldAlert } from "lucide-react";
import { useVendas } from "@/hooks/useVendas";
import { useNfce, hasCertificadoConfigurado } from "@/hooks/useNfce";
import { useClientes } from "@/hooks/useClientes";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/data/mockData";
import { toast } from "sonner";

interface PedidoPendente {
  grupoVenda: string;
  data: string;
  operador: string;
  vendedora: string;
  clienteNome: string;
  total: number;
  tipoPagamento: string;
  itens: { perfumeId: string; perfumeNome: string; quantidade: number; precoUnitario: number; total: number }[];
  pagamentos: { tipoPagamento: string; bandeira: string; valor: number }[];
}

export default function NfcePendentes() {
  const { vendas, pagamentos: vendaPagamentos, atualizarNfceStatus } = useVendas();
  const { configFiscal, criarEmissao, gerarXmlNfce } = useNfce();
  const { clientes } = useClientes();
  const { perfumes } = useApp();
  const [busca, setBusca] = useState("");
  const [gerandoId, setGerandoId] = useState<string | null>(null);

  const temCertificado = hasCertificadoConfigurado(configFiscal);

  // Group sales with nfce_status = pendente or sem_certificado
  const pendentes = useMemo(() => {
    const map = new Map<string, PedidoPendente>();
    for (const v of vendas) {
      if (v.nfceStatus !== "pendente" && v.nfceStatus !== "sem_certificado") continue;
      const gv = v.grupoVenda || v.id;
      if (!map.has(gv)) {
        const cliente = v.clienteId ? clientes.find(c => c.id === v.clienteId) : null;
        map.set(gv, {
          grupoVenda: gv,
          data: v.data,
          operador: v.registradoPor || "",
          vendedora: v.vendedora,
          clienteNome: cliente?.nome || "",
          total: 0,
          tipoPagamento: v.tipoPagamento,
          itens: [],
          pagamentos: [],
        });
      }
      const p = map.get(gv)!;
      p.total += v.total;
      p.itens.push({
        perfumeId: v.perfumeId,
        perfumeNome: v.perfumeNome,
        quantidade: v.quantidade,
        precoUnitario: v.precoUnitario,
        total: v.total,
      });
    }
    for (const [gv, p] of map) {
      const pags = vendaPagamentos.filter(pg => pg.grupoVenda === gv);
      if (pags.length > 0) {
        p.pagamentos = pags.map(pg => ({ tipoPagamento: pg.tipoPagamento, bandeira: pg.bandeira, valor: pg.valor }));
        p.tipoPagamento = pags.map(pg => pg.tipoPagamento).join(", ");
      }
    }
    return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [vendas, vendaPagamentos, clientes]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return pendentes;
    const q = busca.toLowerCase();
    return pendentes.filter(p =>
      p.grupoVenda.toLowerCase().includes(q) ||
      p.clienteNome.toLowerCase().includes(q) ||
      p.operador.toLowerCase().includes(q) ||
      p.data.includes(q)
    );
  }, [pendentes, busca]);

  const handleGerarNfce = async (pedido: PedidoPendente) => {
    if (!temCertificado) {
      toast.error("Certificado digital não configurado. Acesse Configurações para cadastrar.");
      return;
    }
    setGerandoId(pedido.grupoVenda);
    try {
      await criarEmissao({ vendaGrupoVenda: pedido.grupoVenda });

      if (configFiscal) {
        const getCasa = (perfumeId: string) => {
          const perf = perfumes.find(p => p.id === perfumeId);
          return perf?.marca || "";
        };
        gerarXmlNfce({
          emitente: configFiscal,
          itens: pedido.itens.map(item => ({
            codigo: item.perfumeId.slice(0, 8),
            descricao: `${getCasa(item.perfumeId)} - ${item.perfumeNome}`,
            ncm: "33030010",
            cfop: "5102",
            cstCsosn: "102",
            unidade: "UN",
            quantidade: item.quantidade,
            valor: item.precoUnitario,
          })),
          pagamentos: pedido.pagamentos.map(p => ({ forma: p.tipoPagamento, valor: p.valor })),
          total: pedido.total,
          numero: configFiscal.proximoNumeroNfce,
          serie: configFiscal.serieNfce,
        });
      }

      // XML generated but NOT authorized - needs real SEFAZ integration
      await atualizarNfceStatus({
        grupoVenda: pedido.grupoVenda,
        nfceStatus: "pendente",
      });
      toast.info("XML gerado. Aguardando integração com SEFAZ para autorização.");
    } catch (err) {
      console.error("Erro ao gerar NFC-e:", err);
      toast.error("Erro ao gerar NFC-e");
    } finally {
      setGerandoId(null);
    }
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="page-title">NFC-e Pendentes</h1>
        <p className="page-subtitle mt-1">Vendas aguardando emissão de NFC-e</p>
      </div>

      {!temCertificado && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.2)" }}>
          <ShieldAlert size={20} style={{ color: "hsl(var(--destructive))" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold" style={{ color: "hsl(var(--destructive))" }}>Certificado digital não configurado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Para emitir NFC-e é necessário configurar o certificado digital A1 nas Configurações da empresa.
              As vendas abaixo permanecerão pendentes até a configuração.
            </p>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por pedido, cliente, operador, data..."
          className="input-premium pl-10 pr-4 py-2.5 text-sm w-full"
        />
      </div>

      <div className="kpi-card inline-block">
        <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
        <p className="text-lg font-bold" style={{ color: "hsl(var(--warning))" }}>{filtrados.length}</p>
      </div>

      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={40} className="mx-auto text-success opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma NFC-e pendente</p>
          </div>
        ) : (
          filtrados.map(pedido => (
            <div key={pedido.grupoVenda} className="card-premium p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">#{pedido.grupoVenda.slice(0, 8).toUpperCase()}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" }}>
                    {temCertificado ? "NFC-e pendente" : "Sem certificado"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {pedido.data}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={10} /> {pedido.operador || pedido.vendedora}</span>
                  {pedido.clienteNome && <span className="text-[10px] text-muted-foreground">{pedido.clienteNome}</span>}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> {pedido.tipoPagamento}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-sm font-bold text-gold">{formatCurrency(pedido.total)}</span>
                <button
                  onClick={() => handleGerarNfce(pedido)}
                  disabled={gerandoId === pedido.grupoVenda || !temCertificado}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                  style={{ background: temCertificado ? "var(--gradient-gold)" : "hsl(var(--muted))", color: temCertificado ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
                >
                  {gerandoId === pedido.grupoVenda ? (
                    <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                  ) : (
                    <><FileText size={14} /> Gerar NFC-e</>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
