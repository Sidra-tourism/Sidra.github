'use strict';
/** Sidra owner operations: data is shown only after the authenticated backend returns it. */
(()=>{
  const $=id=>document.getElementById(id);
  const entities=Object.freeze({
    bookings:'bookings',enquiries:'enquiries',customers:'customers',experiences:'experiences',
    finance:'payments',suppliers:'suppliers',notifications:'notifications',audit:'audit'
  });
  const titles=Object.freeze({
    enquiries:['status','customer_name','service','customer_email','created_at'],
    bookings:['status','service','provider','reference','created_at'],
    customers:['full_name','email','created_at'],
    experiences:['title','location','duration','status','created_at'],
    payments:['status','amount_minor','currency','provider','created_at'],
    suppliers:['name','product','integration_status','created_at'],
    notifications:['title','message','read_at','created_at'],
    audit:['action','summary','created_at']
  });
  function text(tag,value,cls=''){
    const n=document.createElement(tag);n.textContent=String(value===null||value===undefined||value===''?'—':value);
    if(cls)n.className=cls;return n;
  }
  function status(root,message,type='info'){
    if(!root)return;
    root.replaceChildren();
    const p=text('p',message,'ops-message '+type);p.setAttribute('role','status');root.append(p);
  }
  async function request(url,options={}){
    let resp;
    try{resp=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{
      ...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})
    }});}catch{throw new Error('Sidra operations service is unreachable');}
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok)throw new Error(data.error||'Operations service returned an error');
    return data;
  }
  function fmt(value,field){
    if(value===null||value===undefined||value==='')return '—';
    if(field==='amount_minor')return 'Minor units: '+value;
    if(field==='created_at'||field==='read_at'){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString():String(value);}
    return String(value).slice(0,240);
  }
  function makeItem(record,entity){
    const box=document.createElement('article');box.className='ops-entry';
    const head=document.createElement('div');head.className='ops-entry-head';
    const prominent=record.title||record.customer_name||record.full_name||record.name||record.reference||record.action||record.id||entity;
    head.append(text('strong',prominent));
    const label=record.status||record.integration_status||record.kind||entity;
    head.append(text('span',label,'ops-pill'));
    box.append(head);
    const definition=document.createElement('dl');definition.className='ops-definition';
    for(const key of (titles[entity]||[])){
      if(key==='title'||key==='customer_name'||key==='full_name'||key==='name')continue;
      const row=document.createElement('div');
      row.append(text('dt',key.replaceAll('_',' ')),text('dd',fmt(record[key],key)));definition.append(row);
    }
    box.append(definition);
    if(entity==='enquiries'&&['new','reviewing','quoted'].includes(record.status)){
      const controls=document.createElement('div');controls.className='ops-actions';
      const select=document.createElement('select');select.setAttribute('aria-label','Update enquiry status');
      for(const next of ['reviewing','quoted','closed']){
        const opt=document.createElement('option');opt.value=next;opt.textContent=next;
        if(next===record.status)opt.selected=true;select.append(opt);
      }
      const btn=text('button','Update status','btn ghost');btn.type='button';
      btn.addEventListener('click',async()=>{
        btn.disabled=true;try{
          await request('/api/ops/enquiries/'+encodeURIComponent(record.id)+'/status',{method:'PATCH',body:JSON.stringify({
            status:select.value,expectedStatus:record.status,adminNotes:record.admin_notes||''
          })});
          await load('enquiries');
        }catch(e){status($('enquiryAction'),e.message,'error');}finally{btn.disabled=false;}
      });
      controls.append(select,btn);box.append(controls);
    }
    if(entity==='notifications'&&!record.read_at){
      const mark=text('button','Mark read','btn ghost');mark.type='button';
      mark.addEventListener('click',async()=>{
        mark.disabled=true;try{
          await request('/api/ops/notifications/'+encodeURIComponent(record.id)+'/read',{method:'PATCH',body:'{}'});
          await load('notifications');
        }catch(e){status($('notificationsTable'),e.message,'error');}finally{mark.disabled=false;}
      });
      box.append(mark);
    }
    return box;
  }
  function displayList(id,entity,records){
    const root=$(id);if(!root)return;
    root.replaceChildren();
    if(!Array.isArray(records)){status(root,'The requested data is not available','error');return;}
    if(!records.length){status(root,'No verified '+entity+' records are available yet.');return;}
    for(const record of records.slice(0,50))root.append(makeItem(record,entity));
  }
  function displaySummary(counts){
    const root=$('summaryTable');if(!root)return;root.replaceChildren();
    for(const key of ['enquiries','bookings','notifications','experiences']){
      const metric=document.createElement('article');metric.className='metric';
      metric.append(text('span',key),text('strong',counts[key]??0),text('small','Records found (up to first 100)'));
      root.append(metric);
    }
  }
  function displayIntegrations(data){
    const names=['flightsStatus','hotelsStatus'];
    for(const id of names){
      const root=$(id);if(!root)continue;root.replaceChildren();
      for(const item of (data.suppliers||[])){
        const isMatch=id==='flightsStatus'?item.product==='flights'||item.product==='accreditation':item.product==='hotels';
        if(!isMatch)continue;
        const card=document.createElement('div');card.className='ops-entry';
        card.append(text('strong',item.name),text('p',item.detail),text('small','Verified status: '+item.state));
        root.append(card);
      }
    }
    const root=$('integrationDetails');
    if(root){
      root.replaceChildren();
      for(const item of (data.suppliers||[])){
        const row=document.createElement('div');row.className='row';
        row.append(text('b',item.name),text('span',item.state+' · '+item.detail));root.append(row);
      }
    }
  }
  async function load(view){
    try{
      if(view==='overview'||view==='reports'){
        const data=await request('/api/ops/summary');
        displaySummary(data.counts||{});
        if(view==='overview'){
          const card=$('opsDashboardSummary');
          if(card){card.replaceChildren();card.append(text('p','Sidra operational database connected. Booking totals are not sales or ticketing confirmations.','ops-message ok'));}
        }
        return;
      }
      if(['flights','hotels','iata','integrations'].includes(view)){
        const data=await request('/api/ops/integrations');
        displayIntegrations(data);return;
      }
      const entity=entities[view];
      if(!entity)return;
      const data=await request('/api/ops/'+entity);
      displayList(entity+'Table',entity,data.records);
    }catch(err){
      const id=view==='overview'?'opsDashboardSummary':view==='reports'?'summaryTable':view==='finance'?'paymentsTable':
        view==='flights'?'flightsStatus':view==='hotels'?'hotelsStatus':view==='integrations'?'integrationDetails':(entities[view]?entities[view]+'Table':null);
      if(id)status($(id),'Not connected: '+err.message,'error');
    }
  }
  function bindForm(id,target,actionId,view){
    const form=$(id);if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
      const data=Object.fromEntries(new FormData(form).entries());
      try{
        await request('/api/ops/'+target,{method:'POST',body:JSON.stringify(data)});
        status($(actionId),'Saved to Sidra private operations successfully.','ok');
        form.reset();await load(view);
      }catch(error){status($(actionId),error.message,'error');}
      finally{btn.disabled=false;}
    });
  }
  function wire(){
    bindForm('enquiryForm','enquiries','enquiryAction','enquiries');
    bindForm('experienceForm','experiences','experienceAction','experiences');
    const sidebar=$('sidebarToggle');
    if(sidebar)sidebar.addEventListener('click',()=>document.querySelector('.workspace')?.classList.toggle('sidebar-collapsed'));
  }
  document.addEventListener('DOMContentLoaded',wire);
  window.SidraOperations={load};
})();
