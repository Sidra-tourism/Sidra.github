/* Sidra Tourism original OTA-style frontend (preview only; no client-side authentication). */
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const tabs = document.querySelector('.site-search .tabs');
  if (!tabs || !byId('hotelArea')) return;

  /* Static, reviewed markup only. Never place customer input into innerHTML. */
  tabs.classList.add('ota-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Choose your travel service');
  tabs.innerHTML = [
    '<button type="button" role="tab" aria-selected="true" class="tab ota-tab active" data-tab="flights" aria-label="Flights"><span class="ota-icon" aria-hidden="true">✈</span> Flights</button>',
    '<button type="button" role="tab" aria-selected="false" class="tab ota-tab" data-tab="hotels" aria-label="Hotels"><span class="ota-icon" aria-hidden="true">🏨</span> Hotels</button>',
    '<button type="button" role="tab" aria-selected="false" class="tab ota-tab" data-tab="holidays" aria-label="Holiday packages"><span class="ota-icon" aria-hidden="true">☀</span> Holidays</button>',
    '<button type="button" role="tab" aria-selected="false" class="tab ota-tab" data-tab="cars" aria-label="Car rentals"><span class="ota-icon" aria-hidden="true">🚗</span> Cars</button>'
  ].join('');

  const hotelArea = byId('hotelArea');
  hotelArea.classList.add('ota-hotel-grid');
  hotelArea.setAttribute('role', 'tabpanel');
  hotelArea.setAttribute('aria-label', 'Search hotels');
  hotelArea.innerHTML = [
    '<div class="field hotel-place"><label for="hotelDestination">Hotel name or destination</label><div class="ota-icon-input"><span aria-hidden="true">🏨</span><input id="hotelDestination" placeholder="City, area, or property name" maxlength="120" autocomplete="off"></div></div>',
    '<div class="field hotel-checkin"><label for="checkIn">Check-in date</label><input id="checkIn" type="date" required></div>',
    '<div class="field hotel-checkout"><label for="checkOut">Check-out date</label><input id="checkOut" type="date" required></div>',
    '<div class="field hotel-occupancy"><label id="hotelGuestLabel">Rooms and guests</label><button type="button" id="hotelGuestTrigger" class="ota-guest-trigger" aria-expanded="false" aria-controls="hotelGuestPanel"><span aria-hidden="true">♙</span><span id="hotelGuestSummary">2 adults · 1 room</span><span aria-hidden="true">⌄</span></button>',
    '<div id="hotelGuestPanel" class="hotel-guest-panel" hidden><div class="ota-popover-head"><strong>Guests and rooms</strong><button type="button" id="closeHotelGuests" aria-label="Close guests panel">✕</button></div>',
    '<div class="ota-counter-row"><div><strong>Adults</strong><small>18 years and over</small></div><div class="ota-counter"><button type="button" data-hotel-type="adults" data-hotel-step="-1" aria-label="Remove adult">−</button><strong id="hotelAdults">2</strong><button type="button" data-hotel-type="adults" data-hotel-step="1" aria-label="Add adult">+</button></div></div>',
    '<div class="ota-counter-row"><div><strong>Children</strong><small>Ages 0–17</small></div><div class="ota-counter"><button type="button" data-hotel-type="children" data-hotel-step="-1" aria-label="Remove child">−</button><strong id="hotelChildren">0</strong><button type="button" data-hotel-type="children" data-hotel-step="1" aria-label="Add child">+</button></div></div>',
    '<div id="hotelChildrenAges" class="hotel-age-list" aria-live="polite"></div>',
    '<div class="ota-counter-row"><div><strong>Rooms</strong><small>How many rooms?</small></div><div class="ota-counter"><button type="button" data-hotel-type="rooms" data-hotel-step="-1" aria-label="Remove room">−</button><strong id="hotelRooms">1</strong><button type="button" data-hotel-type="rooms" data-hotel-step="1" aria-label="Add room">+</button></div></div>',
    '<button type="button" id="hotelGuestsDone" class="ota-done">Done</button></div></div>',
    '<p id="hotelSearchError" class="ota-form-error" role="status" aria-live="polite"></p>',
    '<button type="button" class="search-btn ota-hotel-search">Search hotels</button>'
  ].join('');

  const holidayArea = document.createElement('div');
  holidayArea.id = 'holidayArea';
  holidayArea.className = 'grid ota-holiday-grid';
  holidayArea.style.display = 'none';
  holidayArea.setAttribute('role', 'tabpanel');
  holidayArea.setAttribute('aria-label', 'Holiday packages');
  holidayArea.innerHTML = [
    '<div class="field hotel-place"><label for="holidayDestination">Destination</label><input id="holidayDestination" placeholder="City or country" maxlength="120"></div>',
    '<div class="field"><label for="holidayStart">Travel from</label><input id="holidayStart" type="date"></div>',
    '<div class="field"><label for="holidayEnd">Travel until</label><input id="holidayEnd" type="date"></div>',
    '<button type="button" id="holidaySearchButton" class="search-btn">Request holiday quote</button>',
    '<p id="holidayError" class="ota-form-error" role="status" aria-live="polite"></p>'
  ].join('');
  hotelArea.insertAdjacentElement('afterend', holidayArea);

  /* Preserve the previous flights, airport validation, cars and quotation flow. */
  window.switchMain = (kind) => {
    if (!['flights', 'hotels', 'holidays', 'cars'].includes(kind)) return;
    tabs.querySelectorAll('.ota-tab').forEach((tab) => {
      const active = tab.dataset.tab === kind;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    byId('flightArea').style.display = kind === 'flights' ? 'block' : 'none';
    hotelArea.style.display = kind === 'hotels' ? 'grid' : 'none';
    holidayArea.style.display = kind === 'holidays' ? 'grid' : 'none';
    byId('carArea').style.display = kind === 'cars' ? 'grid' : 'none';
    if (location.hash !== '#flights') byId('flights').scrollIntoView({behavior:'smooth',block:'start'});
  };
  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('button[data-tab]');
    if (tab) window.switchMain(tab.dataset.tab);
  });
  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(tabs.querySelectorAll('button[data-tab]'));
    const index = buttons.indexOf(document.activeElement);
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    window.switchMain(buttons[next].dataset.tab);
  });

  const localToday = () => {
    const d = new Date(), p = n => String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  };
  for (const id of ['checkIn','checkOut','holidayStart','holidayEnd']) byId(id).min = localToday();
  const checkIn = byId('checkIn'), checkOut = byId('checkOut');
  checkIn.addEventListener('change', () => { checkOut.min = checkIn.value || localToday(); if (checkOut.value && checkOut.value <= checkIn.value) checkOut.value = ''; });
  byId('holidayStart').addEventListener('change', () => {
    const end = byId('holidayEnd'), start = byId('holidayStart').value;
    end.min = start || localToday(); if (end.value && end.value < start) end.value = '';
  });

  const guest = {adults:2, children:0, rooms:1};
  const guestPanel = byId('hotelGuestPanel'), guestButton = byId('hotelGuestTrigger');
  const closeGuests = () => { guestPanel.hidden = true; guestButton.setAttribute('aria-expanded', 'false'); };
  guestButton.addEventListener('click', () => {
    guestPanel.hidden = !guestPanel.hidden;
    guestButton.setAttribute('aria-expanded', String(!guestPanel.hidden));
  });
  byId('closeHotelGuests').addEventListener('click', closeGuests);
  byId('hotelGuestsDone').addEventListener('click', closeGuests);

  const limits = {adults:[1,16], children:[0,8], rooms:[1,8]};
  const renderGuests = () => {
    for (const kind of Object.keys(guest)) byId('hotel'+kind[0].toUpperCase()+kind.slice(1)).textContent = guest[kind];
    byId('hotelGuestSummary').textContent = guest.adults+' adult'+(guest.adults===1?'':'s')+
      (guest.children ? ', '+guest.children+' child'+(guest.children===1?'':'ren') : '')+
      ' · '+guest.rooms+' room'+(guest.rooms===1?'':'s');
    guestPanel.querySelectorAll('button[data-hotel-type]').forEach((button) => {
      const kind = button.dataset.hotelType;
      const count = guest[kind], delta = Number(button.dataset.hotelStep);
      button.disabled = delta < 0 ? count <= limits[kind][0] : count >= limits[kind][1];
    });
    const holder = byId('hotelChildrenAges');
    const current = Array.from(holder.querySelectorAll('select')).map(el=>el.value);
    holder.replaceChildren();
    for (let i=0; i<guest.children; i++) {
      const label = document.createElement('label'); label.textContent = 'Age of child '+(i+1);
      const select = document.createElement('select'); select.required = true; select.setAttribute('aria-label', 'Age of child '+(i+1));
      const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select age'; select.appendChild(placeholder);
      for(let a=0;a<=17;a++){const option=document.createElement('option'); option.value=String(a); option.textContent=a+' years'; select.appendChild(option);}
      select.value=current[i]||''; label.appendChild(select); holder.appendChild(label);
    }
  };
  guestPanel.addEventListener('click', (event) => {
    const control = event.target.closest('button[data-hotel-type]');
    if (!control) return;
    const kind = control.dataset.hotelType, delta = Number(control.dataset.hotelStep);
    if (!Object.hasOwn(guest,kind) || ![-1,1].includes(delta)) return;
    guest[kind] = Math.max(limits[kind][0],Math.min(limits[kind][1],guest[kind]+delta));
    renderGuests();
  });
  renderGuests();

  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) &&
    new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v;
  function validateHotelSearch() {
    const property = byId('hotelDestination').value.trim();
    const arrive = checkIn.value, leave = checkOut.value;
    const error = byId('hotelSearchError');
    error.textContent = '';
    if (property.length < 2) {error.textContent='Enter a city or hotel name.';byId('hotelDestination').focus();return null;}
    if (!validDate(arrive) || arrive < localToday() || !validDate(leave) || leave <= arrive) {
      error.textContent='Select valid check-in and later check-out dates.';return null;
    }
    const ages = Array.from(byId('hotelChildrenAges').querySelectorAll('select')).map(select=>select.value);
    if (ages.some(age => age === '')) {error.textContent='Choose the age of each child.';guestPanel.hidden=false;guestButton.setAttribute('aria-expanded','true');return null;}
    return {property, arrive, leave, adults:guest.adults, children:guest.children, rooms:guest.rooms, ages};
  }
  window.searchHotels = () => {
    const query = validateHotelSearch();
    if (!query) return;
    const description = 'Hotel / destination: '+query.property+'\nCheck-in: '+query.arrive+'\nCheck-out: '+query.leave+
      '\nAdults: '+query.adults+'\nChildren: '+query.children+
      (query.ages.length ? ' (ages: '+query.ages.join(', ')+')' : '')+'\nRooms: '+query.rooms;
    sendWhatsApp('Hotel quotation request', description);
  };
  hotelArea.querySelector('.ota-hotel-search').addEventListener('click',window.searchHotels);
  byId('holidaySearchButton').addEventListener('click', () => {
    const place=byId('holidayDestination').value.trim(), start=byId('holidayStart').value,end=byId('holidayEnd').value;
    const error=byId('holidayError'); error.textContent='';
    if(place.length<2||!validDate(start)||start<localToday()||!validDate(end)||end<start){
      error.textContent='Enter a destination and valid travel dates.';return;
    }
    sendWhatsApp('Holiday package quotation request','Destination: '+place+'\nFrom: '+start+'\nUntil: '+end);
  });
  document.addEventListener('click', (event) => {
    if(!event.target.closest('.hotel-occupancy'))closeGuests();
  });
  document.addEventListener('keydown', (event) => { if(event.key==='Escape')closeGuests(); });

  /* Visually preview the sign-in popover. Never send or persist input credentials. */
  const dialog = document.createElement('dialog'); dialog.id = 'quickSignIn'; dialog.className='ota-login-dialog';
  dialog.setAttribute('aria-labelledby','previewSignInTitle');
  dialog.innerHTML = [
    '<div class="ota-login-heading"><div><span class="ota-eyebrow">MY SIDRA ACCOUNT</span><h2 id="previewSignInTitle">Welcome back</h2><p>Your trips, saved guests and travel profile in one place.</p></div><button id="closeQuickSignIn" type="button" aria-label="Close sign-in preview">✕</button></div>',
    '<form id="previewLoginForm" autocomplete="off">',
    '<label for="previewLoginIdentifier">Username or email address</label><input id="previewLoginIdentifier" type="text" autocomplete="username" placeholder="Email or username">',
    '<label for="previewLoginPassword">Password</label><input id="previewLoginPassword" type="password" autocomplete="current-password" placeholder="Password">',
    '<button class="ota-login-cta" type="submit">Sign in</button>',
    '<p id="quickSignInNotice" role="status">UI preview only. Authentication is not activated; do not enter real credentials.</p>',
    '<div class="ota-login-links"><a href="/account#recovery">Forgot password?</a><a href="/account#signup">Create account</a></div></form>'
  ].join('');
  document.querySelector('.site-header').insertAdjacentElement('afterend',dialog);
  const icon=document.querySelector('.site-header .account-icon');
  icon.setAttribute('aria-haspopup','dialog');
  icon.setAttribute('aria-controls','quickSignIn');
  icon.addEventListener('click',(e)=>{e.preventDefault();dialog.showModal();byId('previewLoginIdentifier').focus();});
  const clearPreview = () => {byId('previewLoginPassword').value = '';byId('previewLoginIdentifier').value='';};
  byId('closeQuickSignIn').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',clearPreview);
  dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close();});
  byId('previewLoginForm').addEventListener('submit',(e)=>{
    e.preventDefault();clearPreview();
    byId('quickSignInNotice').textContent='This is a visual preview. Sign-in is disabled until Sidra identity service is securely configured. No credentials were sent.';
  });
})();
