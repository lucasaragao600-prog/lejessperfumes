import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENTO_BLOQUEAR } from "@/components/MeuPin";

const CHAVE = "lejess_tela_bloqueada";
const INATIVIDADE_MS = 10 * 60 * 1000;

// Bloqueia a tela por inatividade (só para quem tem PIN). Desbloqueio confere o PIN no servidor.
export default function BloqueioPin({ signOut }: { signOut: () => void }) {
  const [bloqueada, setBloqueada] = useState(() => sessionStorage.getItem(CHAVE) === "1");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const timer = useRef<number>();

  const bloquear = useCallback(async () => {
    const { data } = await supabase.rpc("fn_pin_status");
    if (!data) return;
    sessionStorage.setItem(CHAVE, "1");
    setBloqueada(true);
  }, []);

  useEffect(() => {
    const reiniciar = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(bloquear, INATIVIDADE_MS);
    };
    const evs = ["mousemove", "keydown", "touchstart", "click"];
    evs.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    window.addEventListener(EVENTO_BLOQUEAR, bloquear);
    reiniciar();
    return () => {
      window.clearTimeout(timer.current);
      evs.forEach((e) => window.removeEventListener(e, reiniciar));
      window.removeEventListener(EVENTO_BLOQUEAR, bloquear);
    };
  }, [bloquear]);

  const desbloquear = async (e: React.FormEvent) => {
    e.preventDefault();
    setConferindo(true); setErro(null);
    const { data, error } = await supabase.rpc("fn_pin_conferir", { p_pin: pin });
    setConferindo(false); setPin("");
    if (error) return setErro("Não foi possível conferir o PIN");
    if (data === "ok" || data === "sem_pin") { sessionStorage.removeItem(CHAVE); setBloqueada(false); return; }
    if (data === "bloqueado") {
      sessionStorage.removeItem(CHAVE);
      signOut();
      return;
    }
    setErro("PIN incorreto");
  };

  if (!bloqueada) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6">
      <form onSubmit={desbloquear} className="w-full max-w-xs space-y-5 text-center">
        <Lock className="mx-auto text-gold" size={32} />
        <h2 className="page-title text-xl">Tela bloqueada</h2>
        <p className="text-xs text-muted-foreground">Digite seu PIN para continuar. Após 5 erros será preciso entrar com a senha.</p>
        <input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="input-premium px-4 py-3 text-center tracking-[0.6em]" placeholder="PIN" />
        {erro && <p className="text-destructive text-xs">{erro}</p>}
        <button type="submit" disabled={conferindo || pin.length < 4} className="btn-primary w-full py-3">{conferindo ? "Conferindo..." : "Desbloquear"}</button>
        <button type="button" onClick={() => { sessionStorage.removeItem(CHAVE); signOut(); }} className="text-xs text-muted-foreground">Sair e entrar com senha</button>
      </form>
    </div>
  );
}
