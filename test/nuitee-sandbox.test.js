import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHotelSandboxCriteria,makeSandboxClient,isSandboxPreviewEnabled,parseHotelRates} from '../nuitee-sandbox.js';
const good={placeId:'ChIJdd4hrwug2EcRmSrV3Vo6llI',checkin:'2026-12-10',checkout:'2026-12-12',adults:2,rooms:1,guestNationality:'LK',currency:'USD'};
const today='2026-11-16';

test('valid hotel criteria produce a Nuitée occupancy request without guest secrets',()=>{
  const c=validateHotelSandboxCriteria(good,today);
  assert.equal(c.placeId,good.placeId);
  assert.deepEqual(c.occupancies,[{adults:2}]);
  assert.equal(c.checkin,'2026-12-10');
  assert.equal(c.checkout,'2026-12-12');
  assert.equal(c.roomMapping,true);
  assert.equal(c.includeHotelData,true);
  assert.equal(c.maxRatesPerHotel,1);
});

test('rejects missing, past, impossible, reversed and overlong stay dates',()=>{
  for(const patch of [{checkin:'2026-02-30'},{checkin:'2026-11-15'},{checkout:'2026-12-09'},{checkout:'2027-02-10'},{checkin:''},{checkout:''}])
    assert.throws(()=>validateHotelSandboxCriteria({...good,...patch},today),/date|night|check/i);
});
test('rejects bad place IDs, occupancies, nationality and unsupported currency',()=>{
  for(const patch of [{placeId:'http://malicious'},{placeId:'a'.repeat(160)},{adults:0},{adults:50},{rooms:0},{rooms:4},{guestNationality:'QATAR'},{currency:'INVALID'},{currency:'BTC'}])
    assert.throws(()=>validateHotelSandboxCriteria({...good,...patch},today));
});
test('sandbox preview gate fails closed for production or a live key',()=>{
  assert.equal(isSandboxPreviewEnabled({VERCEL_ENV:'production',SIDRA_NUITEE_SANDBOX_ENABLED:'true',SIDRA_NUITEE_SANDBOX_API_KEY:'sand_example'}),false);
  assert.equal(isSandboxPreviewEnabled({VERCEL_ENV:'preview',SIDRA_NUITEE_SANDBOX_ENABLED:'true',SIDRA_NUITEE_SANDBOX_API_KEY:'live_example'}),false);
  assert.equal(isSandboxPreviewEnabled({VERCEL_ENV:'preview',SIDRA_NUITEE_SANDBOX_ENABLED:'true',SIDRA_NUITEE_SANDBOX_API_KEY:'sand_example'}),true);
  assert.equal(isSandboxPreviewEnabled({VERCEL_ENV:'preview',SIDRA_NUITEE_SANDBOX_ENABLED:'false',SIDRA_NUITEE_SANDBOX_API_KEY:'sand_example'}),false);
});
test('API client sends sandbox key server-side to a fixed hostname',async()=>{
  let called;
  const client=makeSandboxClient({apiKey:'sand_testing',fetchImpl:async(url,options)=>{
    called={url,options};
    return {ok:true,status:200,json:async()=>({data:[{placeId:'ChIJ1234',displayName:'Paris',formattedAddress:'France'}]})};
  }});
  const places=await client.places('Paris');
  assert.equal(called.url,'https://api.liteapi.travel/v3.0/data/places?textQuery=Paris');
  assert.equal(called.options.headers['X-API-Key'],'sand_testing');
  assert.equal(places[0].placeId,'ChIJ1234');
  assert.equal(places[0].name,'Paris');
});
test('normalized hotel results contain only unbookable sample prices',()=>{
  const raw={sandbox:true,hotels:[{id:'lp1',name:'Hotel Test',main_photo:'https://example.org/photo.jpg',address:'Main Road'}],data:[{hotelId:'lp1',roomTypes:[{offerId:'offer_secret',rates:[{name:'Deluxe',boardName:'Breakfast',retailRate:{total:[{amount:155.5,currency:'USD'}]}}]}]}]};
  const result=parseHotelRates(raw);
  assert.equal(result.sandbox,true);
  assert.equal(result.bookingEnabled,false);
  assert.equal(result.pricesVerified,false);
  assert.equal(result.hotels[0].name,'Hotel Test');
  assert.deepEqual(result.hotels[0].sampleRate,{amount:155.5,currency:'USD',roomName:'Deluxe',boardName:'Breakfast'});
  assert.doesNotMatch(JSON.stringify(result),/offer_secret|sand_testing/);
});
test('rejects response without explicit sandbox marker',()=>{
  assert.throws(()=>parseHotelRates({sandbox:false,data:[{hotelId:'lp1'}]}),/sandbox/i);
  assert.throws(()=>parseHotelRates({data:[{hotelId:'lp1'}]}),/sandbox/i);
});
test('provider errors cannot echo API keys or invent rates',async()=>{
  const client=makeSandboxClient({apiKey:'sand_private',fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:{message:'rate limit'}})})});
  await assert.rejects(client.rates(good,today),e=>e.status===503&&!JSON.stringify(e).includes('sand_private'));
});
test('public server routes enforce preview-only access and no ticketing',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/isSandboxPreviewEnabled/);
  assert.match(server,/SIDRA_NUITEE_PREVIEW_TOKEN/);
  assert.match(server,/\/api\/hotel-sandbox\/places/);
  assert.match(server,/\/api\/hotel-sandbox\/rates/);
  assert.match(server,/sandboxClient\.places/);
  assert.match(server,/sandboxClient\.rates/);
  assert.doesNotMatch(server,/\/api\/hotel-sandbox\/(?:prebook|book|payment|confirm)/i);
  assert.match(server,/FLIGHT_PROVIDER_UNAVAILABLE/);
});
