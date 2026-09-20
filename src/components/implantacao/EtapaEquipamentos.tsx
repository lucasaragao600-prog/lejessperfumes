import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEquipamentos, type Equipamento } from "@/hooks/useImplantacoes";

const TIPOS = [
  "PDV",
  "Computador",
  "Impressora",
  "Impressora fiscal",
  "Leitor de código de barras",
  "Maquininha",
  "Roteador",
  "Câmera",
  "Outro",
];

const STATUS = ["ATIVO", "EM_MANUTENCAO", "INATIVO"];

interface Props {
  unidadeId: string;
  implantacaoId: string;
}

const vazio = {
  tipo: "PDV",
  marca: "",
  modelo: "",
  numero_serie: "",
  patrimonio: "",
  ip: "",
  local: "",
  status: "ATIVO",
  observacao: "",
};

export default function EtapaEquipamentos({ unidadeId, implantacaoId }: Props) {
  const { equipamentos, isLoading, adicionar, atualizar } = useEquipamentos(unidadeId);
  const [form, setForm] = useState({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const enviar = async () => {
    if (!form.tipo) return toast.error("Informe o tipo do equipamento");
    setSalvando(true);
    try {
      await adicionar({ ...form, unidade_id: unidadeId, implantacao_id: implantacaoId });
      setForm({ ...vazio });
      toast.success("Equipamento cadastrado");
    } catch (e: unknown) {
      toast.error("Não foi possível cadastrar", { description: (e as Error)?.message });
    } finally {
      setSalvando(false);
    }
  };

  const campo = (k: keyof typeof vazio, placeholder: string) => (
    <input
      className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
      placeholder={placeholder}
      value={form[k]}
      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
    />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <p className="text-sm font-medium text-foreground">Novo equipamento</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {campo("marca", "Marca")}
          {campo("modelo", "Modelo")}
          {campo("numero_serie", "Nº de série")}
          {campo("patrimonio", "Patrimônio")}
          {campo("ip", "IP")}
          {campo("local", "Local")}
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s === "EM_MANUTENCAO" ? "Em manutenção" : s === "ATIVO" ? "Ativo" : "Inativo"}
              </option>
            ))}
          </select>
        </div>
        {campo("observacao", "Observação")}
        <button
          type="button"
          onClick={enviar}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : equipamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {["Tipo", "Marca/Modelo", "Série", "Patrimônio", "IP", "Local", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((eq: Equipamento) => (
                <tr key={eq.id} className="border-t border-border text-foreground">
                  <td className="px-3 py-2">{eq.tipo}</td>
                  <td className="px-3 py-2">{[eq.marca, eq.modelo].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-3 py-2">{eq.numero_serie || "—"}</td>
                  <td className="px-3 py-2">{eq.patrimonio || "—"}</td>
                  <td className="px-3 py-2">{eq.ip || "—"}</td>
                  <td className="px-3 py-2">{eq.local || "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                      value={eq.status}
                      onChange={(e) => atualizar(eq.id, { status: e.target.value })}
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s === "EM_MANUTENCAO" ? "Em manutenção" : s === "ATIVO" ? "Ativo" : "Inativo"}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
