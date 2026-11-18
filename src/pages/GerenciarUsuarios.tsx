import { useState, useEffect } from "react";
import { Users, Plus, Shield, Store, Pencil, UserX, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PermissoesCargo from "@/components/reposicao/PermissoesCargo";
import { useUnidades } from "@/hooks/useUnidades";

interface UserItem {
  id: string;
  nome: string;
  loja: string;
  unidadeId: string | null;
  role: string | null;
  ativo: boolean;
  inativadoMotivo: string | null;
}

const PERFIL_LABEL: Record<string, string> = { master: "Master", vendedor_lider: "Vendedor Líder", vendedor: "Vendedor" };

async function mensagemErro(data: any, error: any): Promise<string | undefined> {
  let msg: string | undefined = data?.error;
  if (!msg && error && "context" in error) {
    try { msg = (await (error as { context: Response }).context.json())?.error; } catch { /* ignora */ }
  }
  return msg || error?.message;
}

export default function GerenciarUsuarios() {
  const { nomes: LOJAS, unidades } = useUnidades({ contexto: "operacional" });
  const auth = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nome: "", loja: "", role: "vendedor" as string });
  const [creating, setCreating] = useState(false);
  const [verInativos, setVerInativos] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string; role: string; unidadeId: string } | null>(null);
  const [inativando, setInativando] = useState<{ id: string; motivo: string } | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_usuarios_listar" as any);
    if (error) toast({ title: "Erro", description: "Não foi possível carregar os usuários.", variant: "destructive" });
    setUsers(((data as any[]) || []).map((u) => ({
      id: u.user_id, nome: u.nome, loja: u.loja, unidadeId: u.unidade_id, role: u.role,
      ativo: u.ativo !== false, inativadoMotivo: u.inativado_motivo,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.nome) return;
    if (form.password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (form.role !== "master" && !form.loja) {
      toast({ title: "Erro", description: "Vendedoras devem ter uma loja atribuída.", variant: "destructive" });
      return;
    }
    setCreating(true);
    
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: form.email, password: form.password, nome: form.nome, loja: form.loja, role: form.role },
    });

    let msg: string | undefined = data?.error;
    if (!msg && error && "context" in error) {
      try { msg = (await (error as { context: Response }).context.json())?.error; } catch { /* ignora */ }
    }
    if (error || data?.error) {
      toast({ title: "Erro ao criar usuário", description: msg || "Erro ao criar usuário", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `Usuário ${form.nome} criado com perfil ${PERFIL_LABEL[form.role] || form.role}` });
      setForm({ email: "", password: "", nome: "", loja: "", role: "vendedor" });
      setShowForm(false);
      fetchUsers();
    }
    setCreating(false);
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    setSalvandoId(editando.id);
    const { error } = await supabase.rpc("fn_usuario_salvar" as any, {
      p_user_id: editando.id, p_nome: editando.nome, p_role: editando.role,
      p_unidade_id: editando.role === "master" ? null : editando.unidadeId || null,
    });
    setSalvandoId(null);
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Usuário atualizado" });
    setEditando(null);
    fetchUsers();
  };

  const alterarSituacao = async (userId: string, ativo: boolean, motivo?: string) => {
    setSalvandoId(userId);
    const { data, error } = await supabase.functions.invoke("user-status", { body: { userId, ativo, motivo } });
    setSalvandoId(null);
    if (error || data?.error) {
      toast({ title: "Não foi possível alterar", description: (await mensagemErro(data, error)) || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: ativo ? "Usuário reativado" : "Usuário inativado", description: ativo ? "O login foi liberado." : "O login foi bloqueado e o histórico foi mantido." });
    setInativando(null);
    fetchUsers();
  };

  const lista = users.filter((u) => u.ativo !== verInativos);
  const qtdInativos = users.filter((u) => !u.ativo).length;
  const campo = "w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted";

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
        <PermissoesCargo />

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
                {(["master", "vendedor_lider", "vendedor"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, role: r, loja: r === "master" ? "" : form.loja })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.role === r
                        ? "bg-gold/20 text-gold border-gold-muted"
                        : "bg-surface-overlay border-border text-muted-foreground"
                    }`}
                  >
                    {r === "master" ? "🔑 Master" : r === "vendedor_lider" ? "⭐ Vendedor Líder" : "🛒 Vendedor"}
                  </button>
                ))}
              </div>

              {/* Loja selection - only for vendedor */}
              {form.role !== "master" && (
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
              disabled={creating || !form.email || !form.password || !form.nome || (form.role !== "master" && !form.loja)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-gold)" }}
            >
              {creating ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        )}

        {/* Lista de usuários */}
        <div className="flex gap-2">
          <button onClick={() => setVerInativos(false)}
            className={`px-3 py-1.5 rounded-full text-xs border ${!verInativos ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
            Ativos
          </button>
          <button onClick={() => setVerInativos(true)}
            className={`px-3 py-1.5 rounded-full text-xs border ${verInativos ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
            Inativos ({qtdInativos})
          </button>
        </div>
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {lista.map((u) => (
              <div key={u.id} className={`bg-surface border border-border rounded-xl p-4 space-y-3 ${!u.ativo ? "opacity-80" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{u.nome || "Sem nome"}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        u.role === "master" ? "bg-gold/20 text-gold border-gold-muted"
                        : u.role ? "bg-surface-overlay text-muted-foreground border-border"
                        : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                        {u.role ? PERFIL_LABEL[u.role] || u.role : "Sem perfil"}
                      </span>
                      {!u.ativo && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-destructive/10 text-destructive border-destructive/30">Inativo</span>}
                    </div>
                    {u.loja && <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Store size={9} /> {u.loja}</p>}
                    {!u.ativo && u.inativadoMotivo && <p className="text-[10px] text-muted-foreground mt-0.5">Motivo: {u.inativadoMotivo}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {u.ativo && (
                      <button aria-label="Editar usuário" onClick={() => setEditando({ id: u.id, nome: u.nome, role: u.role || "vendedor", unidadeId: u.unidadeId || "" })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10"><Pencil size={14} /></button>
                    )}
                    {u.id !== auth.user?.id && (u.ativo ? (
                      <button aria-label="Inativar usuário" onClick={() => setInativando({ id: u.id, motivo: "" })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><UserX size={14} /></button>
                    ) : (
                      <button onClick={() => alterarSituacao(u.id, true)} disabled={salvandoId === u.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-gold-muted text-gold bg-gold/10 disabled:opacity-50">
                        <UserCheck size={12} /> {salvandoId === u.id ? "..." : "Reativar"}
                      </button>
                    ))}
                    <Shield size={14} className={u.role === "master" ? "text-gold" : "text-muted-foreground"} />
                  </div>
                </div>

                {editando?.id === u.id && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <input className={campo} value={editando.nome} placeholder="Nome" onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["master", "vendedor_lider", "vendedor"] as const).map((r) => (
                        <button key={r} onClick={() => setEditando({ ...editando, role: r })}
                          className={`py-2 rounded-lg text-[11px] font-medium border ${editando.role === r ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                          {PERFIL_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    {editando.role !== "master" && (
                      <select className={campo} value={editando.unidadeId} onChange={(e) => setEditando({ ...editando, unidadeId: e.target.value })} aria-label="Loja">
                        <option value="">Escolha a loja</option>
                        {unidades.map((un) => <option key={un.id} value={un.id}>{un.nomeExibicao}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button onClick={salvarEdicao} disabled={salvandoId === u.id || !editando.nome.trim() || (editando.role !== "master" && !editando.unidadeId)}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold text-primary-foreground disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}>
                        {salvandoId === u.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button onClick={() => setEditando(null)} className="px-3 py-2 rounded-lg text-xs border border-border text-muted-foreground">Cancelar</button>
                    </div>
                  </div>
                )}

                {inativando?.id === u.id && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[11px] text-muted-foreground">O login será bloqueado e todo o histórico continua guardado. Dá para reativar depois.</p>
                    <input className={campo} value={inativando.motivo} placeholder="Motivo da inativação (obrigatório)" onChange={(e) => setInativando({ ...inativando, motivo: e.target.value })} />
                    <div className="flex gap-2">
                      <button onClick={() => alterarSituacao(u.id, false, inativando.motivo.trim())} disabled={salvandoId === u.id || inativando.motivo.trim().length < 5}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground disabled:opacity-40">
                        {salvandoId === u.id ? "Inativando..." : "Inativar usuário"}
                      </button>
                      <button onClick={() => setInativando(null)} className="px-3 py-2 rounded-lg text-xs border border-border text-muted-foreground">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {lista.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">{verInativos ? "Nenhum usuário inativo" : "Nenhum usuário ativo"}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
