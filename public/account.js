import { renderMemberQrCode } from './member-qr.js';
'use strict';
const $=id=>document.getElementById(id);
const state={config:null,token:'',user:null,adminRequested:false,mode:'signin'};
function notice(message,type=''){const n=$('feedback');n.textContent=message;n.dataset.type=type;}
function switchMode(mode){
 state.mode=mode;
 for(const [m,id] of [['signin','signInForm'],['signup','signUpForm'],['verify','verifyForm'],['recover','recoveryForm'],['reset','resetForm']])$(id).classList.toggle('hidden',m!==mode);
 $('authHeading').textContent=({signin:'Welcome back',signup:'Create a customer account',verify:'Verify your email',recover:'Reset your password',reset:'Create a new password'})[mode];
 $('authSubtitle').textContent=mode==='signin'?'Use your registered Sidra Tourism email.':mode==='signup'?'Start with your contact details. Travel identity is completed after verification.':mode==='verify'?'Enter your one-time verification code.':mode==='recover'?'We will email a one-time recovery code.':'Choose a strong replacement password.';
}
function setAccountType(admin){state.adminRequested=admin;$('customerType').classList.toggle('active',!admin);$('adminType').classList.toggle('active',admin);$('showSignUp').classList.toggle('hidden',admin);if(admin&&state.mode==='signup')switchMode('signin');}
function jsonResponse(response){return response.json().catch(()=>({})).then(value=>{if(!response.ok)throw new Error(value.msg||value.error_description||value.error||value.message||'Service unavailable');return value;});}
async function api(path,options={}){
 if(!state.token)throw new Error('Please sign in and verify your email.');
 const response=await fetch('/api/member/'+path,{method:options.method||'GET',cache:'no-store',headers:{authorization:'Bearer '+state.token,...(options.body?{'content-type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});
 return jsonResponse(response);
}
async function authFetch(route,payload){
 if(!state.config?.configured)throw new Error('Secure sign-in has not been activated for Sidra Tourism.');
 const response=await fetch(state.config.supabaseUrl+'/auth/v1/'+route,{method:'POST',cache:'no-store',headers:{apikey:state.config.publishableKey,'content-type':'application/json'},body:JSON.stringify(payload)});
 return jsonResponse(response);
}
function renderRecord(parent,title,subtitle){const a=document.createElement('article');const b=document.createElement('strong');b.textContent=title;const p=document.createElement('p');p.className='muted';p.textContent=subtitle;a.append(b,p);parent.append(a);}
function money(minor){return (Number(minor||0)/100).toFixed(2);}
async function loadDashboard(){
 const [{user,wallet},bookings,passengers,balance]=await Promise.all([api('me'),api('bookings'),api('passengers'),api('wallet')]);
 state.user=user;
 if(state.adminRequested&&['admin','super_admin'].includes(user.role)){sessionStorage.setItem('sidra_admin_session',state.token);window.location.assign('/admin-workspace');return;}
 $('authView').classList.add('hidden');$('dashboardView').classList.remove('hidden');$('signOut').classList.remove('hidden');
 $('customerTier').textContent=['admin','super_admin'].includes(user.role)?'STAFF / ADMIN':'STANDARD USER';
 $('greeting').textContent=(user.first_name?user.first_name+' '+user.last_name:'Sidra member')+' · '+user.email;
 $('memberCode').textContent=user.customer_code;
 $('walletCodeMini').textContent='Wallet: '+(wallet?.wallet_code||'Not assigned');
 $('walletNumber').textContent=balance.walletCode;
 $('walletPoints').textContent=String(balance.points);
 $('pointsPreview').textContent=String(balance.points);
 $('walletCredits').textContent=money(balance.refundCreditsMinor);
 $('bookingCount').textContent=String(bookings.bookings.length);
 const history=$('bookingList');history.replaceChildren();
 if(!bookings.bookings.length){const p=document.createElement('p');p.className='muted';p.textContent='No booking history. Only actual supplier records appear here.';history.append(p);}
 for(const b of bookings.bookings)renderRecord(history,b.booking_code+' · '+b.service,(b.origin||'')+' → '+(b.destination||'')+' · '+b.status+' · '+(b.departure_date||'Date not set'));
 const list=$('passengerList');list.replaceChildren();
 if(!passengers.passengers.length){const p=document.createElement('p');p.className='muted';p.textContent='No saved passengers yet.';list.append(p);}
 for(const p of passengers.passengers)renderRecord(list,[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(' '),p.relationship+' · '+p.nationality+' · '+p.dob);
 try {renderMemberQrCode($('memberQr'),user.customer_code);} catch { $('memberQr').textContent='Membership QR unavailable'; }
 notice('Signed in. Only verified account records are shown.');
}
async function signIn(event){
 event.preventDefault();notice('Checking credentials…');
 try{
  const data=await authFetch('token?grant_type=password',{email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  if(!data.access_token)throw new Error('Verified session was not returned');
  state.token=data.access_token;state.user=null;
  $('loginPassword').value='';
  await loadDashboard();
 }catch(error){state.token='';notice(error.message,'error');}
}
async function signUp(event){
 event.preventDefault();if(state.adminRequested){notice('Administrator accounts are invite-only.','warn');return;}
 if(!state.config?.signupEnabled){notice('Customer sign-up is awaiting verified email setup.','warn');return;}
 const details={firstName:$('firstName').value.trim(),middleName:$('middleName').value.trim(),lastName:$('lastName').value.trim(),email:$('registerEmail').value.trim(),phone:$('registerPhone').value.trim()};
 const pwd=$('registerPassword').value;
 if(pwd.length<10){notice('Use a longer account password.','error');return;}
 try{
  await authFetch('signup',{email:details.email,password:pwd,data:{first_name:details.firstName,middle_name:details.middleName,last_name:details.lastName,phone:details.phone}});
  $('registerPassword').value='';$('loginEmail').value=details.email;
  switchMode('verify');notice('Check your registered email for a one-time verification code.');
 }catch(error){notice(error.message,'error');}
}
async function verify(event){
 event.preventDefault();
 try{
  const email=$('registerEmail').value.trim();const token=$('emailCode').value.trim();
  if(!/^\d{6}$/.test(token))throw new Error('Enter a six-digit email verification code.');
  const data=await authFetch('verify',{email,token,type:'signup'});
  $('emailCode').value='';
  if(data.access_token){state.token=data.access_token;await loadDashboard();}
  else{switchMode('signin');notice('Email verified. Sign in using your password.');}
 }catch(error){notice(error.message,'error');}
}
async function recover(event){
 event.preventDefault();
 try{await authFetch('recover',{email:$('recoveryEmail').value.trim()});switchMode('reset');notice('If the email is registered, the one-time recovery code has been sent.');}
 catch(error){notice(error.message,'error');}
}
async function resetPassword(event){
 event.preventDefault();
 const password=$('newPassword').value,confirm=$('confirmNewPassword').value;
 if(password!==confirm||password.length<10){notice('Passwords must match and be at least 10 characters.','error');return;}
 try{
  const token=$('recoveryCode').value.trim();if(!/^\d{6}$/.test(token))throw new Error('Enter a six-digit recovery code.');
  const verification=await authFetch('verify',{type:'recovery',email:$('recoveryEmail').value.trim(),token});
  if(!verification.access_token)throw new Error('A verified recovery session was not returned.');
  const response=await fetch(state.config.supabaseUrl+'/auth/v1/user',{
    method:'PUT',cache:'no-store',headers:{apikey:state.config.publishableKey,authorization:'Bearer '+verification.access_token,'content-type':'application/json'},
    body:JSON.stringify({password})
  });
  await jsonResponse(response);
  $('newPassword').value='';$('confirmNewPassword').value='';$('recoveryCode').value='';
  switchMode('signin');notice('Password changed. Sign in using your new password.');
 }catch(error){notice(error.message,'error');}
}
async function savePassenger(event){
 event.preventDefault();
 try{
  const payload=Object.fromEntries(new FormData($('passengerForm')).entries());
  await api('passengers',{method:'POST',body:payload});
  $('passengerForm').reset();await loadDashboard();notice('Traveller saved in your private account.');
 }catch(error){notice(error.message,'error');}
}
function section(section){
 for(const name of ['overview','passengers','history','identity','wallet'])$(name+'Section').classList.toggle('hidden',name!==section);
 document.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
}
function signOut(){state.token='';state.user=null;$('dashboardView').classList.add('hidden');$('authView').classList.remove('hidden');$('signOut').classList.add('hidden');switchMode('signin');notice('Signed out of your Sidra account.');}
function bind(){
 $('signInForm').addEventListener('submit',signIn);
 $('signUpForm').addEventListener('submit',signUp);
 $('verifyForm').addEventListener('submit',verify);
 $('recoveryForm').addEventListener('submit',recover);
 $('resetForm').addEventListener('submit',resetPassword);
 $('passengerForm').addEventListener('submit',savePassenger);
 $('customerType').addEventListener('click',()=>setAccountType(false));$('adminType').addEventListener('click',()=>setAccountType(true));
 $('showSignUp').addEventListener('click',()=>switchMode('signup'));$('showRecovery').addEventListener('click',()=>switchMode('recover'));
 document.querySelectorAll('[data-back]').forEach(x=>x.addEventListener('click',()=>switchMode('signin')));
 document.querySelectorAll('[data-section]').forEach(x=>x.addEventListener('click',()=>section(x.dataset.section)));
 $('signOut').addEventListener('click',signOut);
}
async function init(){
 bind();
 try{
  const response=await fetch('/api/member/config',{cache:'no-store'});
  state.config=await jsonResponse(response);
  if(!state.config.configured){
    $('signInButton').disabled=true;$('showSignUp').disabled=true;$('showRecovery').disabled=true;
    notice('Secure Sidra account setup is pending. Sign in, registration, OTP and profile storage are not active yet.','warn');
  }else if(!state.config.signupEnabled){
    $('showSignUp').disabled=true;
    notice('Sign in is available. New registrations await verification of Sidra email settings.');
  }else notice('Secure account service is ready.');
 }catch(e){notice('Account service is temporarily unavailable. No information was submitted.','error');$('signInButton').disabled=true;}
}
init();