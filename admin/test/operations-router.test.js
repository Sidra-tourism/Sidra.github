import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createOperationsRouter} from '../operations-router.js';

async function fixture(provider){
  const app=express();app.use(express.json());
  app.use('/api/ops',createOperationsRouter({
    provider,
    ownerOnly:(req,res,next)=>{if(req.get('x-test-owner')!=='yes')return res.status(401).json({error:'Administrator authentication required'});req.ownerToken='test-owner-token';req.owner={profile:{must_change_password:false}};next();},
    checkWriteOrigin:(req,res,next)=>req.get('origin')==='https://admin.sidra-tourism.com'?next():res.status(403).json({error:'Origin denied'})
  }));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(ok=>server.once('listening',ok));
  return {base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(ok=>server.close(ok))};
}
test('operational data never leaks without authorized owner',async()=>{
  const f=await fixture(()=>{throw Error('Supabase must never be called')});
  try{const r=await fetch(f.base+'/api/ops/bookings');assert.equal(r.status,401);}finally{await f.close()}
});
test('only approved modules may be queried and reads use owner auth token',async()=>{
  const calls=[];
  const f=await fixture(async(path,config)=>{calls.push({path,config});return {ok:true,data:[]};});
  try{
    const headers={'x-test-owner':'yes'};
    const r=await fetch(f.base+'/api/ops/bookings',{headers});const body=await r.json();
    assert.equal(r.status,200);assert.equal(body.source,'sidra_database');
    assert.equal(body.records.length,0);
    assert.ok(calls[0].path.startsWith('/rest/v1/sidra_ops_bookings?'));
    assert.equal(calls[0].config.token,'test-owner-token');
    assert.equal((await fetch(f.base+'/api/ops/not-real',{headers})).status,404);
  }finally{await f.close();}
});
test('RLS or unavailable database must fail closed not return fictitious zero rows',async()=>{
  const f=await fixture(async()=>({ok:false,status:404,data:{message:'table not found'}}));
  try{const r=await fetch(f.base+'/api/ops/bookings',{headers:{'x-test-owner':'yes'}});assert.equal(r.status,503);assert.equal((await r.json()).source,'unavailable');}finally{await f.close();}
});
test('enquiry insert requires origin, validates and only stores controlled fields',async()=>{
  const writes=[];
  const f=await fixture(async(path,config)=>{writes.push({path,config});return {ok:true,data:[{id:'8b82da8e-4747-4f1f-aad2-e5802f5dc4cf',status:'new'}]};});
  try{
    const payload={customerName:'Test Client',customerEmail:'client@example.net',service:'flights',message:'Please quote a return flight to Doha.',status:'ticket_issued',secret:'injected'};
    const headers={'x-test-owner':'yes','content-type':'application/json'};
    assert.equal((await fetch(f.base+'/api/ops/enquiries',{method:'POST',headers,body:JSON.stringify(payload)})).status,403);
    const r=await fetch(f.base+'/api/ops/enquiries',{method:'POST',headers:{...headers,origin:'https://admin.sidra-tourism.com'},body:JSON.stringify(payload)});
    assert.equal(r.status,201);assert.equal(writes.length,1);
    assert.equal(writes[0].config.data.status,'new');
    assert.ok(!Object.hasOwn(writes[0].config.data,'secret'));
    assert.equal(writes[0].config.headers.Prefer,'return=representation');
  }finally{await f.close();}
});
test('experience drafts cannot publish prices or automatically confirm tours',async()=>{
  const writes=[];
  const f=await fixture(async(path,config)=>{writes.push(config.data);return {ok:true,data:[{id:'a8a5c494-e97b-4b63-8f4f-2a0d3a04c04f',status:'draft'}]};});
  try{
    const r=await fetch(f.base+'/api/ops/experiences',{method:'POST',headers:{'x-test-owner':'yes',origin:'https://admin.sidra-tourism.com','content-type':'application/json'},body:JSON.stringify({title:'Guided Qatar Inland Sea sightseeing',location:'Khor Al Adaid',duration:'Half-day guided trip',summary:'See the desert coast with an experienced licensed local guide.',price:1,bookingEnabled:true,status:'published'})});
    assert.equal(r.status,201);assert.equal(writes[0].status,'draft');assert.ok(!('price' in writes[0]));assert.ok(!('bookingEnabled' in writes[0]));
  }finally{await f.close();}
});
test('posting a live flight booking is explicitly disabled',async()=>{
  const f=await fixture(async()=>{throw Error('never call supplier')});
  try{const r=await fetch(f.base+'/api/ops/bookings',{method:'POST',headers:{'x-test-owner':'yes',origin:'https://admin.sidra-tourism.com','content-type':'application/json'},body:'{}'});assert.equal(r.status,403);}finally{await f.close();}
});
test('notification updates cannot accept arbitrary status or fields',async()=>{
  const writes=[];
  const f=await fixture(async(path,config)=>{writes.push(config);return {ok:true,data:[{id:'8b82da8e-4747-4f1f-aad2-e5802f5dc4cf',read_at:'2026-11-16T00:00:00Z'}]};});
  try{
    const r=await fetch(f.base+'/api/ops/notifications/8b82da8e-4747-4f1f-aad2-e5802f5dc4cf/read',{method:'PATCH',headers:{'x-test-owner':'yes',origin:'https://admin.sidra-tourism.com','content-type':'application/json'},body:JSON.stringify({status:'ticket_issued'})});
    assert.equal(r.status,200);assert.deepEqual(Object.keys(writes[0].data),['read_at']);
  }finally{await f.close();}
});
