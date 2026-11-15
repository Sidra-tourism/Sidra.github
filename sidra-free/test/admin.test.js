import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAdminRequest} from '../src/admin-worker.js';

const origin = 'https://staff.sidra-tourism.com';
function req(path='/', method='GET', extra={}) {
  return new Request(origin + path, {method, ...extra});
}

test('private dashboard fails closed with no Cloudflare Access configuration', async () => {
  const response=await handleAdminRequest(req(), {});
  assert.equal(response.status,503);
});
test('private dashboard refuses unsigned access on every URL', async () => {
  const env={ACCESS_TEAM_DOMAIN:'sidra-owners.cloudflareaccess.com',ACCESS_AUD:'sidra-audience-tag',SIDRA_ADMIN_EMAIL:'admin@sidra-tourism.com',SIDRA_DB:{}};
  for(const path of ['/', '/app.js','/api/enquiries','/api/enquiries/abcd']) {
    const response=await handleAdminRequest(req(path),env);
    assert.equal(response.status,401,path);
  }
});

async function identity(email='admin@sidra-tourism.com', change={}) {
  const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk = await crypto.subtle.exportKey('jwk',pair.publicKey);
  const env={ACCESS_TEAM_DOMAIN:'sidra-owners.cloudflareaccess.com', ACCESS_AUD:'sidra-audience-tag', SIDRA_ADMIN_EMAIL:'admin@sidra-tourism.com'};
  const kid='sidra-'+crypto.randomUUID();
  const claims={iss:'https://'+env.ACCESS_TEAM_DOMAIN, aud:[env.ACCESS_AUD], exp:Math.floor(Date.now()/1000)+600, email, ...change};
  const b64= obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data=b64({alg:'RS256',kid})+'.'+b64(claims);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data));
  const token=data+'.'+Buffer.from(signature).toString('base64url');
  const fetchJwks=async()=>Response.json({keys:[{...jwk,kid}]});
  return {token,env,fetchJwks};
}

test('rejects expired or wrong-email cryptographically signed tokens',async()=>{
  for(const [email, claims] of [['other@sidra-tourism.com',{}],['admin@sidra-tourism.com',{exp:10}]]) {
    const a=await identity(email,claims);
    const response=await handleAdminRequest(req('/api/me','GET',{headers:{'cf-access-jwt-assertion':a.token}}),a.env,a.fetchJwks);
    assert.equal(response.status,401);
  }
});

test('signed owner token permits only the owner profile',async()=>{
  const a=await identity();
  const response=await handleAdminRequest(req('/api/me','GET',{headers:{'cf-access-jwt-assertion':a.token}}),a.env,a.fetchJwks);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{role:'owner',email:'admin@sidra-tourism.com'});
});

test('signed owner sees only explicit limited columns, denies bad statuses',async()=>{
  const a=await identity();
  const statements=[];
  const db={prepare(sql){statements.push(sql);return {bind(){return this},async all(){return {results:[{id:'11111111-1111-1111-1111-111111111111',status:'requested'}]}}}}};
  const headers={'cf-access-jwt-assertion':a.token};
  const response=await handleAdminRequest(req('/api/enquiries','GET',{headers}),{...a.env,SIDRA_DB:db},a.fetchJwks);
  assert.equal(response.status,200);
  assert.equal((await response.json()).enquiries.length,1);
  assert.match(statements[0],/LIMIT 50/);
  const bad=await handleAdminRequest(req('/api/enquiries?status=confirmed','GET',{headers}),{...a.env,SIDRA_DB:db},a.fetchJwks);
  assert.equal(bad.status,400);
});

test('authenticated PATCH rejects off-origin writes and mass-assignment',async()=>{
  const a=await identity();
  const id='11111111-1111-1111-1111-111111111111';
  const headers={'cf-access-jwt-assertion':a.token,'content-type':'application/json'};
  let r=await handleAdminRequest(req('/api/enquiries/'+id,'PATCH',{headers:{...headers,origin:'https://other.example'},body:JSON.stringify({status:'quoted',expectedStatus:'requested'})}),{...a.env,SIDRA_DB:{}},a.fetchJwks);
  assert.equal(r.status,403);
  r=await handleAdminRequest(req('/api/enquiries/'+id,'PATCH',{headers:{...headers,origin},body:JSON.stringify({status:'confirmed',expectedStatus:'requested',role:'admin'})}),{...a.env,SIDRA_DB:{}},a.fetchJwks);
  assert.equal(r.status,400);
});

test('status update uses conditional atomic D1 batch plus an audit row',async()=>{
  const a=await identity();
  const id='11111111-1111-1111-1111-111111111111';
  const statements=[];
  const db={prepare(sql){const x={sql,bind(...args){this.args=args;return this}};statements.push(x);return x},async batch(){return [{meta:{changes:1}},{meta:{changes:1}}]}};
  const response=await handleAdminRequest(req('/api/enquiries/'+id,'PATCH',{headers:{'cf-access-jwt-assertion':a.token,origin,'content-type':'application/json'},body:JSON.stringify({status:'reviewing',expectedStatus:'requested'})}),{...a.env,SIDRA_DB:db},a.fetchJwks);
  assert.equal(response.status,200);
  assert.equal((await response.json()).audited,true);
  assert.match(statements[0].sql,/UPDATE sidra_enquiries/);
  assert.match(statements[1].sql,/INSERT INTO sidra_enquiry_audit/);
});