import { useState, useEffect } from "react";
import { Users, Plus, Shield, Trash2, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LOJAS = ["Casa", "Sumaúma", "Amazonas"] as const;

interface UserItem {
  id: string;
  email: string;
  nome: string;
  loja: string;
  role: string | null;
}

export default function GerenciarUsuarios() {
  const auth = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nome: "", loja: "", role: "vendedor" as string });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome, loja");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    
    if (profiles) {
      const userList: UserItem[] = profiles.map((p) => {
        const r = roles?.find((r) => r.user_id === p.user_id);
        return {
          id: p.user_id,
          email: "",
          nome: p.nome,
          loja: p.loja,
          role: r?.role ?? null,
        };
      });
      setUsers(userList);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.nome) return;
    if (form.password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (form.role === "vendedor" && !form.loja) {
      toast({ title: "Erro", description: "Vendedoras devem ter uma loja atribuída.", variant: "destructive" });
      return;
    }
    setCreating(true);
    
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: form.email, password: form.password, nome: form.nome, loja: form.loja, role: form.role },
    });

    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error || error?.message || "Erro ao criar usuário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Usuário ${form.nome} criado com perfil ${form.role}` });
      setForm({ email: "", password: "", nome: "", loja: "", role: "vendedor" });
      setShowForm(false);
      fetchUsers();
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { userId },
    });

    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error || error?.message || "Erro ao excluir usuário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Usuário excluído com sucesso" });
      fetchUsers();
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-gold" />
            <h1 className="font-display text-2xl text-gold">Usuários</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gold-muted bg-gold/10 text-gold transition-all"
          >
            <Plus size={12} /> Novo
          </button>
        </div>
        <p className="text-muted-foreground text-xs">Gerencie os acessos ao sistema</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Formulário de criação */}
        {showForm && (
          <div className="bg-surface border border-gold-muted rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Novo Usuário</h3>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
              />
              <input
                type="email"
                placeholder="E-mail"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
              />
              <input
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
              />
              
              <div className="flex gap-2">
                {(["master", "vendedor"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, role: r, loja: r === "master" ? "" : form.loja })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.role === r
                        ? "bg-gold/20 text-gold border-gold-muted"
                        : "bg-surface-overlay border-border text-muted-foreground"
                    }`}
                  >
                    {r === "master" ? "🔑 Master" : "🛒 Vendedor"}
                  </button>
                ))}
              </div>

              {/* Loja selection - only for vendedor */}
              {form.role === "vendedor" && (
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium flex items-center gap-1">
                    <Store size={10} /> Loja (obrigatório)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LOJAS.map((loja) => (
                      <button
                        key={loja}
                        onClick={() => setForm({ ...form, loja })}
                        className={`py-2.5 rounded-lg text-xs font-medium border transition-all ${
                          form.loja === loja
                            ? "bg-gold/20 text-gold border-gold-muted"
                            : "bg-surface-overlay border-border text-muted-foreground"
                        }`}
                      >
                        {loja}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !form.email || !form.password || !form.nome || (form.role === "vendedor" && !form.loja)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              {creating ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        )}

        {/* Lista de usuários */}
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{u.nome || "Sem nome"}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      u.role === "master"
                        ? "bg-gold/20 text-gold border border-gold-muted"
                        : u.role === "vendedor"
                        ? "bg-surface-overlay text-muted-foreground border border-border"
                        : "bg-destructive/10 text-destructive border border-destructive/30"
                    }`}>
                      {u.role || "Sem papel"}
                    </span>
                  </div>
                  {u.loja && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Store size={9} /> {u.loja}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {u.id !== auth.user?.id && (
                    confirmDeleteId === u.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-destructive text-destructive-foreground disabled:opacity-50"
                        >
                          {deletingId === u.id ? "..." : "Confirmar"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(u.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )
                  )}
                  <Shield size={14} className={u.role === "master" ? "text-gold" : "text-muted-foreground"} />
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhum usuário cadastrado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
