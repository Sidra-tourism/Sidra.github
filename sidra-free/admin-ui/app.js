const $ = id => document.getElementById(id);
const states = ['requested','reviewing','quoted','awaiting_customer','closed'];
function show(message) { $('message').textContent = message; }
async function api(url, options={}) {
  const response = await fetch(url,{cache:'no-store',credentials:'same-origin',...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || 'Service unavailable');
  return data;
}
function label(text){const el=document.createElement('span');el.textContent=text;return el;}
function add(item){
  const card=document.createElement('article');
  const heading=document.createElement('h2');heading.textContent=`${item.service} · ${item.full_name}`;
  const meta=document.createElement('p');meta.className='meta';meta.textContent=`${item.id} · ${item.created_at} · ${item.status}`;
  const contact=document.createElement('p');contact.className='details';contact.textContent=`${item.email} · ${item.phone || 'No phone'}\n${item.origin || '—'} → ${item.destination || '—'} · ${item.travel_date || 'Date TBD'} · ${item.travelers} traveler(s)\n${item.notes || ''}`;
  const actions=document.createElement('div');actions.className='actions';actions.append(label('Status: '));
  const sel=document.createElement('select');sel.setAttribute('aria-label','Change status for '+item.id);
  for(const state of states){const opt=document.createElement('option');opt.textContent=state;opt.value=state;opt.selected=state===item.status;sel.append(opt);}
  const button=document.createElement('button');button.textContent='Save status';
  button.addEventListener('click',async()=>{
    if(sel.value===item.status){show('No changes to save.');return;}
    button.disabled=true;try{
      await api(`/api/enquiries/${encodeURIComponent(item.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({expectedStatus:item.status,status:sel.value})});
      item.status=sel.value;meta.textContent=`${item.id} · ${item.created_at} · ${item.status}`;show('Status saved and audited.');
    }catch(e){show(e.message);}finally{button.disabled=false;}
  });actions.append(sel,button);card.append(heading,meta,contact,actions);$('items').append(card);
}
async function refresh(){try{
  const s=$('status').value;
  const data=await api('/api/enquiries'+(s?'?status='+encodeURIComponent(s):''));
  $('items').replaceChildren();data.enquiries.forEach(add);show(`${data.enquiries.length} enquiry(s) shown (maximum 50).`);
}catch(e){$('items').replaceChildren();show(e.message);}}
$('refresh').addEventListener('click',refresh);$('status').addEventListener('change',refresh);
api('/api/me').then(user=>{$('account').textContent=`Signed in as ${user.email} (${user.role})`;refresh();}).catch(e=>{$('account').textContent='Private access unavailable';show(e.message);});