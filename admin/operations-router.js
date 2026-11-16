import express from 'express';
import {validateEnquiryDraft,validateExperienceDraft} from './travel-operations.js';

/** Owner-only, user-scoped Supabase PostgREST access. No service-role credentials. */
const entities=Object.freeze({
 enquiries:'sidra_ops_enquiries',
 bookings:'sidra_ops_bookings',
 customers:'sidra_ops_customers',
 payments:'sidra_ops_payments',
 suppliers:'sidra_ops_suppliers',
 notifications:'sidra_ops_notifications',
 experiences:'sidra_ops_experiences',
 audit:'sidra_ops_audit'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const q=(name)=>'/rest/v1/'+entities[name];
const reject=(res,code,message)=>res.status(code).json({error:message});
const supplierFailure=(res)=>res.status(503).json({source:'unavailable',error:'Sidra operational database is not yet available or access was not authorized'});
function checkedOwner(req,res,next){
  if(req.owner?.profile?.must_change_password)return reject(res,403,'Change administrator password first');
  next();
}
export function createOperationsRouter({provider,ownerOnly,checkWriteOrigin}){
  if(typeof provider!=='function'||typeof ownerOnly!=='function'||typeof checkWriteOrigin!=='function')throw new Error('Required operations dependencies missing');
  const router=express.Router();
  router.use(ownerOnly,checkedOwner);
  router.get('/integrations',(_req,res)=>res.json({
    checkedAt:'2026-11-16',
    source:'implementation_review',
    suppliers:[
      {name:'Nuitée Connect · Hotels',product:'hotels',state:'sandbox_verified',detail:'Account has production capability, but live Sidra hotel search and booking were not verified.'},
      {name:'Nuitée Connect · Flights',product:'flights',state:'production_access_pending',detail:'Sandbox available; production entitlement and ticketing confirmation not verified.'},
      {name:'IATA / IATAN',product:'accreditation',state:'agency_permissions_pending',detail:'Director identification presented; agency BSP, ticketing and logo entitlement still need independent confirmation.'},
      {name:'Customer payments',product:'finance',state:'not_integrated',detail:'No verified checkout-to-supplier booking or refund reconciliation in Sidra.'},
      {name:'Customer notifications',product:'communications',state:'not_integrated',detail:'Customer ticket email, delivery and admin event notifications must be verified end to end.'}
    ],liveTicketingEnabled:false,liveBookingEnabled:false
  }));
  router.get('/summary',async(req,res)=>{
    const keys=['enquiries','bookings','notifications','experiences'];
    const results=await Promise.all(keys.map(async key=>{
      const result=await provider(q(key)+'?select=id&limit=100',{token:req.ownerToken});
      return [key,result];
    }));
    if(results.some(([,r])=>!r.ok||!Array.isArray(r.data)))return supplierFailure(res);
    const counts=Object.fromEntries(results.map(([key,r])=>[key,r.data.length]));
    return res.json({source:'sidra_database',counts,countsAre:'up_to_100_records_per_module',liveTicketingEnabled:false,bookingPaymentEnabled:false});
  });
  router.get('/:entity',async(req,res)=>{
    const entity=String(req.params.entity||'');
    if(!Object.hasOwn(entities,entity))return reject(res,404,'Module not found');
    const result=await provider(q(entity)+'?select=*&order=created_at.desc&limit=50',{token:req.ownerToken});
    if(!result.ok||!Array.isArray(result.data))return supplierFailure(res);
    return res.json({source:'sidra_database',entity,records:result.data,readOnly:!['enquiries','experiences','notifications'].includes(entity)});
  });
  router.post('/bookings',checkWriteOrigin,(_req,res)=>reject(res,403,'Flight and hotel bookings cannot be issued from this workspace until supplier activation is verified'));
  router.post('/enquiries',checkWriteOrigin,async(req,res)=>{
    let body;
    try{body=validateEnquiryDraft(req.body)}catch(e){return reject(res,422,e.message);}
    const result=await provider(q('enquiries')+'?select=*',{method:'POST',token:req.ownerToken,headers:{Prefer:'return=representation'},data:body});
    if(!result.ok||!Array.isArray(result.data))return supplierFailure(res);
    return res.status(201).json({source:'sidra_database',record:result.data[0]||null});
  });
  router.post('/experiences',checkWriteOrigin,async(req,res)=>{
    let candidate;
    try{candidate=validateExperienceDraft(req.body)}catch(e){return reject(res,422,e.message);}
    const {title,summary,location,duration,status}=candidate;
    const result=await provider(q('experiences')+'?select=*',{method:'POST',token:req.ownerToken,headers:{Prefer:'return=representation'},data:{title,summary,location,duration,status}});
    if(!result.ok||!Array.isArray(result.data))return supplierFailure(res);
    return res.status(201).json({source:'sidra_database',record:result.data[0]||null});
  });
  router.patch('/enquiries/:id/status',checkWriteOrigin,async(req,res)=>{
    if(!UUID.test(req.params.id))return reject(res,422,'Invalid enquiry ID');
    const expected=String(req.body?.expectedStatus||'');
    const target=String(req.body?.status||'');
    if(!['new','reviewing','quoted'].includes(expected)||!['reviewing','quoted','closed'].includes(target))return reject(res,422,'Invalid enquiry workflow status');
    const notes=typeof req.body?.adminNotes==='string'?req.body.adminNotes.trim().slice(0,1200):'';
    const query=q('enquiries')+'?select=*&id=eq.'+encodeURIComponent(req.params.id)+'&status=eq.'+encodeURIComponent(expected);
    const result=await provider(query,{method:'PATCH',token:req.ownerToken,headers:{Prefer:'return=representation'},data:{status:target,admin_notes:notes,updated_at:new Date().toISOString()}});
    if(!result.ok||!Array.isArray(result.data))return supplierFailure(res);
    if(result.data.length===0)return reject(res,409,'Enquiry changed already. Reload before editing.');
    return res.json({record:result.data[0]});
  });
  router.patch('/notifications/:id/read',checkWriteOrigin,async(req,res)=>{
    if(!UUID.test(req.params.id))return reject(res,422,'Invalid notification ID');
    const result=await provider(q('notifications')+'?select=*&id=eq.'+encodeURIComponent(req.params.id),{
      method:'PATCH',token:req.ownerToken,headers:{Prefer:'return=representation'},data:{read_at:new Date().toISOString()}
    });
    if(!result.ok||!Array.isArray(result.data))return supplierFailure(res);
    if(result.data.length===0)return reject(res,404,'Notification not found');
    return res.json({record:result.data[0]});
  });
  router.use((_req,res)=>reject(res,404,'Operational action not found'));
  return router;
}
