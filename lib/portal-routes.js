import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { can, canAccessService, parseRequest, validateStatus, SERVICES } from './portal-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function settings() {
  const url = process.env.SIDRA_SUPABASE_URL;
  const anon = process.env.SIDRA_SUPABASE_ANON_KEY;
  const secret = process.env.SIDRA_SUPABASE_SERVICE_ROLE_KEY;
  let origin;
  try { if (url) { const value = new URL(url); if (value.protocol !== 'https:') throw new Error(); origin = value.origin; } } catch { return null; }
  return origin && anon && secret ? { origin, anon, secret } : null;
}
async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000), redirect: 'error' });
  } catch { throw new ApiError(502, 'Identity or data provider unavailable'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status === 401 ? 401 : 502, response.status === 401 ? 'Session expired' : 'Identity or data provider rejected the request');
  return data;
}
function db(config, resource, options = {}) {
  return requestJson(`${config.origin}/rest/v1/${resource}`, {
    method: options.method || 'GET',
    headers: { apikey: config.secret, authorization: `Bearer ${config.secret}`, 'content-type': 'application/json', prefer: options.upsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation' },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
}
async function authenticate(req, config) {
  const match = /^Bearer ([\w.-]+)$/.exec(req.get('authorization') || '');
  if (!match || match[1].length > 4096) throw new ApiError(401, 'Sign in required');
  const user = await requestJson(`${config.origin}/auth/v1/user`, {
    headers: { apikey: config.anon, authorization: `Bearer ${match[1]}` }
  });
  if (!UUID.test(user?.id || '')) throw new ApiError(401, 'Invalid user session');
  const roles = await db(config, `sidra_user_roles?select=role&user_id=eq.${user.id}&limit=1`);
  const role = roles?.[0]?.role || 'customer';
  return { id: user.id, email: user.email || '', role };
}
function requirePermission(actor, permission) {
  if (!can(actor.role, permission)) throw new ApiError(403, 'Insufficient permission');
}
function parseUuid(value) {
  if (!UUID.test(value || '')) throw new ApiError(400, 'Invalid record identifier');
  return value;
}
function sendError(res, e) {
  const code = e instanceof ApiError ? e.code : e instanceof SyntaxError ? 400 : 400;
  res.status(code).json({ error: e instanceof ApiError ? e.message : e.message?.startsWith('Invalid') || e.message?.startsWith('Unexpected') ? e.message : 'Invalid request' });
}
function safe(handler) { return (req, res) => Promise.resolve(handler(req, res)).catch(e => sendError(res, e)); }
export function registerPortalRoutes(app) {
  app.get('/portal', (req, res) => {
    const config = settings();
    const connect = config ? ` ${config.origin}` : '';
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'${connect}; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`
    });
    res.sendFile(path.join(root, 'public', 'portal.html'));
  });
  app.get('/api/portal/config', (req, res) => {
    const config = settings();
    res.set('Cache-Control', 'no-store').json({ configured: !!config, supabaseUrl: config?.origin || null, supabaseAnonKey: config?.anon || null, customerSignupEnabled: process.env.SIDRA_ALLOW_CUSTOMER_SIGNUP === 'true' });
  });
  app.get('/api/portal/services', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ services: SERVICES });
  });
  app.use('/api/portal', safe(async (req, res, next) => {
    const config = settings();
    if (!config) throw new ApiError(503, 'Portal authentication is awaiting Sidra configuration');
    req.sidraConfig = config;
    req.sidraActor = await authenticate(req, config);
    next();
  }));
  app.get('/api/portal/me', safe(async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ user: req.sidraActor });
  }));
  app.get('/api/portal/requests', safe(async (req, res) => {
    const { id, role } = req.sidraActor;
    if (!(can(role, 'view_own_requests') || can(role, 'view_requests'))) throw new ApiError(403, 'Insufficient permission');
    const ownFilter = role === 'customer' ? `&user_id=eq.${id}` : '';
    let list = await db(req.sidraConfig, `sidra_service_requests?select=id,user_id,service,summary,details,status,created_at&order=created_at.desc&limit=100${ownFilter}`);
    if (role !== 'customer') list = list.filter(item => canAccessService(role, item.service));
    res.set('Cache-Control', 'no-store').json({ requests: list });
  }));
  app.post('/api/portal/requests', safe(async (req, res) => {
    requirePermission(req.sidraActor, 'create_request');
    const data = parseRequest(req.body);
    const created = await db(req.sidraConfig, 'sidra_service_requests', { method: 'POST', body: { user_id: req.sidraActor.id, ...data, status: 'requested' } });
    res.status(201).json({ request: created?.[0] });
  }));
  app.get('/api/portal/admin/overview', safe(async (req, res) => {
    requirePermission(req.sidraActor, 'view_requests');
    const list = await db(req.sidraConfig, 'sidra_service_requests?select=id,service,status&order=created_at.desc&limit=100');
    const scope = list.filter(item => canAccessService(req.sidraActor.role, item.service));
    const statusCounts = scope.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    res.set('Cache-Control', 'no-store').json({ recentRequests: scope.length, window: 'latest_100', statusCounts });
  }));
  app.patch('/api/portal/admin/requests/:id/status', safe(async (req, res) => {
    requirePermission(req.sidraActor, 'manage_requests');
    const id = parseUuid(req.params.id);
    const status = validateStatus(req.body?.status);
    const existing = await db(req.sidraConfig, `sidra_service_requests?select=id,service,status&id=eq.${id}&limit=1`);
    if (!existing.length) throw new ApiError(404, 'Request not found');
    if (!canAccessService(req.sidraActor.role, existing[0].service)) throw new ApiError(403, 'Department access denied');
    const result = await db(req.sidraConfig, `sidra_service_requests?id=eq.${id}`, { method: 'PATCH', body: { status } });
    await db(req.sidraConfig, 'sidra_audit_events', { method: 'POST', body: { actor_user_id: req.sidraActor.id, action: 'request_status', target_id: id, detail: { from: existing[0].status, to: status } } });
    res.json({ request: result?.[0] });
  }));
  app.get('/api/portal/admin/users', safe(async (req, res) => {
    requirePermission(req.sidraActor, 'view_users');
    const [roles, profiles] = await Promise.all([
      db(req.sidraConfig, 'sidra_user_roles?select=user_id,role&limit=100'),
      db(req.sidraConfig, 'sidra_profiles?select=id,display_name,created_at&limit=100')
    ]);
    res.set('Cache-Control', 'no-store').json({ users: profiles.map(p => ({ ...p, role: roles.find(r => r.user_id === p.id)?.role || 'customer' })) });
  }));
  app.patch('/api/portal/admin/users/:id/role', safe(async (req, res) => {
    requirePermission(req.sidraActor, 'manage_roles');
    const id = parseUuid(req.params.id);
    const role = req.body?.role;
    if (!['customer', 'support', 'ticketing', 'reservations', 'finance', 'admin'].includes(role)) throw new ApiError(400, 'Invalid assignable role');
    if (id === req.sidraActor.id) throw new ApiError(403, 'Self role changes are not permitted');
    const existing = await db(req.sidraConfig, `sidra_user_roles?select=role&user_id=eq.${id}&limit=1`);
    if (existing[0]?.role === 'super_admin') throw new ApiError(403, 'Owner role cannot be changed here');
    const profiles = await db(req.sidraConfig, `sidra_profiles?select=id&id=eq.${id}&limit=1`);
    if (!profiles.length) throw new ApiError(404, 'User profile not found');
    await db(req.sidraConfig, 'sidra_user_roles?on_conflict=user_id', { method: 'POST', body: { user_id: id, role, assigned_by: req.sidraActor.id }, upsert: true });
    await db(req.sidraConfig, 'sidra_audit_events', { method: 'POST', body: { actor_user_id: req.sidraActor.id, action: 'role_change', target_id: id, detail: { from: existing[0]?.role || 'customer', to: role } } });
    res.json({ userId: id, role });
  }));
}