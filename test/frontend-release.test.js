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

test('header renders one Sign In label and leaves native account navigation intact',()=>{
  const icon=html.match(/<a class="account-icon"[^>]*>[\\s\\S]*?<\\/a>/)?.[0];
  assert.ok(icon);
  assert.match(icon,/class="account-text">Sign In<\\/span>/);
  assert.equal((icon.match(/class="account-text"/g)||[]).length,1);
  assert.doesNotMatch(ota,/icon\\.append\\(accountLabel\\)|icon\\.addEventListener\\(['"]click['"]/);
  assert.match(extraCss,/\\.site-header \\.account-icon/);
});


test('sign-in destination presents Customer and Admin choices without activating authentication',()=>{
  const choice=readFileSync(new URL('../public/signin.html',import.meta.url),'utf8');
  assert.match(choice,/Customer Sign In/);
  assert.match(choice,/Admin Sign In/);
  assert.match(choice,/Email \\/ Username/);
  assert.match(choice,/Forgot password\\?/);
  assert.match(choice,/Create a new account/);
  assert.match(choice,/Customer account sign-in is not yet activated/);
  assert.doesNotMatch(ota,/quickSignIn|previewLoginForm|showModal\\(/);
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

test('footer account entry opens the sign-in page and release assets bypass stale mobile cache',()=>{
  assert.match(html,/href="\/signin\.html">My Sidra account<\/a>/);
  assert.match(html,/class="account-icon" href="\/signin\.html"/);
  assert.match(html,/sidra-ota\.css\?v=20261116/);
  assert.match(html,/sidra-ota\.js\?v=20261116/);
});


test('sign-in route shows customer entry first and owner-admin entry after',()=>{
  const choice=readFileSync(new URL('../public/signin.html',import.meta.url),'utf8');
  assert.match(html,/class="account-icon"[^>]*aria-label="Sign In"[^>]*title="Sign In"/);
  assert.match(html,/class="account-icon" href="\\/signin\\.html"/);
  assert.ok(choice.indexOf('id="customerSignInCard"')<choice.indexOf('id="adminSignInCard"'));
  assert.match(choice,/id="adminSignInButton"[^>]*href="https:\\/\\/admin\\.sidra-tourism\\.com\\//);
  assert.doesNotMatch(ota,/icon\\.append\\(accountLabel\\)/);
});


test('frontend revision versions the login assets for mobile cache refresh',()=>{
  assert.match(html,/sidra-ota\.js\?v=20261116b/);
  assert.match(html,/sidra-ota\.css\?v=20261116b/);
});
