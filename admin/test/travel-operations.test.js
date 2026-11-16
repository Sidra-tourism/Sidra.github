import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionFlightBooking,shouldSendTicketEmail,nextOperationalActions,validateExperienceDraft,validateEnquiryDraft,assertSafeRateStatus} from '../travel-operations.js';

test('payment successful alone cannot issue ticket or claim confirmed',()=>{
  const result=transitionFlightBooking({status:'payment_pending',reference:null}, {type:'payment.succeeded',id:'evt1',verified:true});
  assert.equal(result.status,'payment_confirmed');
  assert.equal(shouldSendTicketEmail(result),false);
  assert.equal(nextOperationalActions(result).includes('notify_admin'),true);
});
test('supplier booking created and pending ticket events preserve pending status',()=>{
  const a=transitionFlightBooking({status:'payment_confirmed',reference:null},{type:'supplier.booking_created',id:'evt2',verified:true,bookingReference:'ABC123'});
  assert.equal(a.status,'supplier_pending');
  const b=transitionFlightBooking(a,{type:'supplier.ticket_pending',id:'evt3',verified:true});
  assert.equal(b.status,'ticket_pending');
  assert.equal(shouldSendTicketEmail(b),false);
});
test('ticket email requires verified supplier-issued confirmation and ticket number',()=>{
  const pending={status:'ticket_pending',reference:'ABC123'};
  assert.throws(()=>transitionFlightBooking(pending,{type:'supplier.ticket_issued',id:'evt4',verified:false,ticketNumber:'1234567890123'}),/verified/i);
  assert.throws(()=>transitionFlightBooking(pending,{type:'supplier.ticket_issued',id:'evt4',verified:true}),/ticket/i);
  const issued=transitionFlightBooking(pending,{type:'supplier.ticket_issued',id:'evt4',verified:true,ticketNumber:'1234567890123'});
  assert.equal(issued.status,'ticket_issued');
  assert.equal(issued.ticketNumber,'1234567890123');
  assert.equal(shouldSendTicketEmail(issued),true);
  assert.ok(nextOperationalActions(issued).includes('send_customer_ticket_notice'));
});
test('an event cannot skip booking stages or replace a completed ticket',()=>{
  assert.throws(()=>transitionFlightBooking({status:'payment_pending'}, {type:'supplier.ticket_issued',id:'e1',verified:true,ticketNumber:'1234567890123'}),/transition/i);
  assert.throws(()=>transitionFlightBooking({status:'ticket_issued',ticketNumber:'1234567890123'}, {type:'payment.succeeded',id:'e2',verified:true}),/transition/i);
});
test('duplicate external events are recognized rather than repeated',()=>{
  const booking={status:'payment_pending',lastEventId:'evt1'};
  const result=transitionFlightBooking(booking,{type:'payment.succeeded',id:'evt1',verified:true});
  assert.equal(result,booking);
});
test('unverified and unsupported events are rejected',()=>{
  assert.throws(()=>transitionFlightBooking({status:'payment_pending'},{type:'payment.succeeded',id:'x',verified:false}),/verified/i);
  assert.throws(()=>transitionFlightBooking({status:'payment_pending'},{type:'something.else',id:'x',verified:true}),/unsupported/i);
});
test('desert packages are safe enquiry-only drafts, not fake booked inventory',()=>{
  const x=validateExperienceDraft({title:'Qatar Inland Sea guided sightseeing',location:'Khor Al Adaid',summary:'Nature views and guided coastal sightseeing with a licensed local operator.',duration:'Half day'});
  assert.equal(x.status,'draft');
  assert.equal(x.bookingEnabled,false);
  assert.equal(x.priceVerified,false);
  assert.throws(()=>validateExperienceDraft({title:'A',location:'Doha',summary:'Short',duration:''}),/title|summary|duration/i);
});
test('new enquiries require verifiable service type and contact fields',()=>{
  const e=validateEnquiryDraft({customerName:'Test Guest',customerEmail:'guest@example.org',service:'experiences',message:'We need a private sightseeing tour.'});
  assert.equal(e.status,'new');
  assert.equal(e.service,'experiences');
  for(const data of [{...e,customerEmail:'notanemail'},{...e,service:'unknown'},{...e,message:''}])
    assert.throws(()=>validateEnquiryDraft(data));
});
test('only explicitly verified live inventory can be presented as real',()=>{
  assert.equal(assertSafeRateStatus({environment:'sandbox',providerApproved:false}).publicBookable,false);
  assert.equal(assertSafeRateStatus({environment:'production',providerApproved:false}).publicBookable,false);
  assert.equal(assertSafeRateStatus({environment:'production',providerApproved:true,ticketingApproved:true}).publicBookable,true);
});
