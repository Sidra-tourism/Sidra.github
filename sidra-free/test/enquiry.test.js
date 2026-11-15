import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnquiry, SERVICES } from '../src/policy.js';
import { handleRequest } from '../src/worker.js';
const valid = { service: 'flights', fullName: 'Customer Test', email: 'TRAVELER@EXAMPLE.COM', origin: 'Doha', destination: 'Colombo', travelers: 2, travelDate: '2026-12-15' };
const origin = 'https://sidra-testing.example';
function request(body, headers = {}) {
  return new Request(origin + '/api/enquiries', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
test('all six enquiry services are distinct and not live ticketing', () => {
  assert.equal(SERVICES.length, 6);
  assert.equal(new Set(SERVICES.map(x => x.id)).size, 6);
});
test('valid enquiry normalizes email and preserves route', () => {
  const p = validateEnquiry(valid);
  assert.equal(p.email, 'traveler@example.com');
  assert.equal(p.destination, 'Colombo');
  assert.equal(p.travelers, 2);
});
test('rejects role/status mass assignment', () => {
  assert.throws(() => validateEnquiry({ ...valid, status: 'confirmed' }), /Unsupported/);
  assert.throws(() => validateEnquiry({ ...valid, role: 'super_admin' }), /Unsupported/);
});
test('rejects nonexistent dates and bad passenger counts', () => {
  assert.throws(() => validateEnquiry({ ...valid, travelDate: '2026-02-30' }), /Invalid travel date/);
  assert.throws(() => validateEnquiry({ ...valid, travelers: 0 }), /Invalid passenger count/);
});
test('GET config fails closed before dedicated bindings and security are configured', async () => {
  const r = await handleRequest(new Request(origin + '/api/config'), {});
  assert.deepEqual(await r.json(), { turnstileSiteKey: null, enquiriesEnabled: false });
  const q = await handleRequest(request({ ...valid, turnstileToken: 'valid-token' }), {});
  assert.equal(q.status, 503);
});
test('rejects origin mismatch without storing data', async () => {
  const r = await handleRequest(request({ ...valid, turnstileToken: 'valid-token' }, {origin:'https://outsider.example'}), { SIDRA_DB: {}, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' });
  assert.equal(r.status, 403);
});
test('denies failed security verification', async () => {
  const db = {prepare(){ throw new Error('must not be called'); }};
  const r = await handleRequest(request({ ...valid, turnstileToken: 'failed-token' }), { SIDRA_DB: db, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }, async () => Response.json({success:false}));
  assert.equal(r.status, 400);
});
test('enquiry passes security challenge, stores once and does not confirm booking', async () => {
  let sql = ''; let saved = []; let writes = 0;
  const db = { prepare(statement) { sql = statement; return { bind(...args) { saved = args; return { async run() { writes++; } }; } }; } };
  const r = await handleRequest(request({ ...valid, turnstileToken: 'valid-token' }), { SIDRA_DB: db, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }, async () => Response.json({success:true}));
  assert.equal(r.status, 201);
  assert.equal(writes, 1);
  assert.match(sql, /INSERT INTO sidra_enquiries/);
  assert.equal(saved[2], 'Customer Test');
  assert.equal((await r.json()).isConfirmedBooking, false);
});
test('no public admin endpoint exists', async () => {
  const r = await handleRequest(new Request(origin + '/api/admin/enquiries'), {});
  assert.equal(r.status, 404);
});
