import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Item = { marca: string; nome: string; concentracao?: string };
type Perfil = { familia: string; saida: string; coracao: string; fundo: string; confianca: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resultados"],
  properties: {
    resultados: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["familia", "saida", "coracao", "fundo", "confianca"],
        properties: {
          familia: { type: "string" }, saida: { type: "string" }, coracao: { type: "string" },
          fundo: { type: "string" }, confianca: { type: "string", enum: ["alta", "media", "baixa"] },
        },
      },
    },
  },
};

class GatewayError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function gerar(itens: Item[]): Promise<Perfil[]> {
  const lista = itens.map((i, n) => `${n + 1}. ${i.marca} - ${i.nome}${i.concentracao ? ` (${i.concentracao})` : ""}`).join("\n");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "Você é especialista em perfumaria. Para cada perfume listado, informe em português do Brasil a família olfativa (ex.: 'Amadeirado Especiado') e as notas de saída, coração e fundo conforme a pirâmide oficial divulgada pela marca, separadas por vírgula. Responda um resultado por item, na mesma ordem. Se não conhecer o perfume com segurança, deixe os campos vazios e use confianca 'baixa'. Nunca invente.",
      input: lista,
      text: { format: { type: "json_schema", name: "perfis", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new GatewayError(res.status, res.status === 402 ? "Créditos de IA esgotados." : res.status === 429 ? "Muitas consultas seguidas, tente em instantes." : `Falha na IA (${res.status}) ${t.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new GatewayError(500, "A IA não conseguiu responder.");
      } catch (e) { if (e instanceof GatewayError) throw e; }
    }
  }
  const out = JSON.parse(text || "{}").resultados as Perfil[] | undefined;
  if (!Array.isArray(out)) throw new GatewayError(500, "Resposta da IA vazia.");
  return itens.map((_, i) => out[i] ?? { familia: "", saida: "", coracao: "", fundo: "", confianca: "baixa" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await anon.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const modo = String(body?.modo ?? "sugerir");

    if (modo === "sugerir") {
      const itens: Item[] = (Array.isArray(body?.itens) ? body.itens : []).slice(0, 10)
        .map((i: any) => ({ marca: String(i?.marca ?? "").slice(0, 100), nome: String(i?.nome ?? "").slice(0, 150), concentracao: String(i?.concentracao ?? "").slice(0, 20) }))
        .filter((i: Item) => i.nome.trim());
      if (!itens.length) return json({ error: "Informe o nome do perfume." }, 400);
      return json({ resultados: await gerar(itens) });
    }

    // Modos que gravam: só preenchem campos vazios e ignoram confiança baixa.
    let q = admin.from("perfumes").select("id, marca, nome, concentracao, perfil_olfativo, notas_saida, notas_coracao, notas_fundo")
      .eq("perfil_olfativo", "").eq("notas_saida", "").eq("notas_coracao", "").eq("notas_fundo", "");
    if (modo === "codigos") {
      const cods = (Array.isArray(body?.codigos) ? body.codigos : []).slice(0, 10).map(String);
      if (!cods.length) return json({ error: "Sem códigos." }, 400);
      q = q.in("codigo", cods);
    } else if (modo === "lote") {
      const { data: r } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "master").maybeSingle();
      if (!r) return json({ error: "Apenas Master pode completar em lote." }, 403);
      const ignorar = (Array.isArray(body?.ignorar) ? body.ignorar : []).slice(0, 2000).map(String);
      if (ignorar.length) q = q.not("id", "in", `(${ignorar.join(",")})`);
      q = q.order("marca").limit(10);
    } else return json({ error: "Modo inválido." }, 400);

    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows?.length) return json({ processados: 0, preenchidos: 0, ids: [], restantes: 0 });

    const perfis = await gerar(rows.map((r) => ({ marca: r.marca, nome: r.nome, concentracao: r.concentracao })));
    let preenchidos = 0;
    for (let i = 0; i < rows.length; i++) {
      const p = perfis[i];
      if (p.confianca === "baixa" || !(p.familia || p.saida || p.coracao || p.fundo)) continue;
      const { error: e } = await admin.from("perfumes").update({
        perfil_olfativo: p.familia.slice(0, 120), notas_saida: p.saida.slice(0, 500),
        notas_coracao: p.coracao.slice(0, 500), notas_fundo: p.fundo.slice(0, 500),
      }).eq("id", rows[i].id).eq("perfil_olfativo", "").eq("notas_saida", "").eq("notas_coracao", "").eq("notas_fundo", "");
      if (!e) preenchidos++;
    }
    await admin.from("audit_logs").insert({
      usuario_id: u.user.id, acao: "perfil_olfativo_ia", entidade: "perfumes",
      dados_novos: { modo, processados: rows.length, preenchidos, ids: rows.map((r) => r.id) },
    }).then(() => {}, () => {});

    const { count } = await admin.from("perfumes").select("id", { count: "exact", head: true })
      .eq("perfil_olfativo", "").eq("notas_saida", "").eq("notas_coracao", "").eq("notas_fundo", "");
    return json({ processados: rows.length, preenchidos, ids: rows.map((r) => r.id), restantes: count ?? 0 });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erro" }, e instanceof GatewayError && [402, 403, 429].includes(e.status) ? e.status : 500);
  }
});
