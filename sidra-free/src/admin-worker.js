/** Private Sidra-only staff Worker. All routes fail closed until Cloudflare Access is configured. */
const STATES = Object.freeze(['requested', 'reviewing', 'quoted', 'awaiting_customer', 'closed']);
const CERT_TTL_MS = 5 * 60 * 1000;
const keyCache = new Map();

function answer(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  }});
}
function base64url(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
}
function decodeJson(value) { return JSON.parse(new TextDecoder().decode(base64url(value))); }
function validConfig(env) {
  return typeof env.ACCESS_TEAM_DOMAIN === 'string' &&
    /^[a-z\d](?:[a-z\d-]*[a-z\d])?\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN) &&
    typeof env.ACCESS_AUD === 'string' && env.ACCESS_AUD.length >= 8 &&
    typeof env.SIDRA_ADMIN_EMAIL === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SIDRA_ADMIN_EMAIL);
}
async function verifyOwner(request, env, networkFetch) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || token.length > 12000) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  let header; let claims;
  try { header = decodeJson(parts[0]); claims = decodeJson(parts[1]); } catch { return false; }
  if (!header || typeof header !== 'object' || Array.isArray(header) ||
      !claims || typeof claims !== 'object' || Array.isArray(claims)) return false;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256) return false;
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}` ||
    !audience.includes(env.ACCESS_AUD) ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    (typeof claims.nbf === 'number' && claims.nbf > now + 30) ||
    (typeof claims.iat === 'number' && claims.iat > now + 30) ||
    typeof claims.email !== 'string' ||
    claims.email.toLowerCase() !== env.SIDRA_ADMIN_EMAIL.toLowerCase()) return false;
  const cacheId = `${env.ACCESS_TEAM_DOMAIN}:${header.kid}`;
  let cached = keyCache.get(cacheId);
  if (!cached || cached.expires < Date.now()) {
    const response = await networkFetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, {
      redirect: 'error', headers: { accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Cloudflare Access certificates unavailable');
    const certs = await response.json();
    const jwk = Array.isArray(certs.keys) && certs.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    cached = { key, expires: Date.now() + CERT_TTL_MS };
    keyCache.set(cacheId, cached);
  }
  const signature = base64url(parts[2]);
  const message = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', cached.key, signature, message);
}
function isState(value) { return STATES.includes(value); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }

export async function handleAdminRequest(request, env = {}, networkFetch = fetch) {
  const url = new URL(request.url);
  if (!validConfig(env)) return answer({ error: 'Private admin access is not configured' }, 503);
  let authenticated;
  try { authenticated = await verifyOwner(request, env, networkFetch); }
  catch { return answer({ error: 'Identity verification is unavailable' }, 503); }
  if (!authenticated) return answer({ error: 'Unauthorized' }, 401);

  if (url.pathname === '/api/me' && request.method === 'GET') {
    return answer({ role: 'owner', email: env.SIDRA_ADMIN_EMAIL.toLowerCase() });
  }
  if (url.pathname.startsWith('/api/')) {
    if (!env.SIDRA_DB) return answer({ error: 'Sidra database not configured' }, 503);
    if (url.pathname === '/api/enquiries' && request.method === 'GET') {
      const status = url.searchParams.get('status');
      if (status !== null && !isState(status)) return answer({ error: 'Invalid status' }, 400);
      try {
        const statement = status
          ? env.SIDRA_DB.prepare('SELECT id, service, full_name, email, phone, origin, destination, travel_date, travelers, notes, status, created_at FROM sidra_enquiries WHERE status = ? ORDER BY created_at DESC LIMIT 50').bind(status)
          : env.SIDRA_DB.prepare('SELECT id, service, full_name, email, phone, origin, destination, travel_date, travelers, notes, status, created_at FROM sidra_enquiries ORDER BY created_at DESC LIMIT 50');
        const rows = await statement.all();
        return answer({ enquiries: rows.results || [], limit: 50 });
      } catch { return answer({ error: 'Database unavailable' }, 503); }
    }
    const match = url.pathname.match(/^\/api\/enquiries\/([0-9a-f-]{36})$/i);
    if (match && request.method === 'PATCH') {
      if (!isUuid(match[1])) return answer({ error: 'Invalid enquiry reference' }, 400);
      if (request.headers.get('origin') !== url.origin) return answer({ error: 'Origin rejected' }, 403);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return answer({ error: 'JSON required' }, 415);
      let body;
      try {
        const raw = await request.text();
        if (raw.length > 1024) return answer({ error: 'Request too large' }, 413);
        body = JSON.parse(raw);
      } catch { return answer({ error: 'Invalid JSON' }, 400); }
      if (!body || Array.isArray(body) || typeof body !== 'object' ||
          Object.keys(body).sort().join(',') !== 'expectedStatus,status' ||
          !isState(body.status) || !isState(body.expectedStatus) || body.status === body.expectedStatus)
        return answer({ error: 'Invalid status change' }, 400);
      try {
        const results = await env.SIDRA_DB.batch([
          env.SIDRA_DB.prepare('UPDATE sidra_enquiries SET status = ? WHERE id = ? AND status = ?').bind(body.status, match[1], body.expectedStatus),
          env.SIDRA_DB.prepare('INSERT INTO sidra_enquiry_audit (id, enquiry_id, actor_email, old_status, new_status) SELECT ?, ?, ?, ?, ? WHERE changes() = 1')
            .bind(crypto.randomUUID(), match[1], env.SIDRA_ADMIN_EMAIL.toLowerCase(), body.expectedStatus, body.status)
        ]);
        if (results?.[0]?.meta?.changes !== 1) return answer({ error: 'Enquiry changed. Refresh and retry.' }, 409);
        if (results?.[1]?.meta?.changes !== 1) return answer({ error: 'Audit confirmation unavailable. Refresh and contact an administrator.' }, 503);
        return answer({ id: match[1], status: body.status, audited: true });
      } catch { return answer({ error: 'Status update unavailable' }, 503); }
    }
    return answer({ error: 'Not found' }, 404);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return answer({ error: 'Method not allowed' }, 405);
  if (!env.ASSETS) return answer({ error: 'Admin assets not configured' }, 503);
  const asset = await env.ASSETS.fetch(request);
  const h = new Headers(asset.headers);
  h.set('cache-control', 'no-store');
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'no-referrer');
  h.set('x-frame-options', 'DENY');
  h.set('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  return new Response(asset.body, { status: asset.status, headers: h });
}
export default { fetch(request, env) { return handleAdminRequest(request, env); } };