import { useState, useMemo } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useBalancos } from "@/hooks/useBalancos";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useAuth } from "@/context/AuthContext";
import type { Deposito } from "@/data/mockData";
import { toast } from "sonner";

const DEPOSITOS: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

interface Props {
  onBack: () => void;
  onCreated: (id: string) => void;
}

export default function BalancoNovo({ onBack, onCreated }: Props) {
  const { criarBalanco } = useBalancos();
  const { perfumes } = usePerfumes();
  const { profile } = useAuth();

  const [nome, setNome] = useState(`Balanço ${new Date().toLocaleDateString("pt-BR")}`);
  const [depositos, setDepositos] = useState<Deposito[]>(["Casa"]);
  const [observacoes, setObservacoes] = useState("");
  const [marca, setMarca] = useState("");
  const [tipo, setTipo] = useState("");
  const [comEstoque, setComEstoque] = useState(false);
  const [loading, setLoading] = useState(false);

  const marcas = useMemo(() => {
    return Array.from(new Set(perfumes.map((p) => p.marca))).sort();
  }, [perfumes]);

  const tipos = useMemo(() => {
    return Array.from(new Set(perfumes.map((p) => p.tipo))).sort();
  }, [perfumes]);

  const previewCount = useMemo(() => {
    let lista = perfumes;
    if (marca) lista = lista.filter((p) => p.marca === marca);
    if (tipo) lista = lista.filter((p) => p.tipo === tipo);
    let count = 0;
    for (const p of lista) {
      for (const d of depositos) {
        const stock = p.estoques[d] ?? 0;
        if (comEstoque && stock <= 0) continue;
        count++;
      }
    }
    return count;
  }, [perfumes, marca, tipo, depositos, comEstoque]);

  const toggleDeposito = (d: Deposito) => {
    setDepositos((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleCriar = async () => {
    if (!nome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (depositos.length === 0) {
      toast.error("Selecione pelo menos um depósito");
      return;
    }
    setLoading(true);
    try {
      const bal = await criarBalanco({
        nome: nome.trim(),
        depositos,
        responsavel: profile?.nome || "—",
        observacoes,
        filtros: {
          marca: marca || undefined,
          tipo: tipo || undefined,
          comEstoque: comEstoque || undefined,
        },
      });
      toast.success("Balanço criado");
      onCreated(bal.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar balanço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-32 md:pb-12 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-raised transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="page-subtitle">Novo</p>
          <h1 className="page-title">Iniciar balanço</h1>
        </div>
      </div>

      <div className="card-premium p-5 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Nome do balanço</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input-premium px-3 py-2.5 w-full"
            placeholder="Ex.: Inventário Mensal Outubro"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Depósitos</label>
          <div className="flex gap-2 flex-wrap">
            {DEPOSITOS.map((d) => (
              <button
                key={d}
                onClick={() => toggleDeposito(d)}
                className={`pill ${depositos.includes(d) ? "pill-active" : "pill-inactive"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Marca (opcional)</label>
            <select
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="input-premium px-3 py-2.5 w-full"
            >
              <option value="">Todas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tipo (opcional)</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="input-premium px-3 py-2.5 w-full"
            >
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={comEstoque}
            onChange={(e) => setComEstoque(e.target.checked)}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm">Apenas produtos com estoque atual &gt; 0</span>
        </label>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="input-premium px-3 py-2.5 w-full resize-none"
            placeholder="Notas internas sobre este balanço…"
          />
        </div>

        <div className="bg-surface rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Itens previstos</span>
          <span className="text-lg font-display font-semibold text-gold">{previewCount}</span>
        </div>
      </div>

      <button
        onClick={handleCriar}
        disabled={loading || previewCount === 0}
        className="btn-primary w-full py-3.5 text-sm"
      >
        <Plus size={16} /> {loading ? "Criando…" : "Criar balanço"}
      </button>
    </div>
  );
}
