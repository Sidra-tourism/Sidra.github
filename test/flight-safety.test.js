import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFlightSearch } from '../flight-policy.js';

const valid = Object.freeze({
  fromCountry: 'Qatar', from: 'DOH', toCountry: 'Sri Lanka', to: 'CMB',
  departureDate: '2026-12-15', tripType: 'oneway', adults: '1', children: '0'
});
const now = '2026-11-15';

test('departure AND arrival countries and airport codes are mandatory', () => {
  for (const key of ['fromCountry', 'from', 'toCountry', 'to', 'departureDate']) {
    assert.throws(() => validateFlightSearch({ ...valid, [key]: '' }, now), /required/i, key);
  }
  assert.throws(() => validateFlightSearch({}, now), /required/i);
});

test('airport codes must be valid and distinct', () => {
  assert.throws(() => validateFlightSearch({ ...valid, from: 'Doha' }, now), /airport|iata/i);
  assert.throws(() => validateFlightSearch({ ...valid, from: 'DOH', to: 'DOH' }, now), /different/i);
  assert.throws(() => validateFlightSearch({ ...valid, to: '12!' }, now), /airport|iata/i);
});

test('round trips require a valid return date on or after departure', () => {
  assert.throws(() => validateFlightSearch({ ...valid, tripType: 'roundtrip', returnDate: '' }, now), /return date/i);
  assert.throws(() => validateFlightSearch({ ...valid, tripType: 'roundtrip', returnDate: '2026-12-14' }, now), /return date/i);
  assert.throws(() => validateFlightSearch({ ...valid, tripType: 'roundtrip', returnDate: '2026-13-40' }, now), /return date/i);
});

test('past and impossible departure dates cannot be used', () => {
  assert.throws(() => validateFlightSearch({ ...valid, departureDate: '2026-02-30' }, now), /departure date/i);
  assert.throws(() => validateFlightSearch({ ...valid, departureDate: '2026-11-14' }, now), /departure date/i);
});

test('valid route normalizes inputs without supplying any prices', () => {
  const parsed = validateFlightSearch({ ...valid, from: ' doh ', to: ' cmb ', fromCountry: ' Qatar ' }, now);
  assert.equal(parsed.from, 'DOH');
  assert.equal(parsed.to, 'CMB');
  assert.equal(parsed.fromCountry, 'Qatar');
  assert.equal(parsed.departureDate, '2026-12-15');
  assert.equal('price' in parsed, false);
});

test('passenger counts must be valid nonnegative integers within capacity', () => {
  assert.throws(() => validateFlightSearch({ ...valid, adults: '0' }, now), /adult/i);
  assert.throws(() => validateFlightSearch({ ...valid, children: 'abc' }, now), /children|passenger/i);
  assert.throws(() => validateFlightSearch({ ...valid, adults: '10' }, now), /passenger/i);
});

test('public page requires customer-selected routes; no default route or demo fare', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const id of ['fromCountry', 'fromCity', 'toCountry', 'toCity', 'departureDate']) {
    assert.match(html, new RegExp('<input[^>]+id="' + id + '"[^>]+required'));
  }
  assert.doesNotMatch(html, /From\s*\$\s*\d+/i);
  assert.doesNotMatch(html, /\|\|\s*['"]DOH['"]/);
  assert.doesNotMatch(html, /\|\|\s*['"]LHR['"]/);
  assert.doesNotMatch(html, /addMultiRow\(['"]DOH['"]/);
  assert.match(html, /validateFlightForm/);
});

test('server must not provide sample flights or enable unpaid ticket confirmations', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /sampleFlights|getFallbackFlights|Demo Engine|ENABLE_LIVE_BOOKINGS/);
  assert.match(server, /validateFlightSearch/);
  assert.match(server, /FLIGHT_PROVIDER_UNAVAILABLE/);
  assert.doesNotMatch(server, /status:\s*['"]confirmed['"]/);
});
