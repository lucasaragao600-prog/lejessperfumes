import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "master" | "vendedor";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { nome: string; loja: string } | null;
  loading: boolean;
  hasMaster: boolean | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_BOOT_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Tempo limite ao restaurar a sessão")), timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ nome: string; loja: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMaster, setHasMaster] = useState<boolean | null>(null);

  const checkHasMaster = async () => {
    const { data } = await supabase.rpc("check_master_exists");
    setHasMaster(data === true);
  };

  const fetchUserData = async (userId: string) => {
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("nome, loja").eq("user_id", userId).maybeSingle(),
    ]);
    setRole((roleData?.role as AppRole) ?? null);
    setProfile(profileData ? { nome: profileData.nome, loja: profileData.loja } : null);
  };

  const refreshUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchUserData(session.user.id);
    }
    await checkHasMaster();
  };

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    const initializeAuth = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS);
        if (!active) return;

        const restoredSession = data.session;
        setSession(restoredSession);
        setUser(restoredSession?.user ?? null);

        if (restoredSession?.user) {
          await withTimeout(fetchUserData(restoredSession.user.id), AUTH_BOOT_TIMEOUT_MS);
        }

        void withTimeout(checkHasMaster(), AUTH_BOOT_TIMEOUT_MS).catch(() => {
          if (active) setHasMaster(true);
        });
      } catch (error) {
        console.warn("Não foi possível restaurar a sessão automaticamente:", error);
        if (active) {
          setSession(null);
          setUser(null);
          setRole(null);
          setProfile(null);
          setHasMaster(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, hasMaster, signIn, signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
