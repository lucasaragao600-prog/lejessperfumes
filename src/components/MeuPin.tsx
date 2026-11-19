import { useEffect, useState } from "react";
import { KeyRound, Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const EVENTO_BLOQUEAR = "lejess:bloquear";

export default function MeuPin() {
  const [open, setOpen] = useState(false);
  const [temPin, setTemPin] = useState(false);
  const [pin, setPin] = useState("");
  const [conf, setConf] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) supabase.rpc("fn_pin_status").then(({ data }) => setTemPin(!!data));
  }, [open]);

  const fechar = () => { setOpen(false); setPin(""); setConf(""); };
  const salvar = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("PIN deve ter de 4 a 6 números");
    if (pin !== conf) return toast.error("Os PINs não conferem");
    setSalvando(true);
    const { error } = await supabase.rpc("fn_pin_definir", { p_pin: pin });
    setSalvando(false);
    if (error) return toast.error(error.message.includes("fácil") ? "PIN muito fácil, escolha outro" : "PIN deve ter de 4 a 6 números");
    toast.success("PIN salvo"); fechar();
  };
  const remover = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.rpc("fn_pin_remover", { p_user_id: data.user.id });
    if (error) return toast.error("Não foi possível remover o PIN");
    toast.success("PIN removido"); fechar();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Meu PIN" className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors">
        <KeyRound size={16} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-background/80 flex items-center justify-center p-4" onClick={fechar}>
          <div className="card-premium w-full max-w-xs p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Meu PIN</h2>
              <button onClick={fechar}><X size={16} /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              {temPin ? "Você já tem PIN. Digite um novo para trocar." : "Crie um PIN de 4 a 6 números para desbloquear a tela sem digitar a senha."}
            </p>
            <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="Novo PIN" className="input-premium px-4 py-3 tracking-[0.5em]" />
            <input type="password" inputMode="numeric" maxLength={6} value={conf} onChange={(e) => setConf(e.target.value.replace(/\D/g, ""))} placeholder="Repita o PIN" className="input-premium px-4 py-3 tracking-[0.5em]" />
            <button onClick={salvar} disabled={salvando} className="btn-primary w-full py-2.5">{salvando ? "Salvando..." : "Salvar PIN"}</button>
            {temPin && (
              <div className="flex justify-between">
                <button onClick={() => { fechar(); window.dispatchEvent(new Event(EVENTO_BLOQUEAR)); }} className="text-xs text-gold flex items-center gap-1"><Lock size={12} /> Bloquear tela agora</button>
                <button onClick={remover} className="text-xs text-destructive">Remover PIN</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
