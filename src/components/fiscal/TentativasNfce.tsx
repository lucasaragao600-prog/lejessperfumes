import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarProdutosFiscal, type ProdutoFiscalLinha } from "@/hooks/useFiscalProdutos";
import { EditorProduto } from "./ConfiguracaoFiscalProdutos";
import { useAuth } from "@/context/AuthContext";

interface Tentativa {
  id: string; created_at: string; numero: number | null; serie: number | null; ambiente: string | null; cstat: string | null; motivo: string | null; protocolo: string | null;
  erros: Array<{ perfume_id: string; produto: string; campo: string; mensagem: string }> | null; produtos: Record<string, string> | null;
}

export function useTentativasNfce(grupo?: string) {
  return useQuery({
    queryKey: ["nfce-tentativas", grupo], enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_nfce_tentativas" as never, { p_grupo: grupo } as never);
      if (error) throw error;
      return (data || []) as unknown as Tentativa[];
    },
  });
}

export default function TentativasNfce({ grupo }: { grupo: string }) {
  const { data = [] } = useTentativasNfce(grupo);
  const master = useAuth().role === "master";
  const [editando, setEditando] = useState<ProdutoFiscalLinha | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  if (!data.length) return null;
  const ultima = data[0];

  const corrigir = async (perfumeId: string, codigo?: string) => {
    setAbrindo(true);
    try {
      const r = await listarProdutosFiscal({ busca: codigo || "", status: "", perfil: "", tipo: "" }, 50, 0);
      const l = r.itens.find((i) => i.id === perfumeId);
      if (l) setEditando(l);
    } finally { setAbrindo(false); }
  };

  return (
    <div className="space-y-2">
      {ultima.cstat === "VALIDACAO" && ultima.erros?.length ? (
        <div className="rounded-xl p-3 space-y-2 border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-medium text-amber-500">Nota não enviada: corrija os dados fiscais destes produtos e clique em Gerar NFC-e de novo</p>
          {ultima.erros.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-foreground">{e.produto}: <span className="text-muted-foreground">{e.mensagem}</span></span>
              {master && (
                <button disabled={abrindo} onClick={() => corrigir(e.perfume_id, ultima.produtos?.[e.perfume_id])}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gold/40 text-gold bg-gold/5 disabled:opacity-50">
                  <Wrench size={12} /> Corrigir
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {editando && <EditorProduto linha={editando} onFechar={() => setEditando(null)} />}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Histórico de tentativas ({data.length})</summary>
        <div className="mt-2 space-y-1">
          {data.map((t) => (
            <p key={t.id} className="text-muted-foreground">
              {new Date(t.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}
              {t.numero ? ` · nº ${t.numero}/${t.serie}` : ""}{t.ambiente ? ` · ${t.ambiente}` : ""} ·{" "}
              <span className={t.protocolo ? "text-emerald-500" : "text-foreground"}>{t.cstat === "VALIDACAO" ? "Bloqueada pela checagem" : `${t.cstat ?? "-"} ${t.motivo ?? ""}`}</span>
              {t.protocolo ? ` · protocolo ${t.protocolo}` : ""}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
