import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestThrottle } from '../lib/request-throttle.js';

function invoke(throttle, ip, headers = {}) {
  let status = 200;
  let nextCalled = false;
  const sentHeaders = {};
  let body;
  const req = { ip, headers, method: 'POST', get: name => headers[name.toLowerCase()] };
  const res = {
    status(code) { status = code; return this; },
    set(name, value) { sentHeaders[name] = value; return this; },
    json(value) { body = value; return this; }
  };
  throttle(req, res, () => { nextCalled = true; });
  return { status, nextCalled, sentHeaders, body };
}

test('limits excessive requests from a client and returns Retry-After', () => {
  let time = 0;
  const throttle = createRequestThrottle({ limit: 2, windowMs: 1000, now: () => time });
  assert.equal(invoke(throttle, 'client-one').nextCalled, true);
  assert.equal(invoke(throttle, 'client-one').nextCalled, true);
  const blocked = invoke(throttle, 'client-one');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.sentHeaders['Retry-After'], '1');
  time = 1001;
  assert.equal(invoke(throttle, 'client-one').nextCalled, true);
});

test('separates clients by trusted server-derived IP, not spoofable forwarded headers', () => {
  const throttle = createRequestThrottle({ limit: 1, windowMs: 5000 });
  assert.equal(invoke(throttle, '192.0.2.1', { 'x-forwarded-for': '203.0.113.1' }).nextCalled, true);
  assert.equal(invoke(throttle, '192.0.2.1', { 'x-forwarded-for': '203.0.113.2' }).status, 429);
  assert.equal(invoke(throttle, '192.0.2.2').nextCalled, true);
});

test('fails closed when throttle storage reaches capacity rather than creating unbounded entries', () => {
  const throttle = createRequestThrottle({ limit: 2, windowMs: 5000, maxEntries: 1 });
  assert.equal(invoke(throttle, 'one').nextCalled, true);
  const overCapacity = invoke(throttle, 'two');
  assert.equal(overCapacity.status, 503);
  assert.equal(overCapacity.nextCalled, false);
});
