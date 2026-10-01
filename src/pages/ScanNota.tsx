import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NT_STATUS_META, type NtStatus } from "@/hooks/useNotasTransferencia";
import { useLogoEmpresa } from "@/hooks/useLogoEmpresa";
import type { NtDetalhe } from "@/hooks/useNotasTransferencia";
import { fmtQtd } from "@/lib/notaTransferencia";

interface NtPublica {
  numero: string; status: NtStatus; revisao: number; origem: string; destino: string;
  emitido_em: string; recebido_em: string | null; total_itens: number;
}

const dataHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "—";

export default function ScanNota() {
  const { codigo = "" } = useParams();
  const { src } = useLogoEmpresa();
  const { data, isLoading } = useQuery({
    queryKey: ["nt-scan", codigo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_nt_scan_publico" as never, { p_codigo: codigo } as never);
      if (error) throw error;
      return data as unknown as NtPublica | null;
    },
  });

  const { data: det } = useQuery({
    queryKey: ["nt-scan-det", codigo],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return null;
      const { data, error } = await supabase.rpc("fn_nt_detalhe_por_codigo" as never, { p_codigo: codigo } as never);
      if (error) return null;
      return data as unknown as NtDetalhe | null;
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm space-y-4 text-center">
        <img src={src} alt="Logo" className="h-12 mx-auto object-contain" />
        <h1 className="text-sm text-muted-foreground">Nota de Transferência</h1>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && !data && <p className="text-sm text-muted-foreground">Nota não encontrada.</p>}
        {data && (
          <div className="space-y-2">
            <p className="text-lg font-medium text-gold">{data.numero}{data.revisao > 1 ? ` · rev. ${data.revisao}` : ""}</p>
            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${NT_STATUS_META[data.status]?.className}`}>
              {NT_STATUS_META[data.status]?.label}
            </span>
            <p className="text-sm text-foreground">{data.origem} → {data.destino}</p>
            <p className="text-xs text-muted-foreground">Emitida em {dataHora(data.emitido_em)}</p>
            {data.recebido_em && <p className="text-xs text-muted-foreground">Recebida em {dataHora(data.recebido_em)}</p>}
            <p className="text-xs text-muted-foreground">{data.total_itens} item(ns)</p>
            {det && (
              <div className="text-left border-t border-border pt-3 mt-2 space-y-1">
                <p className="text-[11px] text-muted-foreground">Enviado por {det.emitido_por_nome || "—"}{det.recebido_por_nome ? ` · Recebido por ${det.recebido_por_nome}` : ""}</p>
                {det.itens.map((i) => (
                  <div key={i.id} className="flex justify-between gap-2 text-xs">
                    <span className="text-foreground">{i.codigo} {i.descricao}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {i.quantidade_enviada == null ? "—" : fmtQtd(i.quantidade_enviada, i.unidade_medida)} / {fmtQtd(i.quantidade_recebida, i.unidade_medida)}
                      {det.mostrar_valores && i.custo_unitario != null ? ` · ${i.custo_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground pt-2">Documento de controle interno, sem valor fiscal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
