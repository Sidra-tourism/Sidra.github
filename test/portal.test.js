import test from 'node:test';
import assert from 'node:assert/strict';
import { can, parseRequest, canAccessService, validateStatus, SERVICES, buildServerHeaders } from '../lib/portal-core.js';

test('unrecognized role never receives administrative rights', () => {
  assert.equal(can('customer', 'manage_roles'), false);
  assert.equal(can('made_up_role', 'view_requests'), false);
  assert.equal(can('super_admin', 'manage_roles'), true);
});
test('staff department can access only its assigned service requests', () => {
  assert.equal(canAccessService('ticketing', 'flights'), true);
  assert.equal(canAccessService('ticketing', 'hotels'), false);
  assert.equal(canAccessService('reservations', 'cars'), true);
  assert.equal(canAccessService('support', 'flights'), true);
});
test('service requests reject invalid and sensitive-input fields', () => {
  assert.throws(() => parseRequest({ service: 'unknown', summary: 'Trip' }), /service/i);
  assert.throws(() => parseRequest({ service: 'flights', summary: '' }), /summary/i);
  assert.throws(() => parseRequest({ service: 'flights', summary: 'A flight', passportNumber: 'AB12345' }), /fields/i);
});
test('service requests normalize and constrain safely', () => {
  assert.deepEqual(parseRequest({ service: 'flights', summary: '  Doha to London  ', details: '  December outbound ' }), { service: 'flights', summary: 'Doha to London', details: 'December outbound' });
  assert.throws(() => parseRequest({ service: 'flights', summary: 'X'.repeat(201) }), /summary/i);
});
test('request statuses never indicate ticket issuance or payment confirmation', () => {
  assert.equal(validateStatus('reviewing'), 'reviewing');
  assert.throws(() => validateStatus('ticketed'), /status/i);
  assert.throws(() => validateStatus('paid'), /status/i);
});
test('service catalogue states unconfigured automation rather than promising live API access', () => {
  const flight = SERVICES.find(x => x.id === 'flights');
  assert.equal(flight.live, false);
  assert.equal(flight.integration, 'pending_supplier_access');
});

test('new opaque Supabase secret keys are never placed in Bearer headers', () => {
  const headers = buildServerHeaders('sb_secret_test123', false);
  assert.equal(headers.apikey, 'sb_secret_test123');
  assert.equal(Object.hasOwn(headers, 'authorization'), false);
  assert.equal(headers.prefer, 'return=representation');
});
test('legacy JWT service role preserves compatibility while secrets remain server-only', () => {
  const headers = buildServerHeaders('legacy-jwt', true);
  assert.equal(headers.authorization, 'Bearer legacy-jwt');
  assert.equal(headers.prefer, 'resolution=merge-duplicates,return=representation');
});