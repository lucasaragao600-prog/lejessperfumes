import { useState, useRef, useEffect } from "react";
import { Plus, ArrowDown, ArrowUpDown, RefreshCw, FlaskConical, ArrowLeftRight, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { type Perfume, type Deposito, type Movimentacao } from "@/data/mockData";
import { getHojeManaus } from "@/lib/dateUtils";
import { toast } from "sonner";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

type Acao = "Entrada" | "Saída" | "Ajuste" | "Transferência" | "Saída Tester" | "Transferência Tester";

interface Props {
  perfume: Perfume;
}

export default function QuickActionMenu({ perfume }: Props) {
  const {
    baixarEstoque,
    adicionarEstoque,
    ajustarEstoque,
    transferirEstoque,
    adicionarTester,
    adicionarTesterDB,
    ajustarTesterDB,
    adicionarMovimentacao,
    testers,
  } = useApp();
  const { profile, role } = useAuth();
  const isMaster = role === "master";
  const userLoja = (!isMaster && profile?.loja) ? (profile.loja as Deposito) : null;

  const [open, setOpen] = useState(false);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [deposito, setDeposito] = useState<Deposito>(userLoja || "Casa");
  const [origem, setOrigem] = useState<Deposito>(userLoja || "Casa");
  const [destino, setDestino] = useState<Deposito>("Sumaúma");
  const [quantidade, setQuantidade] = useState<string>("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const getTesterQtd = (dep: Deposito) =>
    testers.filter(t => t.perfumeId === perfume.id && t.deposito === dep)
      .reduce((a, t) => a + t.quantidade, 0);

  const reset = () => {
    setAcao(null);
    setQuantidade("");
    setObs("");
    setDeposito(userLoja || "Casa");
    setOrigem(userLoja || "Casa");
    setDestino("Sumaúma");
  };

  const closeAll = () => {
    setOpen(false);
    reset();
  };

  const acoes: { key: Acao; label: string; icon: any; color: string }[] = [
    { key: "Entrada", label: "Entrada", icon: ArrowDown, color: "text-success" },
    { key: "Saída", label: "Saída", icon: ArrowUpDown, color: "text-orange-400" },
    { key: "Ajuste", label: "Ajuste", icon: RefreshCw, color: "text-blue-400" },
    { key: "Transferência", label: "Transferência", icon: ArrowLeftRight, color: "text-gold" },
    { key: "Saída Tester", label: "Saída Tester", icon: FlaskConical, color: "text-purple-400" },
    { key: "Transferência Tester", label: "Transf. Tester", icon: FlaskConical, color: "text-purple-400" },
  ];

  const acoesDisponiveis = isMaster ? acoes : acoes.filter(a => a.key !== "Transferência" && a.key !== "Transferência Tester");

  const handleSalvar = async () => {
    if (!acao) return;
    const qtdNum = quantidade === "" ? NaN : Number(quantidade);
    if (isNaN(qtdNum) || qtdNum < 0 || (acao !== "Ajuste" && qtdNum < 1)) {
      toast.error("Quantidade inválida");
      return;
    }
    if ((acao === "Transferência" || acao === "Transferência Tester") && origem === destino) {
      toast.error("Origem e destino devem ser diferentes");
      return;
    }

    setSaving(true);
    try {
      const hoje = getHojeManaus();
      const registradoPor = profile?.nome || "Desconhecido";

      if (acao === "Entrada") {
        await adicionarEstoque(perfume.id, deposito, qtdNum);
        await adicionarMovimentacao({
          id: `m${Date.now()}`, data: hoje, tipo: "Entrada",
          perfumeId: perfume.id, perfumeNome: perfume.nome,
          quantidade: qtdNum, deposito, observacao: obs || undefined, registradoPor,
        } as Movimentacao);
        toast.success(`+${qtdNum} un. em ${deposito}`);
      } else if (acao === "Saída") {
        const est = perfume.estoques[deposito];
        if (est < qtdNum) {
          toast.error(`Estoque insuficiente em ${deposito} (${est} un.)`);
          setSaving(false);
          return;
        }
        await baixarEstoque(perfume.id, deposito, qtdNum);
        await adicionarMovimentacao({
          id: `m${Date.now()}`, data: hoje, tipo: "Saída",
          perfumeId: perfume.id, perfumeNome: perfume.nome,
          quantidade: qtdNum, deposito, observacao: obs || undefined, registradoPor,
        } as any);
        toast.success(`-${qtdNum} un. em ${deposito}`);
      } else if (acao === "Ajuste") {
        const estAtual = perfume.estoques[deposito];
        const dif = qtdNum - estAtual;
        await ajustarEstoque(perfume.id, deposito, qtdNum);
        await adicionarMovimentacao({
          id: `m${Date.now()}`, data: hoje, tipo: "Ajuste",
          perfumeId: perfume.id, perfumeNome: perfume.nome,
          quantidade: dif, deposito,
          observacao: `Ajuste: ${estAtual} → ${qtdNum}${obs ? ` | ${obs}` : ""}`,
          registradoPor,
        } as Movimentacao);
        toast.success(`Estoque ajustado: ${estAtual} → ${qtdNum}`);
      } else if (acao === "Transferência") {
        const est = perfume.estoques[origem];
        if (est < qtdNum) {
          toast.error(`Estoque insuficiente em ${origem} (${est} un.)`);
          setSaving(false);
          return;
        }
        await transferirEstoque(perfume.id, origem, destino, qtdNum);
        await adicionarMovimentacao({
          id: `m${Date.now()}`, data: hoje, tipo: "Transferência",
          perfumeId: perfume.id, perfumeNome: perfume.nome,
          quantidade: qtdNum, depositoOrigem: origem, depositoDestino: destino,
          observacao: obs || undefined, registradoPor,
        } as Movimentacao);
        toast.success(`${qtdNum} un. ${origem} → ${destino}`);
      } else if (acao === "Saída Tester") {
        const est = perfume.estoques[origem];
        if (est < qtdNum) {
          toast.error(`Estoque insuficiente em ${origem} (${est} un.)`);
          setSaving(false);
          return;
        }
        await baixarEstoque(perfume.id, origem, qtdNum);
        adicionarTester(perfume.id, origem, qtdNum);
        await adicionarMovimentacao({
          id: `m${Date.now()}`, data: hoje, tipo: "Saída Tester",
          perfumeId: perfume.id, perfumeNome: perfume.nome,
          quantidade: qtdNum, deposito: origem, depositoOrigem: origem,
          observacao: obs || undefined, registradoPor,
        } as any);
        toast.success(`${qtdNum} un. movidas p/ Tester (${origem})`);
      } else if (acao === "Transferência Tester") {
        const qtdOrigem = getTesterQtd(origem);
        if (qtdOrigem < qtdNum) {
          toast.error(`Tester insuficiente em ${origem} (${qtdOrigem} un.)`);
          setSaving(false);
          return;
        }
        // Baixa testers da origem (ajusta cada registro até cobrir a quantidade)
        let restante = qtdNum;
        const registros = testers.filter(t => t.perfumeId === perfume.id && t.deposito === origem);
        for (const r of registros) {
          if (restante <= 0) break;
          const baixar = Math.min(r.quantidade, restante);
          const nova = r.quantidade - baixar;
          await ajustarTesterDB({ id: r.id, novaQuantidade: nova });
          restante -= baixar;
        }
        // Adiciona testers no destino
        await adicionarTesterDB({
          perfumeId: perfume.id,
          perfumeNome: perfume.nome,
          marca: perfume.marca,
          deposito: destino,
          quantidade: qtdNum,
          custo: perfume.custoMedio || perfume.custo,
          registradoPor,
        });
        toast.success(`${qtdNum} tester ${origem} → ${destino}`);
      }

      closeAll();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const precisaOrigemDestino = acao === "Transferência" || acao === "Transferência Tester";
  const precisaUmDeposito = acao === "Entrada" || acao === "Saída" || acao === "Ajuste" || acao === "Saída Tester";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className="p-1.5 rounded-full bg-gold/15 border border-gold-muted text-gold hover:bg-gold/25 transition-colors"
          title="Ações rápidas"
          aria-label="Ações rápidas"
        >
          <Plus size={14} />
        </button>

        {open && !acao && (
          <div className="absolute right-0 top-full mt-1.5 z-30 w-52 card-premium p-1.5 shadow-elevated">
            {acoesDisponiveis.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); setAcao(key); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-foreground hover:bg-surface-overlay transition-colors text-left"
              >
                <Icon size={13} className={color} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de ação */}
      {acao && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={closeAll}
        >
          <div
            className="card-premium p-5 w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "var(--shadow-gold)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-base text-foreground">{acao}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{perfume.nome}</p>
              </div>
              <button onClick={closeAll} className="text-muted-foreground hover:text-foreground p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {precisaUmDeposito && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {acao === "Saída Tester" ? "Depósito Origem" : "Depósito"}
                  </label>
                  <select
                    value={acao === "Saída Tester" ? origem : deposito}
                    onChange={(e) => acao === "Saída Tester" ? setOrigem(e.target.value as Deposito) : setDeposito(e.target.value as Deposito)}
                    className="input-premium px-3 py-2 text-xs w-full"
                    disabled={!!userLoja}
                  >
                    {depositos.map(d => (
                      <option key={d} value={d}>{d} ({perfume.estoques[d]} un.)</option>
                    ))}
                  </select>
                </div>
              )}

              {precisaOrigemDestino && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Origem</label>
                    <select
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value as Deposito)}
                      className="input-premium px-3 py-2 text-xs w-full"
                    >
                      {depositos.map(d => (
                        <option key={d} value={d}>
                          {d} ({acao === "Transferência Tester" ? getTesterQtd(d) : perfume.estoques[d]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Destino</label>
                    <select
                      value={destino}
                      onChange={(e) => setDestino(e.target.value as Deposito)}
                      className="input-premium px-3 py-2 text-xs w-full"
                    >
                      {depositos.map(d => (
                        <option key={d} value={d}>
                          {d} ({acao === "Transferência Tester" ? getTesterQtd(d) : perfume.estoques[d]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {acao === "Ajuste" && (
                <div className="bg-blue-400/8 border border-blue-400/20 rounded-lg p-2.5">
                  <p className="text-[11px] text-blue-400">
                    📦 Estoque atual em <strong>{deposito}</strong>: <strong>{perfume.estoques[deposito]}</strong> un.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {acao === "Ajuste" ? "Quantidade Correta" : "Quantidade"}
                </label>
                <input
                  type="number"
                  min={acao === "Ajuste" ? 0 : 1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                  className="input-premium px-3 py-2 text-sm w-full"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Observação</label>
                <input
                  type="text"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Opcional"
                  className="input-premium px-3 py-2 text-xs w-full"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={closeAll} className="btn-secondary flex-1 py-2 text-xs">Cancelar</button>
              <button onClick={handleSalvar} disabled={saving} className="btn-primary flex-1 py-2 text-xs disabled:opacity-60">
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
