import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadOnlyFareClient, isConfiguredFareProvider} from '../flight-offers-provider.js';

const criteria={fromCountry:'Qatar',from:'DOH',toCountry:'Sri Lanka',to:'CMB',
  departureDate:'2099-01-20',tripType:'roundtrip',returnDate:'2099-01-24',adults:1,children:0};
const enabled=()=>({
  SIDRA_FARE_PROVIDER:'amadeus',
  SIDRA_FARE_SEARCH_APPROVED:'true',
  AMADEUS_ENV:'production',
  AMADEUS_CLIENT_ID:'test-client-id',
  AMADEUS_CLIENT_SECRET:'test-client-secret'
});
const data={data:[{id:'offer-1',validatingAirlineCodes:['QR'],
  price:{currency:'USD',total:'452.71'},numberOfBookableSeats:4,
  itineraries:[
    {segments:[{departure:{iataCode:'DOH',at:'2099-01-20T08:00:00'},arrival:{iataCode:'CMB',at:'2099-01-20T14:40:00'},carrierCode:'QR'}]},
    {segments:[{departure:{iataCode:'CMB',at:'2099-01-24T20:00:00'},arrival:{iataCode:'DOH',at:'2099-01-25T00:20:00'},carrierCode:'QR'}]}
  ]}]};

test('fare provider is fail-closed without contract approval and production credentials', async()=>{
  for(const env of [{}, {...enabled(),SIDRA_FARE_SEARCH_APPROVED:''},
    {...enabled(),AMADEUS_ENV:'test'}, {...enabled(),AMADEUS_CLIENT_SECRET:''}]){
    assert.equal(isConfiguredFareProvider(env),false);
    let requests=0;
    const client=createReadOnlyFareClient({env,fetchImpl:async()=>{requests++;throw Error('network must not run')}});
    await assert.rejects(client.search(criteria),e=>e.code==='FLIGHT_PROVIDER_UNAVAILABLE');
    assert.equal(requests,0);
  }
});

test('configured search uses production OAuth and offers endpoint with traveler criteria', async()=>{
  const urls=[];let tokenCalls=0;
  const fetchImpl=async(url,init)=>{
    const u=new URL(url);urls.push(u);
    assert.equal(u.origin,'https://api.amadeus.com');
    if(u.pathname==='/v1/security/oauth2/token'){
      tokenCalls++;
      assert.equal(init.method,'POST');
      assert.match(String(init.body),/grant_type=client_credentials/);
      assert.match(String(init.body),/client_id=test-client-id/);
      return {ok:true,status:200,json:async()=>({access_token:'temporary-token',expires_in:1800})};
    }
    assert.equal(u.pathname,'/v2/shopping/flight-offers');
    assert.equal(init.headers.Authorization,'Bearer temporary-token');
    assert.equal(u.searchParams.get('originLocationCode'),'DOH');
    assert.equal(u.searchParams.get('destinationLocationCode'),'CMB');
    assert.equal(u.searchParams.get('returnDate'),'2099-01-24');
    assert.equal(u.searchParams.get('adults'),'1');
    assert.equal(u.searchParams.get('max'),'6');
    return {ok:true,status:200,json:async()=>data};
  };
  const client=createReadOnlyFareClient({env:enabled(),fetchImpl});
  const result=await client.search(criteria);
  assert.equal(urls.length,2);
  assert.equal(tokenCalls,1);
  assert.equal(result.source,'amadeus-production');
  assert.equal(result.liveSearch,true);
  assert.equal(result.priceConfirmed,false);
  assert.equal(result.bookingEnabled,false);
  assert.equal(result.paymentEnabled,false);
  assert.equal(result.results[0].total,'452.71');
  assert.equal(result.results[0].currency,'USD');
  assert.equal(result.results[0].itineraries[0].from,'DOH');
  await client.search(criteria);
  assert.equal(tokenCalls,1,'token is cached until expiry');
});

test('malformed, negative, missing or fabricated-looking values are never displayed as fares',async()=>{
  const broken={data:[
    {id:'bad1',price:{currency:'USD',total:'-25'},itineraries:data.data[0].itineraries},
    {id:'bad2',price:{currency:'X$',total:'200'},itineraries:data.data[0].itineraries},
    {id:'bad3',price:{currency:'USD',total:'NaN'},itineraries:data.data[0].itineraries},
    {id:'bad4',price:{currency:'USD',total:'15'},itineraries:[]}
  ]};
  const fetchImpl=async(url)=>url.includes('/oauth2/token')
    ? {ok:true,status:200,json:async()=>({access_token:'tmp',expires_in:300})}
    : {ok:true,status:200,json:async()=>broken};
  const client=createReadOnlyFareClient({env:enabled(),fetchImpl});
  assert.deepEqual((await client.search(criteria)).results,[]);
});

test('errors never disclose secrets and never return demo fares',async()=>{
  const fetchImpl=async(url)=>url.includes('oauth2/token')
    ? {ok:false,status:401,json:async()=>({error:'test-client-secret'})}
    : {ok:false,status:502,json:async()=>({error:'test-client-secret'})};
  const client=createReadOnlyFareClient({env:enabled(),fetchImpl});
  await assert.rejects(client.search(criteria),error=>{
    assert.equal(error.code,'FLIGHT_PROVIDER_ERROR');
    assert.doesNotMatch(error.message,/test-client-secret|temporary-token/);
    return true;
  });
});

test('invalid airport or past dates never cause provider network access',async()=>{
  let requests=0;
  const client=createReadOnlyFareClient({env:enabled(),fetchImpl:async()=>{requests++;throw Error('unexpected')}});
  await assert.rejects(client.search({...criteria,from:'Qatar'}),/airport/i);
  await assert.rejects(client.search({...criteria,departureDate:'2020-01-01'}),/departure date/i);
  assert.equal(requests,0);
});


test('flight search server will only call read-only provider behind two explicit release gates',()=>{
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/createReadOnlyFareClient/);
  assert.match(server,/SIDRA_PUBLIC_FARES_ACTIVE/);
  assert.match(server,/fareClient\.enabled/);
  assert.match(server,/await fareClient\.search\(criteria\)/);
  assert.match(server,/FLIGHT_PROVIDER_UNAVAILABLE/);
  assert.match(server,/Cache-Control/);
  assert.match(server,/bookingEnabled: false/);
});

test('public page only displays production-source indicative fares with confirmation warning',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/function showLiveIndicativeFlightOffers/);
  assert.match(html,/amadeus-production/);
  assert.match(html,/payload\.liveSearch === true/);
  assert.match(html,/priceConfirmed === false/);
  assert.match(html,/Final price and availability must be reconfirmed/);
  assert.match(html,/Request verified quote/);
  assert.doesNotMatch(html,/instant ticket issuance/i);
});
