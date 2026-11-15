import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/sidra-ota.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/sidra-ota.js',import.meta.url),'utf8');
test('OTA search categories use accessible icon-labelled tabs',()=>{
  for(const tab of ['flights','hotels','cars','holidays']) assert.match(html+js,new RegExp('data-tab="'+tab+'"'));
  assert.match(html+js,/role="tablist"/);
  assert.match(html+js,/aria-label="Hotels"/);
  assert.match(html+js,/aria-label="Holiday packages"/);
});
test('hotels provide property name, check-in checkout, adult child and room selectors',()=>{
  for(const id of ['hotelDestination','checkIn','checkOut','hotelGuestTrigger','hotelGuestPanel','hotelAdults','hotelChildren','hotelRooms','hotelChildrenAges','hotelSearchError']) assert.match(html+js,new RegExp('id="'+id+'"'));
  assert.match(html+js,/Hotel name or destination/);
  assert.match(html,/type="date"/);
  assert.match(js,/function validateHotelSearch/);
  assert.match(js,/guest\.adults.*guest\.children.*guest\.rooms/s);
  assert.match(js,/Hotel quotation request/);
  assert.doesNotMatch(html,/Guaranteed lowest price|Book now.*pay|From \$[0-9]+/i);
});
test('profile icon opens a keyboard-accessible sign in preview without transmitting secrets',()=>{
  assert.match(html,/class="account-icon"/);
  for(const id of ['quickSignIn','previewLoginIdentifier','previewLoginPassword']) assert.match(html+js,new RegExp('id="'+id+'"'));
  assert.match(html+js,/Username or email address/);
  assert.match(html+js,/autocomplete="current-password"/);
  assert.match(js,/showModal\(\)/);
  assert.match(js,/byId\('previewLoginPassword'\)\.value\s*=\s*''/);
  assert.doesNotMatch(js,/fetch\([^)]*password/i);
});
test('mobile layouts keep category tabs and room counter usable',()=>{
  assert.match(html,/sidra-ota.css/);
  assert.match(html,/sidra-ota.js/);
  assert.match(css,/@media\s*\(max-width:\s*600px\)/);
  assert.match(css,/hotel-guest-panel/);
  assert.match(css,/ota-tabs/);
});
