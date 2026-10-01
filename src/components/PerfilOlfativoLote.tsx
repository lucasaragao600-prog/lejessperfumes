import { useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { preencherLote } from "@/lib/perfilOlfativoIA";

/** Master: completa o perfil olfativo de todos os perfumes vazios, 10 por vez, em sequência. */
export default function PerfilOlfativoLote() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState({ feitos: 0, preenchidos: 0, restantes: 0 });
  const parar = useRef(false);

  const iniciar = async () => {
    parar.current = false; setRodando(true);
    const ignorar: string[] = [];
    let feitos = 0, preenchidos = 0;
    try {
      while (!parar.current) {
        const r = await preencherLote(ignorar);
        if (!r.processados) break;
        ignorar.push(...r.ids);
        feitos += r.processados; preenchidos += r.preenchidos;
        setProg({ feitos, preenchidos, restantes: r.restantes });
        await new Promise((ok) => setTimeout(ok, 1500));
      }
      toast.success(`${preenchidos} perfumes preenchidos. Os não reconhecidos ficaram em branco para revisão.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRodando(false);
      qc.invalidateQueries({ queryKey: ["perfumes"] });
    }
  };

  return (
    <section className="card-premium p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-gold" />
        <h2 className="text-sm font-semibold text-foreground">Perfil olfativo automático</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Preenche família e notas dos perfumes que estão sem perfil. Só completa campos vazios; perfumes que a IA não reconhece com segurança ficam em branco.
      </p>
      {(rodando || prog.feitos > 0) && (
        <p className="text-xs text-foreground">
          {prog.feitos} analisados · {prog.preenchidos} preenchidos · {prog.restantes} ainda sem perfil
        </p>
      )}
      {rodando ? (
        <button className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2" onClick={() => (parar.current = true)}>
          <Loader2 size={14} className="animate-spin" /> Parar
        </button>
      ) : (
        <button className="btn-primary w-full py-2.5" onClick={iniciar}>Preencher todos com IA</button>
      )}
    </section>
  );
}
