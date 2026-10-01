// Montagem e assinatura de NFC-e 4.00 (modelo 65) — usado no teste de homologação.
import forge from "npm:node-forge@1.3.1";

const esc = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "").trim();
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const n2 = (v: number) => v.toFixed(2);

export function carregarPfx(pfxB64: string, senha: string) {
  const der = forge.util.decode64(pfxB64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);
  const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
    || (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
  const key = keyBag!.key as forge.pki.rsa.PrivateKey;
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((b: any) => b.cert);
  const cert = certs.find((c: any) => c.publicKey.n.equals(key.n)) || certs[0];
  const certB64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
  return { key, certB64, validade: cert.validity.notAfter as Date };
}

const sha1b64 = (s: string) => { const md = forge.md.sha1.create(); md.update(s, "utf8"); return forge.util.encode64(md.digest().getBytes()); };
const sha1hex = (s: string) => { const md = forge.md.sha1.create(); md.update(s, "utf8"); return md.digest().toHex().toUpperCase(); };

function dvChave(c: string) {
  let soma = 0, peso = 2;
  for (let i = c.length - 1; i >= 0; i--) { soma += Number(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = 11 - (soma % 11);
  return r >= 10 ? 0 : r;
}

function agoraManaus() {
  const d = new Date(Date.now() - 4 * 3600_000);
  return d.toISOString().slice(0, 19) + "-04:00";
}

export interface Emitente {
  cnpj: string; ie: string; razao: string; fantasia: string; endereco: string; numero: string; bairro: string;
  cep: string; fone: string; crt: "1" | "3"; serie: number; numeroNota: number; cscId: string; csc: string; tpAmb: 1 | 2;
}
export interface Item { codigo: string; gtin: string; descricao: string; ncm: string; cfop: string; csosn: string; un: string; qtd: number; valor: number }

export function montarNfce(em: Emitente, itens: Item[], pagamentoTipo: string, key: any, certB64: string) {
  const dh = agoraManaus();
  const aamm = dh.slice(2, 4) + dh.slice(5, 7);
  const cnpj = dig(em.cnpj);
  const cNF = String(Math.floor(10000000 + Math.random() * 89999999));
  const base = `13${aamm}${cnpj}65${String(em.serie).padStart(3, "0")}${String(em.numeroNota).padStart(9, "0")}1${cNF}`;
  const cDV = dvChave(base);
  const chave = base + cDV;
  const homolog = em.tpAmb === 2;

  let total = 0, tIbs = 0, tCbs = 0;
  const dets = itens.map((it, i) => {
    const vProd = it.qtd * it.valor; total += vProd;
    const vIbs = Math.round(vProd * 0.001 * 100) / 100, vCbs = Math.round(vProd * 0.009 * 100) / 100;
    tIbs += vIbs; tCbs += vCbs;
    const ibscbs = `<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>${n2(vProd)}</vBC><gIBSUF><pIBSUF>0.1000</pIBSUF><vIBSUF>${n2(vIbs)}</vIBSUF></gIBSUF><gIBSMun><pIBSMun>0.0000</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>${n2(vIbs)}</vIBS><gCBS><pCBS>0.9000</pCBS><vCBS>${n2(vCbs)}</vCBS></gCBS></gIBSCBS></IBSCBS>`;
    const desc = homolog && i === 0 ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : esc(it.descricao).slice(0, 120);
    const gtin = /^\d{8}$|^\d{12,14}$/.test(it.gtin) ? it.gtin : "SEM GTIN";
    return `<det nItem="${i + 1}"><prod><cProd>${esc(it.codigo)}</cProd><cEAN>${gtin}</cEAN><xProd>${desc}</xProd><NCM>${dig(it.ncm)}</NCM><CFOP>${it.cfop}</CFOP><uCom>${esc(it.un)}</uCom><qCom>${it.qtd.toFixed(4)}</qCom><vUnCom>${it.valor.toFixed(10)}</vUnCom><vProd>${n2(vProd)}</vProd><cEANTrib>${gtin}</cEANTrib><uTrib>${esc(it.un)}</uTrib><qTrib>${it.qtd.toFixed(4)}</qTrib><vUnTrib>${it.valor.toFixed(10)}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>${it.csosn}</CSOSN></ICMSSN102></ICMS><PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS><COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>${ibscbs}</imposto></det>`;
  }).join("");

  const id = `NFe${chave}`;
  const inner = `<ide><cUF>13</cUF><cNF>${cNF}</cNF><natOp>VENDA</natOp><mod>65</mod><serie>${em.serie}</serie><nNF>${em.numeroNota}</nNF><dhEmi>${dh}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>1302603</cMunFG><tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>${cDV}</cDV><tpAmb>${em.tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>LeJess1.0</verProc></ide>`
    + `<emit><CNPJ>${cnpj}</CNPJ><xNome>${esc(em.razao)}</xNome><xFant>${esc(em.fantasia)}</xFant><enderEmit><xLgr>${esc(em.endereco)}</xLgr><nro>${esc(em.numero)}</nro><xBairro>${esc(em.bairro)}</xBairro><cMun>1302603</cMun><xMun>MANAUS</xMun><UF>AM</UF><CEP>${dig(em.cep)}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>${dig(em.fone).slice(0, 14)}</fone></enderEmit><IE>${dig(em.ie)}</IE><CRT>${em.crt}</CRT></emit>`
    + dets
    + `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${n2(total)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${n2(total)}</vNF></ICMSTot><IBSCBSTot><vBCIBSCBS>${n2(total)}</vBCIBSCBS><gIBS><gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${n2(tIbs)}</vIBSUF></gIBSUF><gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>${n2(tIbs)}</vIBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS><gCBS><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vCBS>${n2(tCbs)}</vCBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS></IBSCBSTot></total>`
    + `<transp><modFrete>9</modFrete></transp><pag><detPag><tPag>${pagamentoTipo}</tPag><vPag>${n2(total)}</vPag></detPag></pag>`
    + `<infRespTec><CNPJ>${cnpj}</CNPJ><xContato>MAISON LE JESS</xContato><email>contato@lejess.com.br</email><fone>${dig(em.fone).slice(0, 14)}</fone></infRespTec>`;

  const infCanon = `<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="${id}" versao="4.00">${inner}</infNFe>`;
  const infDoc = `<infNFe Id="${id}" versao="4.00">${inner}</infNFe>`;
  const digest = sha1b64(infCanon);

  const signedInfoBody = `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference>`;
  const siCanon = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoBody}</SignedInfo>`;
  const md = forge.md.sha1.create(); md.update(siCanon, "utf8");
  const sigValue = forge.util.encode64(key.sign(md));

  const cId = String(Number(em.cscId));
  const pre = `${chave}|2|${em.tpAmb}|${cId}`;
  const urlQr = homolog ? "http://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp" : "http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp";
  const qr = Deno.env.get("NFCE_QR_V2") ? `${urlQr}?p=${pre}|${sha1hex(pre + em.csc)}` : `${urlQr}?p=${chave}|3|${em.tpAmb}`;
  const urlChave = homolog ? "www.sefaz.am.gov.br/nfce/consulta" : "www.sefaz.am.gov.br/nfce/consulta";
  const supl = `<infNFeSupl><qrCode><![CDATA[${qr}]]></qrCode><urlChave>${urlChave}</urlChave></infNFeSupl>`;
  const sig = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>${signedInfoBody}</SignedInfo><SignatureValue>${sigValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  const nfe = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infDoc}${supl}${sig}</NFe>`;
  return { chave, nfe, total, qr };
}
