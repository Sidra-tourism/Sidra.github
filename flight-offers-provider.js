/**
 * Read-only production airline-offer adapter for Sidra Tourism.
 *
 * This does not issue tickets, create orders, take payments or imply final prices.
 * It must remain DISABLED until commercial provider approval, rate protection,
 * credentials and production go-live are explicitly authorized.
 */
import { validateFlightSearch } from './flight-policy.js';

const API_ORIGIN = 'https://api.amadeus.com';
const MAX_OFFERS = 6;

export function isConfiguredFareProvider(env = {}) {
  return env.SIDRA_FARE_PROVIDER === 'amadeus'
    && env.SIDRA_FARE_SEARCH_APPROVED === 'true'
    && env.AMADEUS_ENV === 'production'
    && typeof env.AMADEUS_CLIENT_ID === 'string'
    && env.AMADEUS_CLIENT_ID.trim().length > 0
    && typeof env.AMADEUS_CLIENT_SECRET === 'string'
    && env.AMADEUS_CLIENT_SECRET.trim().length > 0;
}
function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function providerUnavailable() {
  return failure('FLIGHT_PROVIDER_UNAVAILABLE','Live flight fares are not yet connected to an approved provider.');
}
function providerError() {
  return failure('FLIGHT_PROVIDER_ERROR','Live flight pricing is temporarily unavailable. Please request a verified quotation.');
}
function airport(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
}
function flightTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
    ? value.slice(0,32) : null;
}
function journey(item) {
  const segments = item?.segments;
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 8) return null;
  const first = segments[0],last = segments.at(-1);
  const from = airport(first?.departure?.iataCode);
  const to = airport(last?.arrival?.iataCode);
  const departureAt = flightTime(first?.departure?.at);
  const arrivalAt = flightTime(last?.arrival?.at);
  if (!from || !to || !departureAt || !arrivalAt) return null;
  return {
    from, to, departureAt, arrivalAt,
    stops:segments.length-1,
    carrierCode:typeof first?.carrierCode === 'string' && /^[A-Z0-9]{2,3}$/.test(first.carrierCode)
      ? first.carrierCode : null
  };
}
function normalizeOffer(offer) {
  const total = offer?.price?.total;
  const currency = offer?.price?.currency;
  if (typeof total !== 'string'
    || !/^\d{1,8}(?:\.\d{1,2})?$/.test(total)
    || !Number.isFinite(Number(total))
    || Number(total) <= 0
    || typeof currency !== 'string'
    || !/^[A-Z]{3}$/.test(currency)
    || typeof offer?.id !== 'string'
    || offer.id.length < 1 || offer.id.length > 64
    || !Array.isArray(offer.itineraries) || !offer.itineraries.length
    || offer.itineraries.length > 2) return null;
  const itineraries = offer.itineraries.map(journey);
  if (itineraries.some(x=>!x)) return null;
  return {
    providerOfferId:offer.id,
    total, currency, itineraries,
    priceConfirmed:false,
    bookingEnabled:false,
    paymentEnabled:false
  };
}
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    throw providerError();
  }
}

export function createReadOnlyFareClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  let token = '',validUntil = 0;

  async function request(url, options) {
    try {
      return await fetchImpl(url, {
        ...options,
        signal:AbortSignal.timeout(8000),
        cache:'no-store'
      });
    } catch {
      // Never pass third-party error bodies, tokens or credentials to customers.
      throw providerError();
    }
  }

  async function getToken() {
    const current = now();
    if (token && current < validUntil) return token;
    const body = new URLSearchParams({
      grant_type:'client_credentials',
      client_id:env.AMADEUS_CLIENT_ID,
      client_secret:env.AMADEUS_CLIENT_SECRET
    });
    const response = await request(API_ORIGIN+'/v1/security/oauth2/token', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
      body:body.toString()
    });
    if (!response.ok) throw providerError();
    const payload = await safeJson(response);
    if (typeof payload?.access_token !== 'string' || !payload.access_token
      || !Number.isFinite(Number(payload?.expires_in))) throw providerError();
    token = payload.access_token;
    validUntil = current + Math.max(0,(Number(payload.expires_in)-60))*1000;
    return token;
  }

  return {
    enabled:isConfiguredFareProvider(env),
    async search(criteria) {
      if (!isConfiguredFareProvider(env)) throw providerUnavailable();
      // Defense in depth: still validate if this adapter is called independently.
      const validated=validateFlightSearch(criteria);
      const accessToken=await getToken();
      const params=new URLSearchParams({
        originLocationCode:validated.from,
        destinationLocationCode:validated.to,
        departureDate:validated.departureDate,
        adults:String(validated.adults),
        children:String(validated.children),
        max:String(MAX_OFFERS)
      });
      if (validated.tripType==='roundtrip')params.set('returnDate',validated.returnDate);
      const response=await request(API_ORIGIN+'/v2/shopping/flight-offers?'+params,{
        method:'GET',
        headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}
      });
      if (!response.ok) throw providerError();
      const data=await safeJson(response);
      if (!Array.isArray(data?.data)) throw providerError();
      const results=data.data.map(normalizeOffer).filter(Boolean)
        .sort((a,b)=>Number(a.total)-Number(b.total)).slice(0,MAX_OFFERS);
      return {
        source:'amadeus-production',
        liveSearch:true,
        priceConfirmed:false,
        pricesVerified:false,
        bookingEnabled:false,
        paymentEnabled:false,
        results
      };
    }
  };
}
