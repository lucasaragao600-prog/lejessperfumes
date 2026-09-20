import { useMemo, useState } from "react";
import { Building2, Plus, Pencil, Power, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidades, type Unidade, type StatusUnidade } from "@/hooks/useUnidades";

const STATUS: { valor: StatusUnidade; rotulo: string }[] = [
  { valor: "EM_IMPLANTACAO", rotulo: "Em implantação" },
  { valor: "EM_CONFIGURACAO", rotulo: "Em configuração" },
  { valor: "EM_TESTE", rotulo: "Em teste" },
  { valor: "OPERACIONAL", rotulo: "Operacional" },
  { valor: "INATIVA", rotulo: "Inativa" },
];

const TIPOS = ["LOJA", "ESTOQUE", "ESTOQUE_CENTRAL", "SHOWROOM", "QUIOSQUE", "ECOMMERCE", "OUTRO"];

const rotuloStatus = (s: string) => STATUS.find((x) => x.valor === s)?.rotulo || s;

interface FormState {
  id?: string;
  codigo: string;
  nome: string;
  nomeExibicao: string;
  tipo: string;
  status: StatusUnidade;
  cnpj: string;
  telefone: string;
  cidade: string;
  uf: string;
  permiteVenda: boolean;
  permiteEstoque: boolean;
  permiteTransferencia: boolean;
  motivoInativacao: string;
}

const vazio: FormState = {
  codigo: "",
  nome: "",
  nomeExibicao: "",
  tipo: "LOJA",
  status: "EM_IMPLANTACAO",
  cnpj: "",
  telefone: "",
  cidade: "",
  uf: "",
  permiteVenda: false,
  permiteEstoque: true,
  permiteTransferencia: true,
  motivoInativacao: "",
};

export default function Unidades() {
  const queryClient = useQueryClient();
  const { todas, isLoading } = useUnidades({ contexto: "historico" });
  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: saldos = {} } = useQuery({
    queryKey: ["unidades-saldos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_unidades").select("unidade_id, quantidade");
      if (error) throw error;
      const acc: Record<string, number> = {};
      for (const r of (data || []) as any[]) {
        acc[r.unidade_id] = (acc[r.unidade_id] || 0) + (r.quantidade || 0);
      }
      return acc;
    },
  });

  const abrirNova = () => setForm({ ...vazio });

  const abrirEdicao = (u: Unidade) =>
    setForm({
      id: u.id,
      codigo: u.codigo,
      nome: u.nome,
      nomeExibicao: u.nomeExibicao,
      tipo: u.tipo,
      status: u.status,
      cnpj: u.cnpj,
      telefone: u.telefone,
      cidade: u.cidade,
      uf: u.uf,
      permiteVenda: u.permiteVenda,
      permiteEstoque: u.permiteEstoque,
      permiteTransferencia: u.permiteTransferencia,
      motivoInativacao: u.motivoInativacao,
    });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["unidades"] });
    queryClient.invalidateQueries({ queryKey: ["unidades-saldos"] });
  };

  const salvar = async () => {
    if (!form) return;
    if (!form.codigo.trim() || !form.nome.trim()) {
      toast.error("Informe código e nome da unidade.");
      return;
    }
    if (form.status === "INATIVA" && form.motivoInativacao.trim().length < 5) {
      toast.error("Para inativar é obrigatório informar o motivo (mínimo 5 caracteres).");
      return;
    }
    setSalvando(true);
    try {
      const inativa = form.status === "INATIVA";
      const payload: Record<string, any> = {
        codigo: form.codigo.trim().toUpperCase(),
        nome: form.nome.trim(),
        nome_exibicao: form.nomeExibicao.trim() || form.nome.trim(),
        tipo: form.tipo,
        status: form.status,
        cnpj: form.cnpj,
        telefone: form.telefone,
        cidade: form.cidade,
        uf: form.uf,
        permite_venda: inativa ? false : form.permiteVenda,
        permite_estoque: inativa ? false : form.permiteEstoque,
        permite_transferencia: inativa ? false : form.permiteTransferencia,
        motivo_inativacao: inativa ? form.motivoInativacao.trim() : "",
        inativada_em: inativa ? new Date().toISOString() : null,
      };

      if (form.id) {
        const { error } = await supabase.from("unidades").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("unidades")
          .insert({ ...payload, ordem: todas.length + 1 } as any);
        if (error) throw error;
      }
      toast.success(form.id ? "Unidade atualizada" : "Unidade criada");
      setForm(null);
      invalidate();
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const ordenadas = useMemo(() => [...todas].sort((a, b) => a.ordem - b.ordem), [todas]);

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-gold" />
          <h2 className="text-base font-semibold text-foreground">Unidades</h2>
        </div>
        <button onClick={abrirNova} className="btn-gold flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl">
          <Plus size={14} /> Nova unidade
        </button>
      </div>

      <p className="px-4 text-[11px] text-muted-foreground mb-3">
        Unidades nunca são excluídas. Para encerrar a operação de uma unidade, mude o status para
        Inativa informando o motivo — o histórico é preservado.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-gold" />
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {ordenadas.map((u) => (
            <div key={u.id} className="kpi-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {u.nomeExibicao}
                    {u.status === "INATIVA" && (
                      <span className="text-[10px] text-muted-foreground"> — Unidade Inativa</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {u.codigo} · {u.tipo.split("_").join(" ")} · {rotuloStatus(u.status)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Estoque: {saldos[u.id] || 0} un.
                  </p>
                  {u.status === "INATIVA" && u.motivoInativacao && (
                    <p className="text-[10px] text-destructive mt-1">Motivo: {u.motivoInativacao}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => abrirEdicao(u)}
                    className="flex items-center gap-1 text-[11px] text-gold px-2 py-1 rounded-lg border border-border"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <div className="flex gap-1 text-[9px] text-muted-foreground">
                    {u.permiteVenda && <span className="px-1.5 py-0.5 rounded bg-surface-overlay">venda</span>}
                    {u.permiteEstoque && <span className="px-1.5 py-0.5 rounded bg-surface-overlay">estoque</span>}
                    {u.permiteTransferencia && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-overlay">transf.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto bg-surface rounded-t-2xl md:rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {form.id ? "Editar unidade" : "Nova unidade"}
              </h3>
              <button onClick={() => setForm(null)} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Campo label="Código">
                <input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t.split("_").join(" ")}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Nome">
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="Nome de exibição">
                <input
                  value={form.nomeExibicao}
                  onChange={(e) => setForm({ ...form, nomeExibicao: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="CNPJ">
                <input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="Telefone">
                <input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="Cidade">
                <input
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
              <Campo label="UF">
                <input
                  value={form.uf}
                  maxLength={2}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
            </div>

            <Campo label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StatusUnidade })}
                className="input-premium px-3 py-2 text-sm"
              >
                {STATUS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            {form.status === "INATIVA" && (
              <Campo label="Motivo da inativação (obrigatório)">
                <textarea
                  value={form.motivoInativacao}
                  onChange={(e) => setForm({ ...form, motivoInativacao: e.target.value })}
                  rows={2}
                  className="input-premium px-3 py-2 text-sm"
                />
              </Campo>
            )}

            {form.status !== "INATIVA" && (
              <div className="space-y-1.5">
                {([
                  ["permiteVenda", "Permite venda"],
                  ["permiteEstoque", "Permite estoque"],
                  ["permiteTransferencia", "Permite transferência"],
                ] as const).map(([campo, rotulo]) => (
                  <label key={campo} className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={form[campo]}
                      onChange={(e) => setForm({ ...form, [campo]: e.target.checked })}
                    />
                    {rotulo}
                  </label>
                ))}
                {(form.status === "EM_IMPLANTACAO" || form.status === "EM_CONFIGURACAO") && (
                  <p className="text-[10px] text-muted-foreground">
                    Em implantação a unidade só recebe transferências: venda e caixa continuam bloqueados
                    pelo sistema.
                  </p>
                )}
                {form.status === "EM_TESTE" && (
                  <p className="text-[10px] text-muted-foreground">
                    Em teste, as vendas são apenas de homologação: não baixam estoque real nem entram nos
                    relatórios.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={salvar}
              disabled={salvando}
              className="btn-gold w-full py-2.5 text-sm rounded-xl flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              Salvar unidade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}
