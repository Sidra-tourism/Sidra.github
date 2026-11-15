import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, randomBytes } from 'node:crypto';
import { cleanSettings, validatePassenger } from './membership-core.js';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class HttpError extends Error { constructor(status, message){ super(message); this.status=status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const locked = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' };

function settings(){
  const url=process.env.SIDRA_SUPABASE_URL;
  const publicKey=process.env.SIDRA_SUPABASE_PUBLISHABLE_KEY;
  const secret=process.env.SIDRA_SUPABASE_SECRET_KEY;
  let origin;
  try {const u=new URL(url); if(u.protocol!=='https:' || !u.hostname.endsWith('.supabase.co'))return null; origin=u.origin;}catch{return null;}
  if(!publicKey || !secret || process.env.SIDRA_MEMBERSHIP_ENABLED!=='true')return null;
  return {origin,publicKey,secret};
}
function piiKey(){
  const raw=process.env.SIDRA_PII_ENCRYPTION_KEY_B64;
  if(typeof raw!=='string'||!/^([A-Za-z0-9+/]{43}=)$/.test(raw))return null;
  const key=Buffer.from(raw,'base64');return key.length===32?key:null;
}
export function encryptPrivateText(text,key){
  if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('Secure identity encryption is not configured');
  if(typeof text!=='string'||text.length>400)throw new Error('Invalid protected identity field');
  if(text==='')return null;
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
  const encrypted=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
  return ['v1',nonce.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
}
async function requestJson(url,init={}){
  let response;
  try{response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(9000),...init});}
  catch{fail(502,'Sidra identity provider is temporarily unavailable');}
  const data=await response.json().catch(()=>null);
  if(!response.ok)fail(response.status===401?401:502,response.status===401?'Sign in again':'Sidra data provider could not complete the request');
  return data;
}
function dbHeaders(secret, returning=false){
 const headers={'apikey':secret,'content-type':'application/json','prefer':returning?'return=representation':'return=minimal'};
 if(!secret.startsWith('sb_secret_'))headers.authorization='Bearer '+secret;
 return headers;
}
async function db(config,table,search='',method='GET',body){
 const url=config.origin+'/rest/v1/'+table+search;
 return requestJson(url,{method,headers:dbHeaders(config.secret,method!=='GET'),...(body?{body:JSON.stringify(body)}:{})});
}
async function actor(req,config){
  const authorization=req.get('authorization')||'';
  const token=/^Bearer ([A-Za-z0-9_.-]{20,4096})$/.exec(authorization)?.[1];
  if(!token)fail(401,'Sign in to access your Sidra account');
  const user=await requestJson(config.origin+'/auth/v1/user',{headers:{apikey:config.publicKey,authorization:'Bearer '+token}});
  if(!UUID.test(user?.id||'')||!user?.email_confirmed_at)fail(401,'Verify your email before accessing your account');
  const roles=await db(config,'sidra_member_roles','?select=role&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
  return {userId:user.id,email:user.email,role:roles?.[0]?.role||'customer'};
}
function protect(handler){return (req,res)=>Promise.resolve().then(()=>{
  const config=settings();if(!config)fail(503,'Sidra customer accounts are awaiting secure setup');
  return actor(req,config).then(identity=>handler(req,res,config,identity));
}).catch(error=>res.status(error instanceof HttpError?error.status:400).set(locked).json({error:error instanceof HttpError?error.message:'Invalid request'}));}
function requireAdmin(identity){if(!['admin','super_admin'].includes(identity.role))fail(403,'Administrator permission required');}
function codeQuery(userId){return '&auth_user_id=eq.'+encodeURIComponent(userId);}
const memberSelect='auth_user_id,customer_code,first_name,middle_name,last_name,phone,created_at,identity_status';

export function registerMembershipRoutes(app){
  app.get('/account',(req,res)=>res.set({'Cache-Control':'no-store'}).sendFile(path.join(siteRoot,'account.html')));
  app.get('/admin-workspace',(req,res)=>res.set({'Cache-Control':'no-store'}).sendFile(path.join(siteRoot,'admin-workspace.html')));
  app.get('/api/member/config',(_req,res)=>{
    const c=settings();res.set(locked).json({configured:!!c,signupEnabled:!!c&&process.env.SIDRA_CUSTOMER_SIGNUP_ENABLED==='true',supabaseUrl:c?.origin||null,publishableKey:c?.publicKey||null,otpRequired:true,bookingEnabled:false,paymentsEnabled:false,verifiedSupplier:false,documentsEnabled:false});
  });
  app.get('/api/member/me',protect(async(_req,res,c,who)=>{
    const members=await db(c,'sidra_members','?select='+memberSelect+codeQuery(who.userId)+'&limit=1');
    if(!members?.length)fail(404,'Member record not found. Contact Sidra support.');
    const wallet=await db(c,'sidra_member_wallets','?select=wallet_code,currency,status&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&limit=1');
    res.set(locked).json({user:{email:who.email,role:who.role,...members[0]},wallet:wallet?.[0]||null,ticketingEnabled:false});
  }));
  app.get('/api/member/passengers',protect(async(_req,res,c,who)=>{
    const records=await db(c,'sidra_passengers','?select=id,first_name,middle_name,last_name,dob,nationality,citizenship,relationship,passport_expiry,created_at&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&order=created_at.desc&limit=40');
    res.set(locked).json({passengers:records||[]});
  }));
  app.post('/api/member/passengers',protect(async(req,res,c,who)=>{
    if(!piiKey())fail(503,'Encrypted passport storage is not configured');
    const parsed=validatePassenger(req.body);
    const key=piiKey();
    const entry={owner_user_id:who.userId,first_name:parsed.firstName,middle_name:parsed.middleName,last_name:parsed.lastName,dob:parsed.dob,nationality:parsed.nationality,citizenship:parsed.citizenship,relationship:parsed.relationship,passport_ciphertext:encryptPrivateText(parsed.passportNumber,key),passport_expiry:parsed.passportExpiry||null,spid_ciphertext:encryptPrivateText(parsed.spidId,key),address_ciphertext:encryptPrivateText(parsed.address,key)};
    const rows=await db(c,'sidra_passengers','','POST',entry);
    res.status(201).set(locked).json({passenger:rows?.[0]?{id:rows[0].id,firstName:parsed.firstName,lastName:parsed.lastName}:null});
  }));
  app.get('/api/member/bookings',protect(async(_req,res,c,who)=>{
    const records=await db(c,'sidra_booking_records','?select=id,booking_code,service,status,origin,destination,departure_date,return_date,created_at&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&order=created_at.desc&limit=50');
    res.set(locked).json({bookings:records||[],confirmedTicketsOnly: true});
  }));
  app.get('/api/member/wallet',protect(async(_req,res,c,who)=>{
    const wallets=await db(c,'sidra_member_wallets','?select=id,wallet_code,currency,status&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&limit=1');
    const w=wallets?.[0];if(!w)fail(404,'Member wallet not yet provisioned');
    const points=await db(c,'sidra_points_ledger','?select=points_delta&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&limit=200');
    const credits=await db(c,'sidra_credit_ledger','?select=credit_delta_minor&owner_user_id=eq.'+encodeURIComponent(who.userId)+'&limit=200');
    // Account ledger previews are read-only. Credits are not redeemable until compliant reconciliation is live.
    res.set(locked).json({walletCode:w.wallet_code,currency:w.currency,status:w.status,points:(points||[]).reduce((n,x)=>n+x.points_delta,0),refundCreditsMinor:(credits||[]).reduce((n,x)=>n+x.credit_delta_minor,0),redemptionEnabled:false,withdrawalEnabled:false});
  }));
  app.post('/api/member/documents/upload-intent',protect(async(_req,res)=>res.status(503).set(locked).json({error:'Private travel-document storage and compliance review have not been activated.'})));
  app.get('/api/member/admin/overview',protect(async(_req,res,c,who)=>{
    requireAdmin(who);
    const values=await db(c,'sidra_admin_settings','?select=markup_basis_points,updated_at&settings_id=eq.1&limit=1');
    res.set(locked).json({markupBasisPoints:values?.[0]?.markup_basis_points??0,airlineProvider:'not_connected',iataSettlement:'pending_verification',amadeus:'not_connected',paymentGateway:'not_connected',developerMcp:'not_connected',liveTicketing:false});
  }));
  app.patch('/api/member/admin/markup',protect(async(req,res,c,who)=>{
    requireAdmin(who);
    const payload=cleanSettings(req.body);
    // One database transaction: update + audit must succeed or fail together.
    const verified=await db(c,'rpc/sidra_admin_set_markup','','POST',{p_actor:who.userId,p_markup:payload.markupBasisPoints});
    if(verified?.audited!==true || verified?.markupBasisPoints!==payload.markupBasisPoints)fail(503,'The markup was not verified as audited');
    res.set(locked).json({...verified,liveTicketing:false});
  }));
}