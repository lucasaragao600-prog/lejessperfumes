import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { RELAY_SOURCE } from "./relay.ts";
import { carregarPfx, montarNfce } from "./nfce.ts";
import { emitirVenda } from "./emitir.ts";

const APP = "lejess-fiscal-yrwsss";
const RELAY_URL = `https://${APP}.fly.dev`;
const MACHINES = "https://api.machines.dev/v1";

const SEFAZ_AM = {
  homologacao: { status: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4", tpAmb: 2 },
  producao: { status: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4", tpAmb: 1 },
};

const Body = z.object({
  action: z.enum(["deploy", "health", "status", "teste_emissao", "emitir"]),
  grupo_venda: z.string().uuid().optional(),
  unidade_id: z.string().uuid().optional(),
  crt: z.enum(["1","2","3"]).optional(),
});

async function testeEmissao(admin: any, unidadeId: string, crtTeste?: string) {
  const cert = await carregarCertificado(admin);
  const { data: cfg } = await admin.from("configuracoes_fiscais").select("*").eq("unidade_id", unidadeId).maybeSingle();
  if (!cfg) throw new Error("Unidade sem configuração fiscal");
  if (cfg.ambiente !== "homologacao") throw new Error("Teste só é permitido em homologação");
  if (!cfg.inscricao_estadual || !cfg.csc_token) throw new Error("IE ou CSC não cadastrados");
  const { data: prods } = await admin.from("perfumes").select("codigo,nome,marca,ncm,cfop,cst_csosn,codigo_barras,preco_venda")
    .gt("preco_venda", 0).order("ncm", { ascending: false }).limit(1);
  const p = (prods || [])[0];
  if (!p) throw new Error("Nenhum produto com preço");
  if (String(p.ncm || "").replace(/\D/g, "").length !== 8) p.ncm = "33030010"; // perfume
  const { key, certB64, validade } = carregarPfx(cert.pfx, cert.senha);
  const { chave, nfe, total } = montarNfce({
    cnpj: cfg.cnpj, ie: cfg.inscricao_estadual, razao: cfg.razao_social, fantasia: cfg.nome_fantasia,
    endereco: cfg.endereco, numero: cfg.numero, bairro: cfg.bairro, cep: cfg.cep, fone: cfg.telefone,
    crt: (crtTeste || (cfg.regime_tributario === "simples_nacional" ? "1" : "3")) as any, serie: cfg.serie_nfce || 1,
    numeroNota: cfg.proximo_numero_nfce || 1, cscId: cfg.csc_id, csc: cfg.csc_token, tpAmb: 2,
  }, [{
    codigo: p.codigo, gtin: String(p.codigo_barras || ""), descricao: `${p.marca} ${p.nome}`, ncm: p.ncm,
    cfop: p.cfop || "5102", csosn: p.cst_csosn || "102", un: "UN", qtd: 1, valor: Number(p.preco_venda),
  }], "01", key, certB64);
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now().toString().slice(-15)}</idLote><indSinc>1</indSinc>${nfe}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const r = await fetch(`${RELAY_URL}/soap`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("FISCAL_RELAY_SECRET")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4", envelope, pfx: cert.pfx, senha: cert.senha,
      action: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
    }),
  });
  const out = await r.json();
  const body: string = out.body || "";
  const all = (tag: string) => [...body.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`, "g"))].map((m) => m[1]);
  const cStats = all("cStat"), motivos = all("xMotivo");
  const prot = all("nProt")[0] ?? null;
  if (prot) await admin.from("configuracoes_fiscais").update({ proximo_numero_nfce: (cfg.proximo_numero_nfce || 1) + 1 }).eq("id", cfg.id);
  return { chave, total, produto: p.codigo, certificado_valido_ate: validade, lote: { cStat: cStats[0], xMotivo: motivos[0] },
    nota: { cStat: cStats[1] ?? null, xMotivo: motivos[1] ?? null, protocolo: prot }, http: out.status, erro: out.error ?? null,
    corpo: cStats.length ? undefined : body.slice(0, 1500),
    nfeProc: prot ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfe}${(body.match(/<protNFe[\s\S]*?<\/protNFe>/) || [""])[0]}</nfeProc>` : undefined };
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function flyAuth(raw: string) {
  const t = raw.trim();
  if (t.startsWith("FlyV1 ")) return t;
  if (t.startsWith("fm")) return `FlyV1 ${t}`;
  return `Bearer ${t.replace(/^Bearer\s+/, "")}`;
}

async function fly(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("FLY_API_TOKEN")!;
  const r = await fetch(`${MACHINES}${path}`, {
    ...init,
    headers: { Authorization: flyAuth(token), "Content-Type": "application/json" },
  });
  const text = await r.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* texto */ }
  return { ok: r.ok, status: r.status, data };
}

async function flyGraphql(query: string, variables: Record<string, unknown>) {
  const token = Deno.env.get("FLY_API_TOKEN")!;
  const r = await fetch("https://api.fly.io/graphql", {
    method: "POST",
    headers: { Authorization: flyAuth(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return await r.json();
}

async function deploy() {
  const steps: Record<string, unknown> = {};
  const orgs = await flyGraphql(`query { organizations { nodes { id slug type } } }`, {});
  const nodes = orgs?.data?.organizations?.nodes || [];
  steps.orgs = orgs.errors ? orgs.errors[0]?.message : nodes.map((n: any) => n.slug);
  const org = (nodes.find((n: any) => n.type === "PERSONAL") || nodes[0])?.slug || "personal";
  const app = await fly("/apps", { method: "POST", body: JSON.stringify({ app_name: APP, org_slug: org }) });
  if (!app.ok) { steps.app_http = app.status;
    const g = await flyGraphql(
      `mutation($input: CreateAppInput!){ createApp(input:$input){ app { name } } }`,
      { input: { name: APP, organizationId: (nodes.find((n: any) => n.slug === org) || {}).id, machines: true } },
    );
    steps.app_graphql = g.errors ? g.errors[0]?.message : "criado";
    if (!g.errors || /taken|already/i.test(g.errors[0]?.message || "")) { app.ok = true; }
  }
  steps.app = app.ok ? "criado" : (app.status === 422 || app.status === 409 ? "já existia" : app.data);
  if (!app.ok && app.status !== 422 && app.status !== 409) return { ok: false, steps };

  for (const type of ["shared_v4", "v6"]) {
    const ip = await flyGraphql(
      `mutation($input: AllocateIPAddressInput!){ allocateIpAddress(input:$input){ ipAddress { address } } }`,
      { input: { appId: APP, type } },
    );
    steps[`ip_${type}`] = ip.errors ? ip.errors[0]?.message : "ok";
  }

  const config = {
    image: "node:20-alpine",
    init: { cmd: ["node", "/app/server.mjs"] },
    files: [{ guest_path: "/app/server.mjs", raw_value: btoa(RELAY_SOURCE) }],
    env: { RELAY_SECRET: Deno.env.get("FISCAL_RELAY_SECRET")!, NODE_OPTIONS: "--openssl-legacy-provider" },
    guest: { cpu_kind: "shared", cpus: 1, memory_mb: 256 },
    services: [{
      protocol: "tcp", internal_port: 8080,
      ports: [{ port: 443, handlers: ["tls", "http"] }, { port: 80, handlers: ["http"], force_https: true }],
      autostop: "stop", autostart: true, min_machines_running: 0,
    }],
  };

  const list = await fly(`/apps/${APP}/machines`);
  const existing = Array.isArray(list.data) ? list.data[0] : null;
  const m = existing
    ? await fly(`/apps/${APP}/machines/${existing.id}`, { method: "POST", body: JSON.stringify({ config, region: "gru" }) })
    : await fly(`/apps/${APP}/machines`, { method: "POST", body: JSON.stringify({ config, region: "gru" }) });
  steps.machine = m.ok ? (existing ? "atualizada" : "criada") : m.data;
  return { ok: m.ok, url: RELAY_URL, steps };
}

async function carregarCertificado(admin: any) {
  const { data: cfgs } = await admin.from("configuracoes_fiscais").select("*");
  const comCert = (cfgs || []).find((c: any) => c.certificado_digital_url && c.certificado_senha);
  if (!comCert) throw new Error("Certificado digital ou senha não cadastrados");
  const { data: file, error } = await admin.storage.from("fiscal-xml").download(comCert.certificado_digital_url);
  if (error || !file) throw new Error("Não foi possível ler o arquivo do certificado");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { pfx: btoa(bin), senha: comCert.certificado_senha as string, ambiente: (comCert.ambiente || "homologacao") as "homologacao" | "producao" };
}

async function status(admin: any) {
  const cert = await carregarCertificado(admin);
  const cfg = SEFAZ_AM[cert.ambiente];
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${cfg.tpAmb}</tpAmb><cUF>13</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const r = await fetch(`${RELAY_URL}/soap`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("FISCAL_RELAY_SECRET")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: cfg.status, envelope, pfx: cert.pfx, senha: cert.senha,
      action: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF",
    }),
  });
  const out = await r.json();
  const body: string = out.body || "";
  const pick = (tag: string) => body.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`))?.[1] ?? null;
  return { ok: !!pick("cStat"), ambiente: cert.ambiente, cStat: pick("cStat"), xMotivo: pick("xMotivo"), http: out.status, erro: out.error ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Ação inválida" }, 400);
    if (parsed.data.action === "emitir") {
      if (!parsed.data.grupo_venda) return json({ error: "Informe a venda" }, 400);
      try { return json(await emitirVenda(admin, caller, parsed.data.grupo_venda, RELAY_URL, carregarCertificado)); }
      catch (e) { return json({ ok: false, motivo: e instanceof Error ? e.message : "Erro" }); }
    }
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "master").maybeSingle();
    if (!role) return json({ error: "Apenas Master" }, 403);

    if (parsed.data.action === "deploy") return json(await deploy());
    if (parsed.data.action === "teste_emissao") {
      if (!parsed.data.unidade_id) return json({ error: "Informe a unidade" }, 400);
      return json(await testeEmissao(admin, parsed.data.unidade_id, parsed.data.crt));
    }
    if (parsed.data.action === "health") {
      const r = await fetch(`${RELAY_URL}/health`).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      return json({ ok: r.ok, status: r.status, body: await r.text() });
    }
    return json(await status(admin));
  } catch (e) {
    console.error("fiscal-sefaz", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
