import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NT_STATUS_META, type NtStatus } from "@/hooks/useNotasTransferencia";
import { useLogoEmpresa } from "@/hooks/useLogoEmpresa";

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
            <p className="text-[10px] text-muted-foreground pt-2">Documento de controle interno, sem valor fiscal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
