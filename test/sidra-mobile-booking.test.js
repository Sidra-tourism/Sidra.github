import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addLocalDays, localDateISO, formatTravelDate, validTravelRange} from '../public/sidra-date-utils.mjs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/sidra-mobile-booking.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/sidra-mobile-booking.css',import.meta.url),'utf8');
const ota=readFileSync(new URL('../public/sidra-ota.js',import.meta.url),'utf8');

test('real local calendar dates use local time instead of fixed demonstration dates',()=>{
  const d=new Date(2026,10,16,20,30);
  assert.equal(localDateISO(d),'2026-11-16');
  assert.equal(addLocalDays('2026-11-16',1),'2026-11-17');
  assert.equal(addLocalDays('2026-12-31',1),'2027-01-01');
  assert.match(formatTravelDate('2026-11-16'),/Nov 16/);
  assert.equal(validTravelRange('2026-11-16','2026-11-18','2026-11-16'),true);
  assert.equal(validTravelRange('2026-11-19','2026-11-18','2026-11-16'),false);
  assert.equal(validTravelRange('2026-11-12','2026-11-18','2026-11-16'),false);
  assert.equal(validTravelRange('2026-02-30','2026-03-02','2026-02-01'),false);
});

test('customer sees readable airport names rather than being asked for airport code',()=>{
  assert.match(html,/label for="fromCity">Leaving from/);
  assert.match(html,/label for="toCity">Going to/);
  assert.doesNotMatch(html,/Departure airport \(IATA code\)|Destination airport \(IATA code\)/);
  assert.match(html,/id="fromCountry"[^>]+required/);
  assert.match(html,/id="toCountry"[^>]+required/);
  assert.match(html,/validateFlightForm/);
  assert.match(js,/selectAirport/);
  assert.match(js,/airport\[2\]/); // IATA remains internal
});

test('mobile search retains all six icon categories, room guest and car selectors',()=>{
  const types=Array.from(ota.matchAll(/data-tab="(flights|hotels|cars|holidays|experiences|cruises)"/g),m=>m[1]);
  assert.deepEqual(types.slice(0,6),['flights','hotels','cars','holidays','experiences','cruises']);
  assert.match(js,/hotelGuestTrigger/);
  assert.match(js,/data-car-mode/);
  assert.match(css,/scroll-snap-type:\s*x mandatory/);
  assert.match(css,/\.ota-tabs/);
});

test('flight trip type and cabin selector have human friendly date summaries',()=>{
  assert.match(js,/sidraFlightCabin/);
  assert.match(js,/flightDatesSummary/);
  assert.match(js,/data-sidra-trip/);
  assert.match(js,/Roundtrip/);
  assert.match(js,/One-way/);
  assert.match(js,/Multi-city/);
  assert.match(js,/departureDate/);
  assert.match(js,/returnDate/);
  assert.match(js,/formatTravelDate/);
});

test('car rental supports distinct drop-off and pickup times',()=>{
  assert.match(js,/sidraCarDropoffLocation/);
  assert.match(js,/sidraCarDropoffTime/);
  assert.match(js,/Same as pickup/);
  assert.match(js,/data-car-mode/);
  assert.match(js,/Rental cars/);
  assert.match(js,/Airport transportation/);
  assert.match(ota,/Car rental quotation request/);
});

test('packages can combine flights hotels and cars while remaining quotation only',()=>{
  for(const field of ['sidraPackageFrom','sidraPackageTo','sidraPackageDepart','sidraPackageReturn','sidraPackageStay','sidraPackageTravelers','sidraPackageCabin','sidraPackageRooms'])assert.match(js,new RegExp(field));
  assert.match(js,/data-sidra-package-component/);
  assert.match(js,/Stay added/);
  assert.match(js,/Flight added/);
  assert.match(js,/Car/);
  assert.match(js,/Holiday package quotation request/);
});

test('experiences and cruises have reference-aligned dedicated enquiry fields',()=>{
  for(const field of ['sidraExperienceFrom','sidraExperienceTo','sidraCruiseDepartFrom','sidraCruiseDepartTo','sidraCruiseDuration'])assert.match(js,new RegExp(field));
  assert.match(js,/Concerts, sports & activities/);
  assert.match(js,/Cruise duration/);
  assert.match(js,/Cruise quotation request/);
  assert.match(js,/Experiences quotation request/);
});

test('mobile layout uses stacked search controls, cards and no fake inventory',()=>{
  assert.match(html,/sidra-mobile-booking\.css\?v=20261116c/);
  assert.match(html,/sidra-mobile-booking\.js\?v=20261116c/);
  assert.match(css,/@media\s*\(max-width:\s*700px\)/);
  assert.match(css,/\.hero-intro\s*\{display:none/);
  assert.match(css,/\.site-search/);
  assert.match(css,/\.sidra-mobile-field/);
  assert.match(js,/sendWhatsApp/);
  assert.doesNotMatch(js,/create-payment|confirm-booking|Stripe|checkout\.sessions|fakeFares/i);
  assert.doesNotMatch(js,/new Date\('2026-/);
});

test('customer sign-in safe preview unchanged',()=>{
  assert.match(ota,/Email \/ Username/);
  assert.match(ota,/Create a new account/);
  assert.match(ota,/Forgot password\?/);
  assert.match(ota,/Authentication is not activated/);
});


test('inactive travel forms are hidden even when a legacy CSS rule forces flex or grid',()=>{
  assert.match(js,/\.hidden=name!==kind/);
  assert.match(js,/const forms=\{flights:'flightArea',hotels:'hotelArea',cars:'carArea'/);
  for(const id of ['flightArea','hotelArea','carArea','holidayArea','experiencesArea','cruisesArea']){
    assert.match(css,new RegExp('#'+id+'\\[hidden\\]'),id);
  }
});

test('mobile package route inputs occupy full-width rows without clipping',()=>{
  assert.match(css,/@media\(max-width:700px\)/);
  for(const id of ['sidraPackageFrom','sidraPackageTo','sidraPackageStay'])
    assert.match(css,new RegExp(':has\\(#'+id+'\\)'),id);
  assert.match(css,/\.shop-menu,[\s\S]*\.header-tools\{display:none!important\}/);
});
