import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoLeJess from "@/assets/logo-le-jess.png";

interface Props {
  onCreated: () => void;
}

export default function PrimeiroCadastro({ onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Sign up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Use secure function to claim first master role
      const { data: claimed, error: claimError } = await supabase.rpc("claim_first_master", {
        p_user_id: data.user.id,
      });

      if (claimError || !claimed) {
        setError(claimError?.message || "Já existe um administrador master no sistema.");
      } else {
        // Update profile with loja
        await supabase.from("profiles").update({ loja: "" }).eq("user_id", data.user.id);
        onCreated();
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img src={logoLeJess} alt="Le Jess Perfumes" className="h-20 mx-auto mb-4 invert" />
          <p className="text-muted-foreground text-sm">Crie sua conta Master para começar</p>
          <p className="text-[10px] text-muted-foreground mt-1">Este será o administrador principal do sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Nome</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted transition-colors"
            />
          </div>

          {error && (
            <p className="text-destructive text-xs bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
            style={{ background: "var(--gradient-gold)" }}
          >
            {loading ? "Criando..." : "🔑 Criar Conta Master"}
          </button>
        </form>
      </div>
    </div>
  );
}
