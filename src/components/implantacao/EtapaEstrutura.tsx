import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  enviarAnexo,
  urlAnexo,
  type ItemChecklist,
  type StatusItemChecklist,
} from "@/hooks/useImplantacoes";

const STATUS: { valor: StatusItemChecklist; rotulo: string }[] = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "CONCLUIDO", rotulo: "Concluído" },
  { valor: "NAO_APLICAVEL", rotulo: "Não aplicável" },
];

interface Props {
  implantacaoId: string;
  itens: ItemChecklist[];
  onSalvar: (id: string, campos: Partial<ItemChecklist>) => Promise<void>;
}

export default function EtapaEstrutura({ implantacaoId, itens, onSalvar }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);

  const salvar = async (item: ItemChecklist, campos: Partial<ItemChecklist>) => {
    setOcupado(item.id);
    try {
      await onSalvar(item.id, campos);
    } catch (e: unknown) {
      toast.error("Não foi possível salvar", { description: (e as Error)?.message });
    } finally {
      setOcupado(null);
    }
  };

  const anexar = async (item: ItemChecklist, file: File) => {
    setOcupado(item.id);
    try {
      const caminho = await enviarAnexo(implantacaoId, item.id, file);
      await onSalvar(item.id, { anexo_url: caminho });
      toast.success("Anexo enviado");
    } catch (e: unknown) {
      toast.error("Falha ao enviar anexo", { description: (e as Error)?.message });
    } finally {
      setOcupado(null);
    }
  };

  const abrirAnexo = async (caminho: string) => {
    try {
      window.open(await urlAnexo(caminho), "_blank");
    } catch {
      toast.error("Não foi possível abrir o anexo");
    }
  };

  if (!itens.length)
    return <p className="text-sm text-muted-foreground">Nenhum item de estrutura cadastrado.</p>;

  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{item.item}</span>
            {ocupado === item.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={item.status}
              onChange={(e) => salvar(item, { status: e.target.value as StatusItemChecklist })}
            >
              {STATUS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>

            <input
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Responsável"
              defaultValue={item.responsavel_nome}
              onBlur={(e) =>
                e.target.value !== item.responsavel_nome &&
                salvar(item, { responsavel_nome: e.target.value })
              }
            />

            <input
              type="date"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              defaultValue={item.data_prevista || ""}
              onChange={(e) => salvar(item, { data_prevista: e.target.value || null })}
            />

            <input
              type="date"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              defaultValue={item.data_conclusao || ""}
              onChange={(e) => salvar(item, { data_conclusao: e.target.value || null })}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              placeholder="Observação"
              defaultValue={item.observacao}
              onBlur={(e) =>
                e.target.value !== item.observacao && salvar(item, { observacao: e.target.value })
              }
            />
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground">
              <Paperclip className="w-4 h-4" />
              Anexar
              <input
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && anexar(item, e.target.files[0])}
              />
            </label>
            {item.anexo_url && (
              <button
                type="button"
                className="h-9 rounded-md border border-border px-3 text-sm text-primary"
                onClick={() => abrirAnexo(item.anexo_url)}
              >
                Ver anexo
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
