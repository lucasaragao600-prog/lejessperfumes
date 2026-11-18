# Fase C: roda com uma sessão de vendedor da Sumaúma (lovable auth-session). Só tenta ações que são recusadas ou falham por saldo — não altera estoque.
import json,os,requests
s=json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))["session"]
U="https://yrwsssygxfopcnaiccgl.supabase.co"; K=open("/dev-server/.env").read().split("VITE_SUPABASE_PUBLISHABLE_KEY=")[1].split()[0].strip('"')
h={"apikey":K,"Authorization":"Bearer "+s["access_token"],"Content-Type":"application/json"}
CASA="fc56552c-ef8b-4b20-ae8e-d38c7e8fefd3"; SUM="d70f7899-6bf9-4c58-8900-56b3b3e02147"
def g(p): r=requests.get(U+"/rest/v1/"+p,headers={**h,"Prefer":"count=exact","Range":"0-0"}); return r.status_code, r.headers.get("content-range")
def rpc(f,b): r=requests.post(U+"/rest/v1/rpc/"+f,headers=h,json=b); return r.status_code, r.text[:110]
prod=requests.get(U+"/rest/v1/perfumes?select=id&limit=1",headers=h).json()[0]["id"]
for t in ["estoque_unidades","vendas","movimentacoes","reposicoes","testers","caixa_sessoes","transferencias"]:
  print(t,"outra loja",g(f"{t}?select=id&unidade_id=eq.{CASA}") if t not in("reposicoes","transferencias") else g(f"{t}?select=id"), )
print("estoque própria loja", g(f"estoque_unidades?select=id&unidade_id=eq.{SUM}"))
print("vendas própria", g(f"vendas?select=id&unidade_id=eq.{SUM}"))
print("pagamentos total visível", g("venda_pagamentos?select=id"))
print("ajustar Casa", rpc("fn_ajustar_saldo",{"p_produto_id":prod,"p_unidade":"Casa","p_quantidade":0,"p_modo":"delta"}))
print("baixar venda Casa", rpc("fn_baixar_venda",{"p_produto_id":prod,"p_unidade":"Casa","p_quantidade":999999}))
print("transferir de Casa", rpc("fn_transferir",{"p_produto_id":prod,"p_origem":"Casa","p_destino":"Sumaúma","p_quantidade":999999}))
print("transferir de Sumaúma (própria, deve cair em saldo)", rpc("fn_transferir",{"p_produto_id":prod,"p_origem":"Sumaúma","p_destino":"Casa","p_quantidade":999999}))
print("concluir interna", rpc("fn_transf_concluir_interna",{"p_id":CASA,"p_modo":"x"}))
r=requests.post(U+"/rest/v1/rpc/fn_estoque_resumo",headers=h,json={"p_filtros":{"unidade":"Casa"}}).json(); print("resumo filtro Casa", r.get("total"), r.get("unidades"))
print("tester em Casa", requests.post(U+"/rest/v1/testers",headers=h,json={"perfume_id":prod,"perfume_nome":"x","marca":"x","deposito":"Casa","quantidade":0}).status_code)
