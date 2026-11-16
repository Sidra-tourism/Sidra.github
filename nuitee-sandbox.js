/** Sidra Tourism: Nuitée hotel sandbox only. No live rates, prebook, or payment. */
const NUITEE_BASE='https://api.liteapi.travel/v3.0';
const ALLOWED_CURRENCIES=new Set(['USD','EUR','GBP','QAR','LKR','AED','SAR','INR','AUD','CAD','SGD','JPY']);
function fail(message,status=422){const e=new Error(message);e.status=status;return e;}
function isoDate(str){
  if(typeof str!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(str))return null;
  const d=new Date(str+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===str?d:null;
}
export function validateHotelSandboxCriteria(input,todayISO=new Date().toISOString().slice(0,10)){
  if(!input||typeof input!=='object')throw fail('Search criteria required');
  const placeId=String(input.placeId||'').trim();
  if(!/^[A-Za-z0-9_:\-]{8,120}$/.test(placeId))throw fail('Select a valid destination from suggestions');
  const checkin=String(input.checkin||''),checkout=String(input.checkout||'');
  const a=isoDate(checkin),b=isoDate(checkout),today=isoDate(todayISO);
  if(!a||!b||!today||a<today)throw fail('Choose a valid future check-in date');
  const nights=Math.round((b-a)/86400000);
  if(nights<1||nights>30)throw fail('Check-out must be 1–30 nights after check-in');
  const adults=Number(input.adults),rooms=Number(input.rooms);
  if(!Number.isSafeInteger(adults)||adults<1||adults>8||!Number.isSafeInteger(rooms)||rooms<1||rooms>3||adults<rooms)
    throw fail('Each room needs an adult; maximum 8 adults in 3 rooms');
  const currency=String(input.currency||'').toUpperCase();
  if(!ALLOWED_CURRENCIES.has(currency))throw fail('Unsupported display currency');
  const guestNationality=String(input.guestNationality||'').toUpperCase();
  if(!/^[A-Z]{2}$/.test(guestNationality))throw fail('Guest nationality must be an ISO country code');
  const occupancies=Array.from({length:rooms},()=>({adults:Math.floor(adults/rooms)}));
  for(let i=0;i<adults%rooms;i++)occupancies[i].adults++;
  return {placeId,checkin,checkout,occupancies,currency,guestNationality,
    includeHotelData:true,roomMapping:true,maxRatesPerHotel:1,timeout:8};
}
export function isSandboxPreviewEnabled(env=process.env){
  // Hard-stop on production even if someone accidentally sets a sandbox key there.
  return env.VERCEL_ENV==='preview'&&env.SIDRA_NUITEE_SANDBOX_ENABLED==='true'&&
    typeof env.SIDRA_NUITEE_SANDBOX_API_KEY==='string'&&env.SIDRA_NUITEE_SANDBOX_API_KEY.startsWith('sand_');
}
function cleanText(v,max=160){return typeof v==='string'?v.trim().slice(0,max):'';}
function securePhoto(s){return typeof s==='string'&&/^https:\/\/[^\s]+$/i.test(s)?s:'';}
export function parseHotelRates(raw){
  if(!raw||raw.sandbox!==true)throw fail('Upstream response is not confirmed as sandbox data',502);
  if(raw.error)throw fail('Hotel sandbox could not return availability',503);
  const prices=Array.isArray(raw.data)?raw.data:[];
  const hotels=Array.isArray(raw.hotels)?raw.hotels:[];
  const byId=new Map(hotels.map(h=>[String(h.id||h.hotelId),h]));
  return {
    sandbox:true,pricesVerified:false,bookingEnabled:false,paymentEnabled:false,
    disclaimer:'Sandbox test rates only. Not live quotes or bookable offers.',
    hotels:prices.slice(0,10).map(row=>{
      const id=cleanText(row.hotelId,100),info=byId.get(id)||{};
      const room=(Array.isArray(row.roomTypes)?row.roomTypes:[])[0]||{};
      const rate=(Array.isArray(room.rates)?room.rates:[])[0]||{};
      const price=(Array.isArray(rate.retailRate?.total)?rate.retailRate.total:[])[0]||{};
      const amount=Number(price.amount),currency=cleanText(price.currency,3);
      return {
        id,name:cleanText(info.name,120),address:cleanText(info.address,180),photo:securePhoto(info.main_photo),
        sampleRate:Number.isFinite(amount)&&amount>0&&amount<1e8&&/^[A-Z]{3}$/.test(currency)?{
          amount,currency,roomName:cleanText(rate.name,100),boardName:cleanText(rate.boardName,80)
        }:null
      };
    }).filter(x=>x.id)
  };
}
export function makeSandboxClient({apiKey,fetchImpl=fetch}={}){
  if(typeof apiKey!=='string'||!apiKey.startsWith('sand_'))throw fail('Valid sandbox key is not configured',503);
  async function request(url,options={}){
    let response;
    try{
      response=await fetchImpl(url,{
        ...options,headers:{accept:'application/json','X-API-Key':apiKey,...(options.body?{'content-type':'application/json'}:{})},
        signal:AbortSignal.timeout(12000)
      });
    }catch{throw fail('Hotel sandbox request temporarily unavailable',503);}
    if(!response.ok)throw fail('Hotel sandbox provider temporarily unavailable',response.status===429?503:502);
    try{return await response.json();}catch{throw fail('Invalid hotel sandbox response',502);}
  }
  return {
    async places(query){
      const text=String(query||'').trim();
      if(text.length<2||text.length>80||/[\x00-\x1f]/.test(text))throw fail('Enter a destination of 2–80 characters');
      const data=await request(NUITEE_BASE+'/data/places?textQuery='+encodeURIComponent(text));
      if(data.error)throw fail('Destination lookup unavailable',503);
      return (Array.isArray(data.data)?data.data:[]).slice(0,10).map(p=>({
        placeId:cleanText(p.placeId,120),name:cleanText(p.displayName,120),address:cleanText(p.formattedAddress,180)
      })).filter(p=>p.placeId&&p.name);
    },
    async rates(criteria,today){
      const payload=validateHotelSandboxCriteria(criteria,today);
      const raw=await request(NUITEE_BASE+'/hotels/rates',{method:'POST',body:JSON.stringify(payload)});
      return parseHotelRates(raw);
    }
  };
}
