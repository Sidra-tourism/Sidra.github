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


test('inline client script is syntactically valid', async () => {
  const { Script } = await import('node:vm');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source, 'Expected inline flight form script');
  assert.doesNotThrow(() => new Script(source));
});

test('client form does not request fares until countries, airports and date are entered', async () => {
  const { runInNewContext } = await import('node:vm');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  class Element {
    constructor(id='') {
      this.id=id; this.value=''; this.children=[]; this.style={display:''};
      this.listeners={};this.textContent='';this.className='';this.min='';
      this.classList={toggle(){}};this.dataset={};
    }
    appendChild(el){this.children.push(el);return el;}
    append(...els){this.children.push(...els);}
    replaceChildren(...els){this.children=[...els];}
    addEventListener(name,fn){this.listeners[name]=fn;}
    focus(){this.focused=true;}
    scrollIntoView(){}
    setAttribute(){}
    querySelectorAll(){return this.children.filter(x=>x.tag==='input');}
  }
  const els=new Map();
  const get=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id);};
  let networkCalls=0;
  const sandbox={
    URLSearchParams,
    document:{
      getElementById:get,
      createElement(tag){const el=new Element();el.tag=tag;return el;},
      querySelectorAll(selector){
        return selector==='.multi-row'?get('multiRows').children.filter(x=>x.className==='multi-row'):[];
      },
      addEventListener(){}
    },
    window:{open(){throw Error('must not open a payment or booking window')}},
    fetch:async ()=>{networkCalls++;return {status:503,ok:false,json:async()=>({
      code:'FLIGHT_PROVIDER_UNAVAILABLE',message:'No authenticated live provider',results:[]
    })};}
  };
  const run=runInNewContext;
  run(source,sandbox);
  await run('searchFlights()',sandbox);
  assert.equal(networkCalls,0);
  assert.match(get('searchMessage').textContent,/departure country/i);
  get('fromCountry').value='Qatar';get('fromCity').value='DOH';
  await run('searchFlights()',sandbox);
  assert.equal(networkCalls,0);
  get('toCountry').value='Kazakhstan';get('toCity').value='ALA';
  get('departureDate').value='2099-01-01';
  await run('searchFlights()',sandbox);
  assert.equal(networkCalls,1);
  const resultText=get('resultBox').children.map(e=>e.textContent).join(' ');
  assert.match(resultText,/No authenticated live provider/);
  assert.doesNotMatch(resultText,/\$\d+|USD\s*\d+/);
  run("setTrip('roundtrip')",sandbox);
  await run('searchFlights()',sandbox);
  assert.equal(networkCalls,1, 'round-trip cannot omit return date');
  assert.match(get('searchMessage').textContent,/return date/i);
});
