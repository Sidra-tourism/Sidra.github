'use strict';
const $=id=>document.getElementById(id);
const state={authenticated:false,profile:null,recoveryToken:'',view:'overview',config:false};
const meta={
  overview:['Overview','Monitor your travel-agency operations and connected supplier status.'],
  bookings:['Bookings','Supplier-verified travel reservations and customer support queue.'],
  flights:['Flights Desk','Flight offers, payments, ticket issuance and customer notifications.'],
  hotels:['Hotels Desk','Hotel availability, supplier bookings and cancellation readiness.'],
  enquiries:['Enquiries','Manage guest enquiries with an auditable workflow.'],
  customers:['Customers','Private customer profiles and authenticated membership readiness.'],
  transfers:['Cars & Transfers','Airport transportation, rentals and supplier operations.'],
  experiences:['Qatar Experiences','Create enquiry-only guided desert and cultural tours.'],
  finance:['Finance & Payments','Supplier payment verification, settlement and refunds.'],
  suppliers:['Suppliers','Distribution provider and local supplier relationships.'],
  iata:['IATA & Distribution','Accreditation, distribution, GDS and ticketing permissions.'],
  integrations:['Integrations','API and payment integration readiness.'],
  notifications:['Notifications','Operational alerts, status changes and support follow-ups.'],
  reports:['Reports','Verified operational counts and reporting.'],
  audit:['Audit Trail','Owner activity and administrative change history.'],
  documents:['Documents','Approved vouchers, itineraries and booking documents.'],
  settings:['Settings','Sidra administration, security and access controls.'],
  profile:['My Profile','Your administrator identity and role.']
};
function note(id,msg,type=''){const e=$(id);e.textContent=msg;e.className='notice '+type;}
function show(section){
  for(const id of ['authWrap','passwordChangeWrap','workspaceWrap'])$(id).classList.toggle('hidden',id!==section);
  $('signOut').classList.toggle('hidden',section==='authWrap');
  $('sidebarToggle')?.classList.toggle('hidden',section!=='workspaceWrap');
}
function selectAuth(form){
  for(const id of ['loginForm','recoverForm','resetForm'])$(id).classList.toggle('hidden',id!==form);
  note('notice','');
  const titles={loginForm:'Admin Sign In',recoverForm:'Recover admin access',resetForm:'Choose your new password'};
  $('authTitle').textContent=titles[form]||titles.loginForm;
}
async function api(path,options={}){
  let response;
  try{response=await fetch(path,{credentials:'same-origin',cache:'no-store',
    ...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});}
  catch{throw new Error('The admin service is temporarily unavailable.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not complete request.');
  return data;
}
function strong(p){return typeof p==='string'&&p.length>=14&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p);}
function authReady(profile){
  state.profile=profile;
  state.authenticated=true;
  $('signOut').classList.remove('hidden');
  if(profile.requiresPasswordChange){show('passwordChangeWrap');note('changeNotice','Please replace your temporary password before opening the workspace.');return;}
  return openWorkspace();
}
function setProfile(user){
  $('sideName').textContent=user.name;
  $('welcomeName').textContent=user.name.split(/\s+/)[0]||'Admin';
  $('profileName').textContent=user.name;
  $('profileEmail').textContent=user.email;
}
function renderIntegrations(services){
  for(const id of ['integrationList','integrationDetails']){
    const el=$(id);el.replaceChildren();
    for(const item of services){
      const row=document.createElement('div');row.className='row';
      const name=document.createElement('b'),status=document.createElement('span');
      name.textContent=item.name;status.textContent=item.state;
      row.append(name,status);el.append(row);
    }
  }
}
function openView(view){
  if(!meta[view])view='overview';
  state.view=view;
  for(const el of document.querySelectorAll('[data-view]'))el.classList.toggle('active',el.dataset.view===view);
  for(const name of Object.keys(meta))$(name+'View').classList.toggle('hidden',name!==view);
  $('viewTitle').textContent=meta[view][0];
  $('viewDesc').textContent=meta[view][1];
  if(window.SidraOperations?.load)void window.SidraOperations.load(view);
}
async function openWorkspace(){
  const response=await api('/api/workspace');
  setProfile(response.user);
  renderIntegrations(response.services);
  note('workspaceNotice',Array.isArray(response.alerts)?response.alerts.join(' '):'');
  show('workspaceWrap');
  openView('overview');
}
async function signIn(e){
  e.preventDefault();
  const submit=$('loginSubmit');submit.disabled=true;
  try{
    const body={email:$('loginEmail').value.trim(),password:$('loginPassword').value};
    const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify(body)});
    $('loginPassword').value='';
    await authReady(result.profile);
  }catch(error){note('notice',error.message,'error');}
  finally{submit.disabled=false;}
}
async function changePassword(e){
  e.preventDefault();
  const old=$('currentPassword').value,password=$('newPassword').value,confirm=$('confirmPassword').value;
  if(password!==confirm)return note('changeNotice','Passwords do not match.','error');
  if(!strong(password))return note('changeNotice','Use 14+ characters, uppercase and lowercase letters, a number and symbol.','error');
  try{
    const result=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:old,newPassword:password})});
    $('changeForm').reset();state.authenticated=false;state.profile=null;
    selectAuth('loginForm');show('authWrap');note('notice',result.message,'ok');
  }catch(error){note('changeNotice',error.message,'error');}
}
async function recover(e){
  e.preventDefault();
  try{
    const response=await api('/api/auth/recover',{method:'POST',body:JSON.stringify({email:$('recoverEmail').value.trim()})});
    note('notice',response.message,'ok');
  }catch(error){note('notice',error.message,'error');}
}
async function reset(e){
  e.preventDefault();
  const password=$('resetPassword').value;
  if(password!==$('resetConfirm').value)return note('notice','Passwords do not match.','error');
  if(!strong(password))return note('notice','Choose at least 14 characters including a number, uppercase/lowercase and a symbol.','error');
  try{
    const result=await api('/api/auth/reset',{method:'POST',body:JSON.stringify({accessToken:state.recoveryToken,newPassword:password})});
    state.recoveryToken='';$('resetForm').reset();selectAuth('loginForm');note('notice',result.message,'ok');
  }catch(error){note('notice',error.message,'error');}
}
async function signOut(){
  try{await api('/api/auth/logout',{method:'POST'});}catch{}
  state.authenticated=false;state.profile=null;
  selectAuth('loginForm');show('authWrap');note('notice','Signed out.','ok');
}
function wire(){
  $('loginForm').addEventListener('submit',signIn);
  $('recoverForm').addEventListener('submit',recover);
  $('resetForm').addEventListener('submit',reset);
  $('changeForm').addEventListener('submit',changePassword);
  $('signOut').addEventListener('click',signOut);
  $('forgotLink').addEventListener('click',()=>selectAuth('recoverForm'));
  $('backToLogin').addEventListener('click',()=>selectAuth('loginForm'));
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>openView(b.dataset.view));
}
async function init(){
  wire();
  const fragment=new URLSearchParams(location.hash.replace(/^#/,'')),type=fragment.get('type');
  if(type==='recovery'&&fragment.has('access_token')){
    state.recoveryToken=fragment.get('access_token');
    history.replaceState({},'',location.pathname);
    show('authWrap');selectAuth('resetForm');return;
  }
  if(location.hash)history.replaceState({},'',location.pathname);
  try{
    const result=await api('/api/config');
    state.config=!!result.configured;
    if(!state.config){note('notice','Administrator identity setup is being finalized. Please check again after setup is verified.');$('loginSubmit').disabled=true;return;}
    const me=await api('/api/auth/me');
    await authReady(me.profile);
  }catch(error){
    if(state.config)note('notice','Sign in with your administrator account.');
    else note('notice','The admin portal is not connected to its identity provider yet.');
    selectAuth('loginForm');show('authWrap');
  }
}
init();
