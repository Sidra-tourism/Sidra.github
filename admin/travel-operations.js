/** Travel operations rules for Sidra. Pure module: no payment, airline or mail side effects. */
const rules=Object.freeze({
  payment_pending:{'payment.succeeded':'payment_confirmed','payment.failed':'payment_failed'},
  payment_confirmed:{'supplier.booking_created':'supplier_pending','supplier.booking_failed':'failed'},
  supplier_pending:{'supplier.ticket_pending':'ticket_pending','supplier.ticket_issued':'ticket_issued','supplier.booking_failed':'failed'},
  ticket_pending:{'supplier.ticket_issued':'ticket_issued','supplier.booking_failed':'failed'},
  ticket_issued:{'payment.refunded':'refunded'},
  failed:{'payment.refunded':'refunded'},
  payment_failed:{},
  refunded:{}
});
const error=(msg)=>{const e=new Error(msg);e.status=422;return e};
function limited(value,max=160){return typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';}
export function transitionFlightBooking(booking,event){
  if(!booking||typeof booking!=='object'||!event||typeof event!=='object')throw error('Booking and event required');
  if(!event.id||typeof event.id!=='string'||event.id.length>160)throw error('Event reference required');
  if(booking.lastEventId===event.id)return booking;
  if(event.verified!==true)throw error('Only verified payment or supplier events can change booking status');
  if(!Object.hasOwn(rules,booking.status)||!Object.values(rules).some(row=>Object.hasOwn(row,event.type)))throw error('Unsupported event type or booking status');
  const target=rules[booking.status][event.type];
  if(!target)throw error('Illegal booking status transition');
  if(event.type==='supplier.ticket_issued'){
    if(!/^[0-9]{10,15}$/.test(String(event.ticketNumber||'')))throw error('Supplier-issued ticket number required');
    if(!/^[A-Za-z0-9]{4,12}$/.test(String(booking.reference||event.bookingReference||'')))throw error('Supplier booking reference required');
  }
  const result={...booking,status:target,lastEventId:event.id,updatedAt:new Date().toISOString()};
  if(event.bookingReference&&/^[A-Za-z0-9]{4,12}$/.test(event.bookingReference))result.reference=event.bookingReference;
  if(event.type==='supplier.ticket_issued')result.ticketNumber=event.ticketNumber;
  return result;
}
export function shouldSendTicketEmail(booking){
  return booking?.status==='ticket_issued'&&/^[A-Za-z0-9]{4,12}$/.test(String(booking.reference||''))&&
    /^[0-9]{10,15}$/.test(String(booking.ticketNumber||''));
}
export function nextOperationalActions(booking){
  if(shouldSendTicketEmail(booking))return ['notify_admin','send_customer_ticket_notice'];
  if(['payment_failed','failed','refunded'].includes(booking?.status))return ['notify_admin','review_refund_or_customer_contact'];
  if(['payment_confirmed','supplier_pending','ticket_pending'].includes(booking?.status))return ['notify_admin','monitor_supplier_confirmation'];
  return [];
}
const categories=new Set(['flights','hotels','cars','transfers','holidays','experiences','other']);
export function validateEnquiryDraft(input){
  const customerName=limited(input?.customerName,90),customerEmail=limited(input?.customerEmail,254).toLowerCase();
  const service=limited(input?.service,40),message=limited(input?.message,3000);
  if(customerName.length<2||customerName.length>90)throw error('Customer name is required');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail))throw error('Valid email required');
  if(!categories.has(service))throw error('Valid service category required');
  if(message.length<15)throw error('Message must be at least 15 characters');
  return {customer_name:customerName,customer_email:customerEmail,service,message,status:'new'};
}
export function validateExperienceDraft(input){
  const title=limited(input?.title,130),summary=limited(input?.summary,1200);
  const location=limited(input?.location,110),duration=limited(input?.duration,70);
  if(title.length<8||location.length<3||summary.length<30||duration.length<3)throw error('Valid title, location, summary and duration required');
  return {title,summary,location,duration,status:'draft',bookingEnabled:false,priceVerified:false};
}
export function assertSafeRateStatus(input={}){
  return {publicBookable:input.environment==='production'&&input.providerApproved===true&&input.ticketingApproved===true,
    disclaimer:'Prices and airline ticketing remain unavailable until production supplier approval and end-to-end verification.'};
}
