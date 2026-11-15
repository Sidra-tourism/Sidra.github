import { SERVICES, validateEnquiry } from './policy.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
  });
}
export async function handleRequest(request, env = {}, networkFetch = fetch) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok', mode: 'manual_enquiries_only' });
  if (request.method === 'GET' && url.pathname === '/api/services') return json({ services: SERVICES, liveTicketing: false, paymentsEnabled: false });
  if (request.method === 'GET' && url.pathname === '/api/config') {
    return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null, enquiriesEnabled: Boolean(env.SIDRA_DB && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) });
  }
  if (url.pathname === '/api/enquiries') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!env.SIDRA_DB || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return json({ error: 'Enquiry service not configured' }, 503);
    if (request.headers.get('origin') !== url.origin) return json({ error: 'Origin rejected' }, 403);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return json({ error: 'JSON required' }, 415);
    if (Number(request.headers.get('content-length') || 0) > 8192) return json({ error: 'Request too large' }, 413);
    let body;
    try {
      const text = await request.text();
      if (text.length > 8192) return json({ error: 'Request too large' }, 413);
      body = JSON.parse(text);
    } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid enquiry' }, 400);
    const { turnstileToken, ...fields } = body;
    let enquiry;
    try { enquiry = validateEnquiry(fields); } catch (e) { return json({ error: e.message }, 400); }
    if (typeof turnstileToken !== 'string' || turnstileToken.length < 5 || turnstileToken.length > 2048) return json({ error: 'Security challenge required' }, 400);
    const parameters = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: turnstileToken });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) parameters.set('remoteip', ip);
    let result;
    try {
      const verification = await networkFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: parameters.toString(), redirect: 'error'
      });
      if (!verification.ok) throw new Error('verification unavailable');
      result = await verification.json();
    } catch { return json({ error: 'Verification unavailable. Try again.' }, 503); }
    if (!result?.success) return json({ error: 'Security verification failed' }, 400);
    const id = crypto.randomUUID();
    try {
      await env.SIDRA_DB.prepare("INSERT INTO sidra_enquiries (id, service, full_name, email, phone, origin, destination, travel_date, travelers, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')").bind(
        id, enquiry.service, enquiry.fullName, enquiry.email, enquiry.phone, enquiry.origin,
        enquiry.destination, enquiry.travelDate, enquiry.travelers, enquiry.notes
      ).run();
    } catch { return json({ error: 'Enquiry could not be stored. Please contact our office.' }, 503); }
    return json({ requestId: id, status: 'received_for_review', isConfirmedBooking: false }, 201);
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return json({ error: 'Static assets not configured' }, 503);
}
export default { fetch: handleRequest };
