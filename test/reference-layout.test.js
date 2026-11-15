import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/sidra-editorial.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/sidra-editorial.js',import.meta.url),'utf8');
const ota=readFileSync(new URL('../public/sidra-ota.js',import.meta.url),'utf8');

test('reference-inspired page uses the requested compact destination-search layout',()=>{
  assert.match(html,/<body class="editorial-layout">/);
  assert.match(html,/class="site-header"/);
  assert.match(html,/Shop travel/);
  assert.match(html,/class="site-search"/);
  assert.match(html,/sidra-editorial\.css\?v=20261116/);
  assert.match(html,/sidra-editorial\.js\?v=20261116/);
  assert.match(css,/\.editorial-layout \.hero/);
  assert.match(css,/\.site-search \.ota-tabs/);
});

test('original Sidra brand and booking categories are preserved and expanded',()=>{
  assert.match(html,/Sidra Tourism Logo/);
  const types=Array.from(ota.matchAll(/data-tab="(flights|hotels|cars|holidays|experiences|cruises)"/g),m=>m[1]);
  assert.deepEqual(types.slice(0,6),['flights','hotels','cars','holidays','experiences','cruises']);
  assert.match(ota,/Rent a car/);
  assert.match(ota,/Transport/);
  assert.match(html,/Sign in or sign up/);
});

test('below-the-fold layout has promotion, swipeable travel cards, benefits, stays and holiday packages',()=>{
  for(const id of ['travel-highlights','stay-inspiration','why-sidra','vacation-stays','package-ideas','services','about','contact']){
    assert.match(html,new RegExp('id="'+id+'"'),id);
  }
  assert.match(html,/class="travel-promo"/);
  assert.match(html,/class="inspiration-card"/);
  assert.match(html,/class="stay-type-card"/);
  assert.match(html,/class="package-card"/);
  assert.match(html,/data-scroll-target/);
  assert.match(js,/data-scroll-target/);
});

test('destination package tabs are interactive and do not fabricate inventory',()=>{
  assert.match(html,/data-package-destination="sri-lanka"/);
  assert.match(html,/data-package-destination="maldives"/);
  assert.match(js,/data-package-destination/);
  assert.doesNotMatch(html,/Save 30%|Save 25%|(?:Was|Now) \$/);
  assert.doesNotMatch(html,/\b(?:Expedia|One Key|Bundle & Save)\b/i);
});

test('verified quote safety and real search fields remain unchanged',()=>{
  for(const id of ['fromCountry','fromCity','toCountry','toCity','departureDate']){
    assert.match(html,new RegExp('<input[^>]+id="'+id+'"[^>]+required'));
  }
  assert.match(html,/validateFlightForm/);
  assert.match(html,/FLIGHT_PROVIDER_UNAVAILABLE/);
  assert.match(js,/enquiry|quote/i);
  assert.doesNotMatch(js,/fetch\([^)]*\/api\/(?:create-payment|confirm-booking)/i);
});

test('responsive visual system supports a narrow phone and accessible actions',()=>{
  assert.match(css,/@media\s*\(max-width:\s*700px\)/);
  assert.match(css,/scroll-snap-type/);
  assert.match(css,/\.package-tabs/);
  assert.match(html,/aria-label="Travel stays"/);
  assert.match(html,/aria-label="Holiday destinations"/);
  assert.match(js,/aria-pressed/);
});
