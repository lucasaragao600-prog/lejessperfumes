import { useState } from "react";
import { Bell, Check, AlertTriangle } from "lucide-react";
import { useAlertas } from "@/hooks/useAlertas";
import { useApp } from "@/context/AppContext";

export default function Alertas({ onClose }: { onClose: () => void }) {
  const { alertas, resolverAlerta } = useAlertas();
  const { perfumes } = useApp();
  const [filtro, setFiltro] = useState<"PENDENTE" | "RESOLVIDO" | "Todos">("PENDENTE");

  const filtrados = alertas.filter((a) => filtro === "Todos" || a.status === filtro);

  const getPerfumeNome = (produtoId: string, produtoNome?: string) => {
    const p = perfumes.find((x) => x.id === produtoId);
    return p?.nome || produtoNome || "Produto desconhecido";
  };

  const handleResolver = async (id: string) => {
    await resolverAlerta(id);
  };

  const gerarMensagemWhatsApp = (a: typeof alertas[0]) => {
    const nome = getPerfumeNome(a.produtoId);
    const msg = `⚠️ Produto: ${nome}\nLoja: ${a.loja}\nStatus: ${a.tipo === "ZEROU" ? "Estoque zerado" : "Estoque abaixo do mínimo"}.`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-border">
        <div>
          <h2 className="font-display text-xl text-gold flex items-center gap-2">
            <Bell size={20} /> Alertas de Estoque
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{alertas.filter(a => a.status === "PENDENTE").length} pendentes</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-surface border border-border text-muted-foreground">✕</button>
      </div>

      <div className="flex gap-2 px-4 pt-3">
        {(["PENDENTE", "RESOLVIDO", "Todos"] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`pill ${filtro === f ? "pill-active" : "pill-inactive"}`}>
            {f === "PENDENTE" ? "Pendentes" : f === "RESOLVIDO" ? "Resolvidos" : "Todos"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-2.5">
        {filtrados.map((a) => {
          const nome = getPerfumeNome(a.produtoId, a.produtoNome);
          return (
            <div key={a.id} className={`card-premium p-4 ${a.status === "PENDENTE" ? "border-l-4" : ""}`}
              style={a.status === "PENDENTE" ? { borderLeftColor: a.tipo === "ZEROU" ? "hsl(var(--destructive))" : "hsl(45 93% 47%)" } : {}}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className={a.tipo === "ZEROU" ? "text-destructive" : "text-gold"} />
                    <span className={`text-xs font-semibold ${a.tipo === "ZEROU" ? "text-destructive" : "text-gold"}`}>
                      {a.tipo === "ZEROU" ? "Estoque Zerado" : "Estoque Baixo"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{nome}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Loja: {a.loja}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(a.criadoEm).toLocaleDateString("pt-BR")} às {new Date(a.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {a.status === "PENDENTE" && (
                    <>
                      <button onClick={() => handleResolver(a.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors">
                        <Check size={10} /> Resolver
                      </button>
                      <a href={gerarMensagemWhatsApp(a)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-center">
                        📱 WhatsApp
                      </a>
                    </>
                  )}
                  {a.status === "RESOLVIDO" && (
                    <span className="text-[10px] text-success font-medium">✓ Resolvido</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div className="text-center py-20">
            <Bell size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum alerta encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
