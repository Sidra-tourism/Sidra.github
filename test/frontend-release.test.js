import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/sidra-premium.css',import.meta.url),'utf8');
const ota=readFileSync(new URL('../public/sidra-ota.js',import.meta.url),'utf8');
const extraCss=readFileSync(new URL('../public/sidra-ota.css',import.meta.url),'utf8');

test('booking tabs are ordered Flights, Hotels, Cars, Holidays',()=>{
  const types=Array.from(ota.matchAll(/data-tab="(flights|hotels|cars|holidays)"/g),m=>m[1]);
  assert.deepEqual(types.slice(0,4),['flights','hotels','cars','holidays']);
  assert.match(ota,/aria-label="Hotels"/);
  assert.match(ota,/aria-label="Car rentals"/);
});

test('cars offer Rent a car and Transport modes and both build enquiry only',()=>{
  assert.match(ota,/Rent a car/);assert.match(ota,/Transport/);
  assert.match(ota,/data-car-mode="rent"/);assert.match(ota,/data-car-mode="transport"/);
  assert.match(ota,/Pickup location/);assert.match(ota,/Drop-off date/);
  assert.match(ota,/searchCarService/);
  assert.match(ota,/Car rental quotation request/);
  assert.match(ota,/Transport quotation request/);
  assert.doesNotMatch(ota,/fetch\(\s*['"]\/api\/(?:create-payment|confirm-booking)/);
});

test('header shows only Sign in beside the user icon',()=>{
  assert.match(html,/class="account-icon"/);
  assert.match(ota,/accountLabel\.textContent='Sign in'/);
  assert.match(extraCss,/\.site-header \.account-icon/);
});

test('sign in modal uses correct English and does not submit credentials',()=>{
  for(const phrase of ['Email / Username','Password','Forgot password?','Create a new account'])assert.ok(ota.includes(phrase),phrase);
  assert.match(ota,/showModal\(\)/);
  assert.match(ota,/preventDefault\(\)/);
  assert.match(ota,/Authentication is not activated/);
});

test('all search buttons display Search and preserve verification guardrails',()=>{
  assert.match(html,/>Search<\/button>/);
  assert.doesNotMatch(html,/>Search Verified Fares<\/button>/);
  assert.match(ota,/class="search-btn[^"]*">Search<\/button>/);
  assert.match(html,/validateFlightForm/);
  assert.match(html,/FLIGHT_PROVIDER_UNAVAILABLE/);
});

test('hotel guest, child ages and rooms controls persist with responsive layout',()=>{
  for(const id of ['hotelGuestTrigger','hotelGuestPanel','hotelAdults','hotelChildren','hotelRooms','hotelChildrenAges'])assert.ok(ota.includes(id));
  assert.match(extraCss,/@media\(max-width:600px\)/);
  assert.match(css,/\.hero/);
  assert.match(html,/sidra-ota\.css/);
  assert.match(html,/sidra-ota\.js/);
});

test('the live release contains no new authentication or payment backend',()=>{
  assert.doesNotMatch(ota,/localStorage|sessionStorage|create-payment|confirm-booking/);
  assert.doesNotMatch(ota,/https:\/\/.*supabase/);
  assert.doesNotMatch(ota,/innerHTML\s*\+=\s*[^'"]/);
});

test('footer account entry opens the preview dialog and release assets bypass stale mobile cache',()=>{
  assert.match(html,/href="#signin">My Sidra account<\/a>/);
  assert.match(ota,/footer a\[href="#signin"\]/);
  assert.match(html,/sidra-ota\.css\?v=20261116/);
  assert.match(html,/sidra-ota\.js\?v=20261116/);
});


test('sign-in layout presents exact customer wording in requested order',()=>{
  assert.match(html,/class="account-icon"[^>]*aria-label="Sign in"[^>]*title="Sign in"/);
  assert.doesNotMatch(html,/Sign in or sign up/);
  assert.match(ota,/accountLabel\.textContent='Sign in'/);
  const email=ota.indexOf('<label for="previewLoginIdentifier">Email / Username</label>');
  const password=ota.indexOf('<label for="previewLoginPassword">Password</label>');
  const signup=ota.indexOf('id="previewSignup">Create a new account</button>');
  const recovery=ota.indexOf('id="previewRecovery">Forgot password?</button>');
  const submit=ota.indexOf('class="ota-login-cta" type="submit">Sign in</button>');
  assert.ok(email >= 0 && email < password);
  assert.ok(password < signup && signup < recovery);
  assert.ok(recovery < submit, 'Links must appear below password and above sign-in action');
  assert.match(extraCss,/\.ota-login-links\s*\{display:flex;justify-content:space-between/);
  assert.match(ota,/Authentication is not activated/);
});

test('frontend revision versions the login assets for mobile cache refresh',()=>{
  assert.match(html,/sidra-ota\.js\?v=20261116b/);
  assert.match(html,/sidra-ota\.css\?v=20261116b/);
});
