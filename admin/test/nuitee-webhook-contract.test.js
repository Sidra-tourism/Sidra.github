import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNuiteeWebhookToken,parseNuiteeWebhookEvent} from '../nuitee-webhook-contract.js';

const event=(overrides={})=>({
  event_id:'evt_b26c7d80',
  event_name:'flight.book.confirmed',
  sandbox:true,
  request:JSON.stringify({prebookId:'sbx_prebook123'}),
  response:JSON.stringify({bookingId:'sbx_booking123',bookingRef:'ABC123',status:'CONFIRMED'}),
  ...overrides
});
test('shared token comparison rejects missing, mismatched and improperly prefixed values',()=>{
  const secret='long-unique-secret-with-entropy-12345';
  assert.equal(verifyNuiteeWebhookToken(secret,secret),true);
  assert.equal(verifyNuiteeWebhookToken('Bearer '+secret,secret),false);
  assert.equal(verifyNuiteeWebhookToken('',secret),false);
  assert.equal(verifyNuiteeWebhookToken('long-unique-secret-with-entropy-12346',secret),false);
  assert.equal(verifyNuiteeWebhookToken(secret,'short'),false);
});
test('webhook parsing needs trusted authorization completed by handler',()=>{
  assert.throws(()=>parseNuiteeWebhookEvent(event(),{authenticated:false,expectedSandbox:true}),/authentication/i);
});
test('dashboard sandbox events are never processed as real production notifications',()=>{
  assert.throws(()=>parseNuiteeWebhookEvent(event(),{authenticated:true,expectedSandbox:false}),/environment/i);
});
test('confirmed airline event still requires authoritative booking recheck before ticket message',()=>{
  const parsed=parseNuiteeWebhookEvent(event(),{authenticated:true,expectedSandbox:true});
  assert.equal(parsed.eventId,'evt_b26c7d80');
  assert.equal(parsed.bookingId,'sbx_booking123');
  assert.equal(parsed.supplierEvent,'flight.book.confirmed');
  assert.equal(parsed.requiresSupplierRecheck,true);
  assert.equal(parsed.sendTicketEmail,false);
});
test('incoming pending event is not upgraded to ticket issuance',()=>{
  const v=parseNuiteeWebhookEvent(event({event_name:'flight.book.pending.confirmation',response:JSON.stringify({bookingId:'sbx_booking123',status:'PENDING_CONFIRMATION'})}),{authenticated:true,expectedSandbox:true});
  assert.equal(v.proposedStatus,'ticket_pending');
  assert.equal(v.sendTicketEmail,false);
});
test('invalid or giant webhook envelopes fail closed',()=>{
  for(const x of [
    event({event_id:''}),
    event({event_name:'anything'}),
    event({request:'notjson'}),
    event({response:'notjson'}),
    event({sandbox:'false'}),
    event({response:JSON.stringify({status:'CONFIRMED'})}),
    event({response:' '.repeat(100_000)})
  ])assert.throws(()=>parseNuiteeWebhookEvent(x,{authenticated:true,expectedSandbox:true}));
});
test('hotel callbacks cannot be mistaken for airline ticketing',()=>{
  assert.throws(()=>parseNuiteeWebhookEvent(event({event_name:'booking.book'}),{authenticated:true,expectedSandbox:true}),/unsupported/i);
});
