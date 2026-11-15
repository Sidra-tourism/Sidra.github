/* Sidra Tourism mobile-friendly enquiry forms: no live fares or checkout. */
import {localDateISO,addLocalDays,formatTravelDate,formatTravelRange,validLocalISO,validTravelRange} from './sidra-date-utils.mjs?v=20261116c';

const $=id=>document.getElementById(id);
const value=id=>String($(id)?.value||'').trim();
const today=()=>localDateISO(new Date());
const msg=(id,info)=>{const n=$(id);if(n)n.textContent=info;};
const quote=(title,fields)=>{
  // The established Sidra WhatsApp enquiry is not a confirmed booking.
  if(typeof window.sendWhatsApp==='function')window.sendWhatsApp(title,fields.join('\n'));
};
function setDate(id,days){
  const input=$(id);if(!input)return;
  input.min=today();
  if(!input.value)input.value=addLocalDays(today(),days);
}
function pair(a,b,offset=1,stay=2){
  setDate(a,offset);setDate(b,offset+stay);
  const from=$(a),to=$(b);if(!from||!to)return;
  const refresh=()=>{
    from.min=today();to.min=from.value||today();
    if(to.value&&to.value<to.min)to.value=to.min;
  };
  from.addEventListener('change',refresh);refresh();
}
function summary(a,b,id){
  const el=$(id);if(!el)return;
  const refresh=()=>{el.textContent=value(a)?formatTravelRange(value(a),b?value(b):''):'Choose dates';};
  $(a)?.addEventListener('change',refresh);
  if(b)$(b)?.addEventListener('change',refresh);
  refresh();
}
function addDateSummary(anchor,a,b,id){
  const node=document.createElement('output');
  node.className='sidra-travel-date-summary';node.id=id;
  node.setAttribute('aria-live','polite');
  $(anchor)?.closest('.field')?.insertAdjacentElement('beforebegin',node);
  summary(a,b,id);
}
function error(id,text){msg(id,text);return false;}
function validDate(v){return validLocalISO(v)&&v>=today();}

function enhanceFlights(){
  const form=$('normalTrip');if(!form)return;
  form.classList.add('sidra-flight-grid');
  ['fromCity','toCity'].forEach(id=>{
    const input=$(id);
    input.placeholder='City or airport';
    input.closest('.field')?.classList.add('sidra-airport-field','sidra-mobile-field');
    input.addEventListener('blur',()=>{
      const code=input.value.trim().toUpperCase();
      const airport=window.sidraAirportChoices?.find(airport=>airport[2]===code);
      if(airport&&typeof window.selectAirport==='function')window.selectAirport(id,airport[2]);
    });
  });
  ['fromCountry','toCountry'].forEach(id=>$(id)?.closest('.field')?.classList.add('sidra-internal-country'));
  $('departureDate')?.closest('.field')?.classList.add('sidra-mobile-field');
  $('returnDate')?.closest('.field')?.classList.add('sidra-mobile-field');
  $('paxText')?.closest('.field')?.classList.add('sidra-mobile-field');
  const message=document.createElement('button');message.className='sidra-manual-airport';
  message.type='button';message.textContent="Can't find your airport? Enter details manually";
  message.setAttribute('aria-expanded','false');form.insertAdjacentElement('beforebegin',message);
  message.addEventListener('click',()=>{
    const show=message.getAttribute('aria-expanded')!=='true';
    form.classList.toggle('show-manual-airport',show);
    message.setAttribute('aria-expanded',String(show));
    message.textContent=show?'Hide manual airport fields':"Can't find your airport? Enter details manually";
  });
  pair('departureDate','returnDate',1,3);
  addDateSummary('departureDate','departureDate','returnDate','flightDatesSummary');
  const refreshFlightSummary=()=>{
    const selected=tripTabs?.querySelector('[data-trip].active')?.dataset.trip||'oneway';
    const departure=value('departureDate'),ret=selected==='roundtrip'?value('returnDate'):'';
    $('flightDatesSummary').textContent=departure?formatTravelRange(departure,ret):'Choose dates';
  };
  // This closure is called after tripTabs has been initialized below.
  ['departureDate','returnDate'].forEach(id=>$(id)?.addEventListener('change',refreshFlightSummary));
  const pax=$('paxBox')?.closest('.field');
  const cabin=document.createElement('div');cabin.className='field sidra-flight-cabin sidra-mobile-field';
  cabin.innerHTML='<label for="sidraFlightCabin">Cabin class</label><select id="sidraFlightCabin"><option>Economy</option><option>Premium economy</option><option>Business</option><option>First class</option></select>';
  pax?.insertAdjacentElement('afterend',cabin);
  const tripTabs=document.querySelector('#flightArea .trip-tabs');
  tripTabs?.setAttribute('role','group');tripTabs?.setAttribute('aria-label','Trip type');
  const label={oneway:'One-way',roundtrip:'Roundtrip',multicity:'Multi-city'};
  tripTabs?.querySelectorAll('[data-trip]').forEach(el=>{
    el.textContent=label[el.dataset.trip]||el.textContent;
    el.dataset.sidraTrip=el.dataset.trip;
    el.tabIndex=0;el.setAttribute('role','button');
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});
    el.addEventListener('click',refreshFlightSummary);
  });
  refreshFlightSummary();
  const swap=document.createElement('button');swap.className='sidra-airport-swap';swap.type='button';
  swap.textContent='⇅';swap.setAttribute('aria-label','Swap departure and destination airports');
  $('toCity')?.closest('.field')?.append(swap);
  swap.addEventListener('click',()=>{
    for(const [a,b] of [['fromCity','toCity'],['fromCountry','toCountry']]){
      const temp=$(a).value;$(a).value=$(b).value;$(b).value=temp;
      $(a).dispatchEvent(new Event('input',{bubbles:true}));
      $(b).dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  const counter=()=>{
    const a=Number($('adultCount')?.textContent||1),c=Number($('childCount')?.textContent||0);
    if($('paxText'))$('paxText').textContent=(a+c)+' traveler'+(a+c===1?'':'s')+' · '+value('sidraFlightCabin');
  };
  $('paxBox')?.addEventListener('click',counter);
  $('sidraFlightCabin')?.addEventListener('change',counter);
  counter();
}
function enhanceHotels(){
  const area=$('hotelArea');area?.classList.add('sidra-mobile-stack');
  $('hotelDestination')?.closest('.field')?.classList.add('sidra-mobile-field');
  $('hotelGuestTrigger')?.classList.add('sidra-mobile-field');
  pair('checkIn','checkOut',1,2);
  addDateSummary('checkIn','checkIn','checkOut','hotelDatesSummary');
}
function enhanceCars(){
  const section=$('carArea')?.querySelector('[data-car-section="rent"]');
  if(!section)return;
  section.classList.add('sidra-mobile-stack');
  const pickup=$('pickupLocation')?.closest('.field');
  pickup?.classList.add('sidra-mobile-field');
  pickup?.insertAdjacentHTML('afterend',[
    '<div class="field sidra-mobile-field sidra-car-dropoff">',
    '<label for="sidraCarDropoffLocation">Drop-off location</label>',
    '<input id="sidraCarDropoffLocation" placeholder="Same as pickup" maxlength="140">',
    '<label class="sidra-same-place"><input type="checkbox" id="sidraCarSameLocation" checked> Same as pickup</label>',
    '</div>'
  ].join(''));
  const checkbox=$('sidraCarSameLocation'),drop=$('sidraCarDropoffLocation');
  const refresh=()=>{drop.disabled=checkbox.checked;drop.value=checkbox.checked?'':drop.value;drop.placeholder=checkbox.checked?'Same as pickup':'Enter a drop-off location';};
  checkbox?.addEventListener('change',refresh);refresh();
  $('carPickupTime')?.closest('.field')?.insertAdjacentHTML('afterend',[
    '<div class="field sidra-mobile-field"><label for="sidraCarDropoffTime">Drop-off time</label>',
    '<input id="sidraCarDropoffTime" type="time"></div>'
  ].join(''));
  $('carPickupTime').value ||= '10:30';$('sidraCarDropoffTime').value ||= '10:30';
  pair('pickupDate','dropoffDate',1,2);
  addDateSummary('pickupDate','pickupDate','dropoffDate','carDatesSummary');
  setDate('transportDate',1);
  $('transportTime').value ||= '10:30';
  $('carArea')?.querySelectorAll('[data-car-mode]').forEach(button=>{
    button.textContent=button.dataset.carMode==='rent'?'Rental cars':'Airport transportation';
  });
}
function setupPackages(){
  const area=$('holidayArea');if(!area)return;
  area.classList.add('sidra-booking-form','sidra-package-form');
  area.innerHTML=[
    '<div class="sidra-package-components" role="group" aria-label="Choose package inclusions">',
      '<button type="button" data-sidra-package-component="stay" aria-pressed="true" class="active">Stay added ✓</button>',
      '<button type="button" data-sidra-package-component="flight" aria-pressed="true" class="active">Flight added ✓</button>',
      '<button type="button" data-sidra-package-component="car" aria-pressed="false">Car</button>',
    '</div>',
    '<div class="sidra-package-trip" role="group" aria-label="Package trip type"><strong>Flight</strong>',
      '<button type="button" data-sidra-trip="roundtrip" aria-pressed="true" class="active">◉ Roundtrip</button>',
      '<button type="button" data-sidra-trip="oneway" aria-pressed="false">◯ One-way</button>',
    '</div>',
    '<div class="sidra-package-fields">',
      '<div class="field sidra-mobile-field sidra-package-flight"><label for="sidraPackageFrom">Leaving from</label><input id="sidraPackageFrom" placeholder="Departure city or airport" maxlength="120"></div>',
      '<div class="field sidra-mobile-field sidra-package-flight"><label for="sidraPackageTo">Going to</label><input id="sidraPackageTo" placeholder="Destination" maxlength="120"></div>',
      '<div class="field sidra-mobile-field"><label for="sidraPackageDepart">Travel from</label><input id="sidraPackageDepart" type="date"></div>',
      '<div class="field sidra-mobile-field sidra-package-return"><label for="sidraPackageReturn">Travel until</label><input id="sidraPackageReturn" type="date"></div>',
      '<output id="sidraPackageDatesSummary" class="sidra-travel-date-summary"></output>',
      '<div class="field sidra-mobile-field sidra-package-flight"><label for="sidraPackageCabin">Cabin class</label><select id="sidraPackageCabin"><option>Economy</option><option>Premium economy</option><option>Business</option><option>First class</option></select></div>',
      '<h3 class="sidra-subheading sidra-package-stay">Stay</h3>',
      '<div class="field sidra-mobile-field sidra-package-stay"><label for="sidraPackageStay">Going to</label><input id="sidraPackageStay" placeholder="Hotel, city or area" maxlength="120"></div>',
      '<div class="field sidra-mobile-field sidra-package-stay"><label for="sidraPackageRooms">Rooms</label><select id="sidraPackageRooms"><option value="1">1 room</option><option value="2">2 rooms</option><option value="3">3 rooms</option><option value="4">4 rooms</option><option value="5">5 rooms</option></select></div>',
      '<h3 class="sidra-subheading">Travelers</h3>',
      '<div class="field sidra-mobile-field"><label for="sidraPackageTravelers">Travelers</label><select id="sidraPackageTravelers"><option value="1">1 traveler</option><option value="2" selected>2 travelers</option><option value="3">3 travelers</option><option value="4">4 travelers</option><option value="5">5 travelers</option><option value="6">6 travelers</option><option value="7">7 travelers</option><option value="8">8 travelers</option></select></div>',
    '</div>',
    '<p id="sidraPackageError" role="status" aria-live="polite" class="ota-form-error"></p>',
    '<button type="button" id="sidraPackageSearch" class="search-btn">Search</button>'
  ].join('');
  const chosen={stay:true,flight:true,car:false};let tripType='roundtrip';
  const redraw=()=>{
    area.querySelectorAll('[data-sidra-package-component]').forEach(b=>{
      const type=b.dataset.sidraPackageComponent,on=chosen[type],title={stay:'Stay',flight:'Flight',car:'Car'}[type];
      b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.textContent=title+(on?' added ✓':'');
    });
    area.querySelectorAll('.sidra-package-flight').forEach(el=>el.hidden=!chosen.flight);
    area.querySelectorAll('.sidra-package-stay').forEach(el=>el.hidden=!chosen.stay);
    area.querySelectorAll('.sidra-package-return').forEach(el=>el.hidden=tripType==='oneway');
    summary('sidraPackageDepart',tripType==='oneway'?null:'sidraPackageReturn','sidraPackageDatesSummary');
  };
  area.addEventListener('click',e=>{
    const c=e.target.closest('[data-sidra-package-component]');
    if(c){chosen[c.dataset.sidraPackageComponent]=!chosen[c.dataset.sidraPackageComponent];redraw();return;}
    const t=e.target.closest('.sidra-package-trip [data-sidra-trip]');
    if(t){tripType=t.dataset.sidraTrip;area.querySelectorAll('.sidra-package-trip button').forEach(x=>{
      const active=x===t;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));
    });redraw();}
  });
  pair('sidraPackageDepart','sidraPackageReturn',1,3);redraw();
  $('sidraPackageSearch').addEventListener('click',()=>{
    msg('sidraPackageError','');
    if(!Object.values(chosen).some(Boolean))return error('sidraPackageError','Select at least one service.');
    const d=value('sidraPackageDepart'),r=value('sidraPackageReturn');
    if(!validDate(d)||tripType==='roundtrip'&&!validTravelRange(d,r,today()))
      return error('sidraPackageError','Select valid travel dates.');
    const from=value('sidraPackageFrom'),to=value('sidraPackageTo'),stay=value('sidraPackageStay');
    if(chosen.flight&&(from.length<2||to.length<2||from.toLowerCase()===to.toLowerCase()))
      return error('sidraPackageError','Enter departure and destination cities.');
    if(chosen.stay&&stay.length<2)return error('sidraPackageError','Enter the hotel or area for your stay.');
    quote('Holiday package quotation request',[
      'Services: '+Object.keys(chosen).filter(k=>chosen[k]).join(', '),
      ...(chosen.flight?['Flying: '+from+' to '+to,'Trip: '+tripType,'Cabin: '+value('sidraPackageCabin')]:[]),
      'Starting: '+d,...(tripType==='roundtrip'?['Until: '+r]:[]),
      ...(chosen.stay?['Stay: '+stay,'Rooms: '+value('sidraPackageRooms')]:[]),
      'Travelers: '+value('sidraPackageTravelers')
    ]);
  });
}
function setupExperiences(){
  const area=$('experiencesArea');if(!area)return;
  area.classList.add('sidra-booking-form','sidra-extension-form');
  area.innerHTML=[
    '<p class="sidra-context">Concerts, sports & activities — tell us your preferred destination and dates.</p>',
    '<div class="field sidra-mobile-field"><label for="experiencesDestination">Going to</label><input id="experiencesDestination" placeholder="City or destination" maxlength="120"></div>',
    '<div class="field sidra-mobile-field"><label for="sidraExperienceFrom">From date</label><input id="sidraExperienceFrom" type="date"></div>',
    '<div class="field sidra-mobile-field"><label for="sidraExperienceTo">To date</label><input id="sidraExperienceTo" type="date"></div>',
    '<output class="sidra-travel-date-summary" id="experienceDateSummary"></output>',
    '<p class="ota-form-error" id="experienceError" role="status" aria-live="polite"></p>',
    '<button type="button" class="search-btn" id="sidraExperienceSearch">Search</button>'
  ].join('');
  pair('sidraExperienceFrom','sidraExperienceTo',1,1);
  summary('sidraExperienceFrom','sidraExperienceTo','experienceDateSummary');
  $('sidraExperienceSearch').addEventListener('click',()=>{
    msg('experienceError','');
    const place=value('experiencesDestination'),from=value('sidraExperienceFrom'),to=value('sidraExperienceTo');
    if(place.length<2||!validTravelRange(from,to,today()))return error('experienceError','Enter a destination and valid dates.');
    quote('Experiences quotation request',['Going to: '+place,'From: '+from,'To: '+to]);
  });
}
function setupCruises(){
  const area=$('cruisesArea');if(!area)return;
  area.classList.add('sidra-booking-form','sidra-extension-form');
  area.innerHTML=[
    '<p class="sidra-context">Planning a cruise? Our team can check current sailing options.</p>',
    '<div class="field sidra-mobile-field"><label for="cruisesDestination">Going to</label><input id="cruisesDestination" placeholder="Cruise region or destination" maxlength="120"></div>',
    '<div class="field sidra-mobile-field"><label for="sidraCruiseDepartFrom">Departing between — from</label><input id="sidraCruiseDepartFrom" type="date"></div>',
    '<div class="field sidra-mobile-field"><label for="sidraCruiseDepartTo">Departing between — until</label><input id="sidraCruiseDepartTo" type="date"></div>',
    '<div class="field sidra-mobile-field"><label for="sidraCruiseDuration">Cruise duration</label><select id="sidraCruiseDuration"><option>3–9 nights</option><option>1–2 nights</option><option>10–14 nights</option><option>15+ nights</option></select></div>',
    '<output class="sidra-travel-date-summary" id="cruiseDateSummary"></output>',
    '<p class="ota-form-error" id="cruiseError" role="status" aria-live="polite"></p>',
    '<button type="button" class="search-btn" id="sidraCruiseSearch">Search</button>'
  ].join('');
  pair('sidraCruiseDepartFrom','sidraCruiseDepartTo',1,14);
  summary('sidraCruiseDepartFrom','sidraCruiseDepartTo','cruiseDateSummary');
  $('sidraCruiseSearch').addEventListener('click',()=>{
    msg('cruiseError','');
    const place=value('cruisesDestination'),a=value('sidraCruiseDepartFrom'),b=value('sidraCruiseDepartTo');
    if(place.length<2||!validTravelRange(a,b,today()))return error('cruiseError','Enter your destination and valid departure dates.');
    quote('Cruise quotation request',['Going to: '+place,'Departing between: '+a+' and '+b,'Cruise duration: '+value('sidraCruiseDuration')]);
  });
}
function initialize(){
  document.body.classList.add('sidra-mobile-search-ready');
  enhanceFlights();enhanceHotels();enhanceCars();setupPackages();setupExperiences();setupCruises();
  // Allow safe deep links to a selected search category for QA and customer sharing.
  const category=new URLSearchParams(window.location.search).get('category');
  if(['flights','hotels','cars','holidays','experiences','cruises'].includes(category)&&typeof window.switchMain==='function')
    window.switchMain(category,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
else initialize();
