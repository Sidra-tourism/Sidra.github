import {timingSafeEqual} from 'node:crypto';

/** Validate Nuitée's configured Authorization Token; never infer trust from JSON. */
export function verifyNuiteeWebhookToken(authHeader,configuredToken){
  if(typeof configuredToken!=='string'||configuredToken.length<24||configuredToken.length>512)return false;
  if(typeof authHeader!=='string'||authHeader.length!==configuredToken.length)return false;
  return timingSafeEqual(Buffer.from(authHeader,'utf8'),Buffer.from(configuredToken,'utf8'));
}
const flightEvents=Object.freeze({
  'flight.book.created':'supplier_pending',
  'flight.book.pending.confirmation':'ticket_pending',
  'flight.book.confirmed':'supplier_confirmed_unverified',
  'flight.book.cancelled':'supplier_cancelled_unverified',
  'flight.book.schedule_changed':'schedule_update_unverified',
  'flight.book.provider_notification':'supplier_update_unverified'
});
function decode(v,label,maxLength){
  if(typeof v!=='string'||v.length>maxLength)throw Error('Invalid '+label+' webhook field');
  try{return JSON.parse(v);}catch{throw Error('Invalid '+label+' JSON field');}
}
export function parseNuiteeWebhookEvent(body,{authenticated=false,expectedSandbox}={}){
  if(authenticated!==true)throw Error('Webhook authentication must be verified by the server before parsing');
  if(typeof expectedSandbox!=='boolean')throw Error('Expected environment not configured');
  const event=typeof body==='string'?decode(body,'envelope',200_000):body;
  if(!event||typeof event!=='object'||Array.isArray(event))throw Error('Invalid event envelope');
  if(typeof event.event_id!=='string'||!/^[-_a-zA-Z0-9]{8,160}$/.test(event.event_id))throw Error('Invalid event_id');
  if(typeof event.event_name!=='string'||!Object.hasOwn(flightEvents,event.event_name))throw Error('Unsupported flight webhook event');
  if(typeof event.sandbox!=='boolean'||event.sandbox!==expectedSandbox)throw Error('Webhook environment does not match');
  const request=decode(event.request,'request',70_000);
  const response=decode(event.response,'response',70_000);
  if(!response||typeof response!=='object'||Array.isArray(response)||typeof response.bookingId!=='string'||response.bookingId.length<4||response.bookingId.length>160)throw Error('Missing supplier booking identifier');
  if(request!==null&&(typeof request!=='object'||Array.isArray(request)))throw Error('Invalid request object');
  // Do not issue tickets on unverified webhooks. A trusted backend must retrieve the
  // authoritative supplier booking, match IDs and payment, deduplicate event_id in DB,
  // and verify issued-ticket data before communicating a ticket to a customer.
  return Object.freeze({
    eventId:event.event_id,
    supplierEvent:event.event_name,
    bookingId:response.bookingId,
    sandbox:event.sandbox,
    proposedStatus:flightEvents[event.event_name],
    requiresSupplierRecheck:true,
    sendTicketEmail:false
  });
}
