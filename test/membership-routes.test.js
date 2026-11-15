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
 for(const id of ['signInForm','signUpForm','verifyForm','recoveryForm','passengerForm','bookingList','walletNumber','memberCode','identityDoc','profilePhoto']) assert.ok(page.includes('id="'+id+'"'),id);
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