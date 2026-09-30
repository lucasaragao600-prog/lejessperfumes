// Código do servidor-ponte (roda no Fly.io). Sem dependências.
// Recebe o envelope SOAP + certificado A1 e faz a conexão mTLS com a SEFAZ.
export const RELAY_SOURCE = `
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
const SECRET = process.env.RELAY_SECRET || '';
function send(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }
http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') return send(res, 200, { ok: true });
    const a = Buffer.from(req.headers.authorization || '');
    const b = Buffer.from('Bearer ' + SECRET);
    if (!SECRET || req.method !== 'POST' || req.url !== '/soap' || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 401, { error: 'unauthorized' });
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 5e6) return send(res, 413, { error: 'too large' }); }
    const { url, envelope, pfx, senha, action } = JSON.parse(raw);
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.gov.br')) return send(res, 400, { error: 'host not allowed' });
    const ct = 'application/soap+xml; charset=utf-8' + (action ? '; action="' + action + '"' : '');
    const r = https.request(u, {
      method: 'POST', pfx: Buffer.from(pfx, 'base64'), passphrase: senha,
      // Cadeia ICP-Brasil não vem no Node; host restrito a *.gov.br
      rejectUnauthorized: false, timeout: 30000,
      headers: { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(envelope) },
    }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => send(res, 200, { status: resp.statusCode, body: d })); });
    r.on('timeout', () => r.destroy(new Error('timeout SEFAZ')));
    r.on('error', (e) => send(res, 502, { error: String(e.message || e) }));
    r.end(envelope);
  } catch (e) { send(res, 500, { error: String(e && e.message || e) }); }
}).listen(8080, '0.0.0.0');
`;
