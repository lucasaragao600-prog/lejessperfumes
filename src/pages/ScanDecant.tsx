import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const fmtData = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Página aberta pelo QR/código. Sem login mostra só dados públicos; logado com permissão mostra o restante. */
export default function ScanDecant() {
  const { codigo = "" } = useParams();
  const [d, setD] = useState<any>(undefined);
  const [interno, setInterno] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        const r = await db.rpc("fn_decant_scan", { p_codigo: codigo });
        if (!r.error) { setD(r.data); setInterno(true); return; }
      }
      const r = await db.rpc("fn_decant_scan_publico", { p_codigo: codigo });
      setD(r.error ? null : r.data);
    })();
  }, [codigo]);

  const Linha = ({ t, v }: { t: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border text-sm"><span className="text-muted-foreground">{t}</span><span className="text-right">{v}</span></div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        <p className="text-center font-black tracking-[0.3em] text-gold pt-4">LE JESS</p>
        {d === undefined ? <div className="card-premium p-6 animate-pulse h-40" />
          : !d ? <div className="card-premium p-6 text-center text-muted-foreground">Código não encontrado.</div>
          : (
            <div className="card-premium p-5 space-y-2">
              <h1 className="text-lg font-semibold">{d.nome}</h1>
              <p className="text-sm text-muted-foreground">{[d.marca, d.concentracao].filter(Boolean).join(" · ")}</p>
              <div className="pt-2">
                {d.lote && <Linha t="Lote" v={<span className="font-mono">{d.lote}</span>} />}
                {d.sku && <Linha t="SKU" v={<span className="font-mono">{d.sku}</span>} />}
                <Linha t="Tamanho" v={(d.tamanhos ?? []).join(", ") || "—"} />
                {d.lote && <Linha t="Produção" v={fmtData(d.data_producao)} />}
                {interno && d.filial && <Linha t="Filial" v={d.filial} />}
                {interno && d.frascos && <Linha t="Perfume de origem (frascos)" v={d.frascos.join(", ")} />}
                {interno && d.responsavel_producao !== undefined && <Linha t="Responsável" v={d.responsavel_producao || "—"} />}
                {interno && <Linha t="Estoque" v={(d.estoque ?? []).map((e: any) => `${e.sku ? e.sku + " · " : ""}${e.filial}: ${e.quantidade}`).join(" | ") || "0"} />}
                {interno && d.custo_total != null && <Linha t="Custo do lote" v={brl(d.custo_total)} />}
                {interno && d.custo_medio != null && <Linha t="Custo médio" v={brl(d.custo_medio)} />}
              </div>
              {!interno && <p className="text-xs text-muted-foreground pt-2">Entre no sistema para ver estoque e dados internos.</p>}
            </div>
          )}
      </div>
    </div>
  );
}
