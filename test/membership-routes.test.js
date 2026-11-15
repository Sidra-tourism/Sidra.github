import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerMembershipRoutes, encryptPrivateText } from '../lib/membership-routes.js';

function application(){
 const routes=new Map();const app={
   get(route,fn){routes.set('GET '+route,fn)},
   post(route,fn){routes.set('POST '+route,fn)},
   patch(route,fn){routes.set('PATCH '+route,fn)}
 };
 registerMembershipRoutes(app);
 return {routes};
}
function response(){
 return {code:200,headers:{},payload:undefined,
  set(arg,value){if(typeof arg==='string')this.headers[arg]=value;else Object.assign(this.headers,arg);return this},
  status(n){this.code=n;return this},json(x){this.payload=x;return this},sendFile(){this.code=200;return this}};
}
async function call(handler,request={}){
 const res=response();await handler({get:k=>request.headers?.[k.toLowerCase()]||'',body:request.body,params:request.params||{}},res);
 // Express-style async handlers return promise where wrapped protect resolves: sync cb returns undefined;
 await new Promise(setImmediate);
 return res;
}
test('account config fails closed without verified Sidra Supabase environment', async()=>{
 const restore={...process.env};
 try{delete process.env.SIDRA_MEMBERSHIP_ENABLED; const {routes}=application();const res=await call(routes.get('GET /api/member/config'));
 assert.equal(res.code,200);assert.equal(res.payload.configured,false);assert.equal(res.payload.signupEnabled,false);
 assert.equal(res.payload.bookingEnabled,false);assert.equal(res.payload.paymentsEnabled,false);
 assert.equal(res.payload.publishableKey,null);
 }finally{process.env=restore;}
});
test('all customer and admin API endpoints fail closed without connected identity project',async()=>{
 const restore={...process.env};
 try{delete process.env.SIDRA_MEMBERSHIP_ENABLED;const {routes}=application();for(const route of ['GET /api/member/me','GET /api/member/passengers','POST /api/member/passengers','GET /api/member/bookings','GET /api/member/wallet','GET /api/member/admin/overview','PATCH /api/member/admin/markup']){
 const r=await call(routes.get(route),{});assert.equal(r.code,503,route);
 }}finally{process.env=restore;}
});
test('identity encryption requires secret server key and uses different nonces',()=>{
 assert.throws(()=>encryptPrivateText('P1234',null),/not configured/);
 const key=Buffer.alloc(32,7),a=encryptPrivateText('P1234',key),b=encryptPrivateText('P1234',key);
 assert.notEqual(a,b);assert.match(a,/^v1:[^:]+:[^:]+:[^:]+$/);
 assert.equal(encryptPrivateText('',key),null);
});
test('preview includes customer sign in, create account, OTP, recovery and family pages',()=>{
 const page=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
 for(const id of ['signInForm','signUpForm','verifyForm','recoveryForm','resetForm','passengerForm','bookingList','walletNumber','memberCode','identityDoc','profilePhoto']) assert.ok(page.includes('id="'+id+'"'),id);
 assert.ok(page.includes('STANDARD USER'));
 assert.match(page,/SPID \/ National ID/);
 assert.match(page,/Passport expiry/);
 assert.match(page,/optional/);
});
test('staff workspace has markup controls and integration registry but cannot issue tickets',()=>{
 const page=readFileSync(new URL('../public/admin-workspace.html',import.meta.url),'utf8');
 assert.ok(page.includes('id="markupPercentage"'));
 assert.ok(page.includes('Developer &amp; MCP'));
 const client=readFileSync(new URL('../public/admin-workspace.js',import.meta.url),'utf8'); assert.match(client,/Amadeus/);
 assert.match(page,/Not connected/);
 assert.doesNotMatch(page,/onclick="issueTicket/);
});
test('SQL protects tables from anon and uses atomic audited markup RPC',()=>{
 const sql=readFileSync(new URL('../database/sidra_membership.sql',import.meta.url),'utf8');
 for(const name of ['sidra_members','sidra_passengers','sidra_booking_records','sidra_credit_ledger','sidra_points_ledger','sidra_admin_settings','sidra_member_wallets']) assert.ok(sql.includes('public.'+name),name);
 assert.match(sql,/enable row level security/i);assert.match(sql,/revoke all on public.%I from PUBLIC,anon,authenticated/);
 assert.match(sql,/revoke all on function public.sidra_admin_set_markup\(uuid,integer\) from PUBLIC, anon, authenticated/);
 assert.match(sql,/SID-QA-/);
});


test('membership QR is a genuine QR matrix that encodes only the membership number',async()=>{
 const {makeMemberQrCode}=await import('../public/member-qr.js');
 const a=makeMemberQrCode('SID-QA-2026-N000001');
 assert.equal(a.length,25);
 assert.ok(a.every(row=>row.length===25 && row.every(v=>typeof v==='boolean')));
 assert.ok(a[0][0]);assert.ok(a[0][6]);assert.ok(a[6][0]);assert.ok(a[6][6]);
 const { createHash } = await import('node:crypto');
 const digest=createHash('sha256').update(a.map(row=>row.map(bit=>bit?'1':'0').join('')).join('')).digest('hex');
 assert.equal(digest,'62be592eddcb9ca1399dc4b3ed12913ae28d7abfcfbbb018f85e3cc4868271d0');
 assert.throws(()=>makeMemberQrCode('Mira Example'));
 assert.throws(()=>makeMemberQrCode('P12345678'));
});

test('administrator API requires verified MFA assurance, not merely role',async()=>{
 const saved={...process.env},oldFetch=globalThis.fetch;
 const user='123e4567-e89b-42d3-a456-426614174000';
 const payload=Buffer.from(JSON.stringify({sub:user,aal:'aal1'})).toString('base64url');
 const token=['eyJhbGciOiJIUzI1NiJ9',payload,'fakesignature'].join('.');
 try{
  process.env.SIDRA_MEMBERSHIP_ENABLED='true';process.env.SIDRA_SUPABASE_URL='https://rcavyshsxnzodoipsbun.supabase.co';
  process.env.SIDRA_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.SIDRA_SUPABASE_SECRET_KEY='sb_secret_test';
  let accesses=0;
  globalThis.fetch=async url=>{
   accesses++;
   if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:user,email:'admin@sidra-tourism.com',email_confirmed_at:'2026-11-15T00:00:00Z'})};
   if(url.includes('/rest/v1/sidra_member_roles'))return {ok:true,json:async()=>[{role:'super_admin'}]};
   if(url.includes('/rest/v1/sidra_admin_settings'))return {ok:true,json:async()=>[{markup_basis_points:1000}]};
   throw new Error('unexpected request '+url);
  };
  const {routes}=application();
  const r=await call(routes.get('GET /api/member/admin/overview'),{headers:{authorization:'Bearer '+token}});
  assert.equal(r.code,403);
  assert.match(r.payload.error,/MFA/i);
  assert.equal(accesses,2,'no privileged data query after MFA rejection');
 }finally{process.env=saved;globalThis.fetch=oldFetch;}
});