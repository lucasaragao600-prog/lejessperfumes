import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Schema = z.object({
  userId: z.string().uuid(),
  ativo: z.boolean(),
  motivo: z.string().max(500).optional(),
});

// Inativa/reativa um usuário: regra e auditoria no banco (como o Master logado), depois bloqueia/libera o login.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
    const { userId, ativo, motivo } = parsed.data;

    const { error: rpcErr } = await caller.rpc("fn_usuario_definir_ativo", { p_user_id: userId, p_ativo: ativo, p_motivo: motivo ?? null });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: ativo ? "none" : "876000h" });
    if (banErr) {
      console.error("user-status: falha ao atualizar login", banErr.message);
      return json({ error: "Situação salva, mas o bloqueio do login falhou. Tente novamente." }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("user-status: erro inesperado", e instanceof Error ? e.message : "desconhecido");
    return json({ error: "Erro interno" }, 500);
  }
});
