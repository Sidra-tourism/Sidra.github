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

test('header displays user icon and Sign in or sign up label',()=>{
  assert.match(html,/class="account-icon"/);
  assert.match(ota,/Sign in or sign up/);
  assert.match(extraCss,/\.site-header \.account-icon/);
});

test('sign in modal uses correct English and does not submit credentials',()=>{
  for(const phrase of ['Username or email address','Password','Forgot password?','Create new account'])assert.ok(ota.includes(phrase),phrase);
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
