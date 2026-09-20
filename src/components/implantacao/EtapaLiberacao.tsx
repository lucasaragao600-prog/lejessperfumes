import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  implantacaoId: string;
  jaLiberada: boolean;
  onAtualizar: () => void;
}

interface Prontidao {
  etapas_pendentes: number;
  testes_pendentes: number;
  checklist_pendentes: number;
  pendencias_abertas: number;
  pendencias_criticas: number;
  estoque_pendente: number;
  divergencias: number;
  fiscal_ok: boolean;
  caixa_ok: boolean;
  pode_liberar: boolean;
}

export default function EtapaLiberacao({ implantacaoId, jaLiberada, onAtualizar }: Props) {
  const [dados, setDados] = useState<Prontidao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [liberando, setLiberando] = useState(false);
  const [data, setData] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: r, error } = await supabase.rpc("fn_implantacao_prontidao", {
        p_implantacao_id: implantacaoId,
      });
      if (error) throw error;
      setDados(r as unknown as Prontidao);
    } catch (e: unknown) {
      toast.error("Não foi possível verificar a unidade", { description: (e as Error)?.message });
    } finally {
      setCarregando(false);
    }
  }, [implantacaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const liberar = async () => {
    setLiberando(true);
    try {
      const { error } = await supabase.rpc("fn_implantacao_liberar", {
        p_implantacao_id: implantacaoId,
        p_data_inauguracao: data || null,
      });
      if (error) throw error;
      toast.success("Unidade liberada para operação");
      onAtualizar();
      void carregar();
    } catch (e: unknown) {
      toast.error("Não foi possível liberar", { description: (e as Error)?.message });
    } finally {
      setLiberando(false);
    }
  };

  if (carregando) return <p className="text-sm text-muted-foreground">Verificando…</p>;
  if (!dados) return null;

  const linhas: { rotulo: string; ok: boolean; detalhe?: string }[] = [
    {
      rotulo: "Etapas anteriores concluídas",
      ok: dados.etapas_pendentes === 0,
      detalhe: `${dados.etapas_pendentes} pendente(s)`,
    },
    {
      rotulo: "Testes operacionais concluídos",
      ok: dados.testes_pendentes === 0,
      detalhe: `${dados.testes_pendentes} pendente(s)`,
    },
    {
      rotulo: "Checklist final concluído",
      ok: dados.checklist_pendentes === 0,
      detalhe: `${dados.checklist_pendentes} pendente(s)`,
    },
    {
      rotulo: "Sem pendências críticas ou altas",
      ok: dados.pendencias_criticas === 0,
      detalhe: `${dados.pendencias_criticas} aberta(s) · ${dados.pendencias_abertas} no total`,
    },
    {
      rotulo: "Estoque inicial recebido",
      ok: dados.estoque_pendente === 0,
      detalhe: `${dados.estoque_pendente} carga(s) pendente(s)`,
    },
    {
      rotulo: "Sem divergências de estoque",
      ok: dados.divergencias === 0,
      detalhe: `${dados.divergencias} divergência(s)`,
    },
    { rotulo: "Configuração fiscal completa", ok: dados.fiscal_ok },
    { rotulo: "Configuração de caixa salva", ok: dados.caixa_ok },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          A liberação coloca a unidade como Operacional e habilita venda, estoque e transferência.
        </p>
        <button
          onClick={() => void carregar()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
        >
          <RefreshCw className="w-4 h-4" /> Reverificar
        </button>
      </div>

      <ul className="space-y-2">
        {linhas.map((l) => (
          <li
            key={l.rotulo}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 text-foreground">
              {l.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive" />
              )}
              {l.rotulo}
            </span>
            {!l.ok && l.detalhe && (
              <span className="text-xs text-muted-foreground">{l.detalhe}</span>
            )}
          </li>
        ))}
      </ul>

      {jaLiberada ? (
        <p className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          Unidade já liberada para operação.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Data de inauguração</span>
            <input
              type="date"
              className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <button
            onClick={liberar}
            disabled={!dados.pode_liberar || liberando}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {liberando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Liberar unidade para operação
          </button>
        </div>
      )}
    </div>
  );
}
