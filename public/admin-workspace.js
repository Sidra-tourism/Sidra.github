'use strict';
const $=id=>document.getElementById(id);
let token=sessionStorage.getItem('sidra_admin_session')||'';
function status(text,error=false){$('adminNotice').textContent=text;$('adminNotice').dataset.type=error?'error':'';}
async function api(path,options={}){
 if(!token)throw new Error('Administrator sign-in is required');
 const res=await fetch('/api/member/'+path,{cache:'no-store',method:options.method||'GET',headers:{authorization:'Bearer '+token,...(options.body?{'content-type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(payload.error||'Access denied');return payload;
}
function row(name,state){const parent=document.createElement('div');parent.className='integration-row';const label=document.createElement('b');label.textContent=name;const text=document.createElement('span');text.textContent=state;parent.append(label,text);$('integrationList').append(parent);}
async function load(){
 try{
  if(!token)throw new Error('Open the Customer / Admin sign-in page to authenticate.');
  const [account,overview]=await Promise.all([api('me'),api('admin/overview')]);
  if(!['super_admin','admin'].includes(account.user.role))throw new Error('Administrator access is restricted to approved staff.');
  $('protectedAdmin').classList.remove('hidden');
  $('markupPercentage').value=(overview.markupBasisPoints/100).toFixed(2);
  $('inventory').textContent=overview.airlineProvider==='not_connected'?'Not connected':'Available';
  $('payments').textContent=overview.paymentGateway==='not_connected'?'Not connected':'Provider configured';
  $('ticketing').textContent=overview.liveTicketing?'Active':'Inactive';
  const integrations=[['IATA / BSP settlement',overview.iataSettlement],['Amadeus GDS',overview.amadeus],['Airline NDC / inventory',overview.airlineProvider],['Payment provider',overview.paymentGateway],['Developer API / ChatGPT MCP',overview.developerMcp]];
  $('integrationList').replaceChildren();for(const [name,value] of integrations)row(name,String(value).replaceAll('_',' '));
  status('Verified administrator: '+account.user.email+'. All transactions remain disabled until provider verification.');
 }catch(e){$('protectedAdmin').classList.add('hidden');status(e.message,true);}
}
$('markupForm').addEventListener('submit',async event=>{
 event.preventDefault();const pct=Number($('markupPercentage').value);
 if(!Number.isFinite(pct)||pct<0||pct>100){status('Enter a markup from 0 to 100%.',true);return;}
 const basis=Math.round(pct*100);
 try{await api('admin/markup',{method:'PATCH',body:{markupBasisPoints:basis}});status('Markup policy saved and audited. No customer charge was made.');await load();}
 catch(e){status(e.message,true);}
});
$('adminSignOut').addEventListener('click',()=>{sessionStorage.removeItem('sidra_admin_session');token='';window.location.assign('/account');});
load();