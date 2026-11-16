import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OWNER_EMAIL,OWNER_NAME,OWNER_ROLE,isOwner,configured,validPassword,safeOrigin} from './security.js';
import {createOperationsRouter} from './operations-router.js';

const app=express();
const root=path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({limit:'16kb'}));
app.use((req,res,next)=>{
  res.set({
    'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://sidra-tourism.com data:; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; upgrade-insecure-requests"
  });next();
});
function send(res,code,data){return res.status(code).json(data);}
const fails=new Map();
function limitLogin(req,res,next){
  const ip=String(req.ip||'unknown').slice(0,120),now=Date.now(),row=fails.get(ip);
  if(row&&row.until>now&&row.count>=6)return send(res,429,{error:'Too many attempts. Try again later.'});
  if(fails.size>2000)fails.clear();
  req.loginIp=ip;next();
}
function recordFailure(ip){
  const now=Date.now(),record=fails.get(ip);
  if(!record||record.until<now)fails.set(ip,{count:1,until:now+15*60_000});
  else record.count+=1;
}
function checkWriteOrigin(req,res,next){
  if(!safeOrigin(req.get('origin'),req.get('host')))return send(res,403,{error:'Origin not permitted'});
  next();
}
function cookies(req){
  const result=Object.create(null);
  for(const raw of (req.get('cookie')||'').split(';')){
    const i=raw.indexOf('=');if(i<1)continue;
    result[raw.slice(0,i).trim()]=raw.slice(i+1).trim();
  }
  return result;
}
const sessionKey='__Host-sidra_admin_session';
function setCookie(res,token,maxAge=3300){
  res.cookie(sessionKey,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:maxAge*1000});
}
function clearCookie(res){
  res.clearCookie(sessionKey,{httpOnly:true,secure:true,sameSite:'strict',path:'/'});
}
async function provider(pathname,{method='GET',data,token,headers:extraHeaders}={}){
  const base=process.env.SIDRA_SUPABASE_URL;
  const url=base+pathname;
  const headers={apikey:process.env.SIDRA_SUPABASE_PUBLISHABLE_KEY,accept:'application/json'};
  if(data!==undefined)headers['content-type']='application/json';
  if(token)headers.authorization='Bearer '+token;
  if(extraHeaders?.Prefer==='return=representation')headers.Prefer='return=representation';
  let response;
  try{
    response=await fetch(url,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(9000)});
  }catch{return {ok:false,status:503,data:{error:'Identity service is temporarily unavailable'}};}
  let payload;
  try{payload=await response.json();}catch{payload={};}
  return {ok:response.ok,status:response.status,data:payload};
}
async function account(token){
  if(!configured()||typeof token!=='string'||!token||token.length>4096)return null;
  const u=await provider('/auth/v1/user',{token});
  if(!u.ok||!isOwner(u.data,process.env.SIDRA_ADMIN_USER_ID))return null;
  const profile=await provider('/rest/v1/sidra_admin_profiles?select=user_id,display_name,role,must_change_password&user_id=eq.'+encodeURIComponent(u.data.id),{token});
  if(!profile.ok||!Array.isArray(profile.data)||profile.data.length!==1||profile.data[0].role!=='admin')return null;
  return {user:u.data,profile:profile.data[0]};
}
async function owner(req,res,next){
  const token=cookies(req)[sessionKey];
  const record=await account(token);
  if(!record)return send(res,401,{error:'Administrator authentication required'});
  req.owner=record;req.ownerToken=token;next();
}
app.get('/api/config',(_req,res)=>send(res,200,{configured:configured(),portal:'Sidra Tourism Admin',signupEnabled:false}));
app.post('/api/auth/login',checkWriteOrigin,limitLogin,async(req,res)=>{
  if(!configured())return send(res,503,{error:'Administrator login is being configured'});
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  const password=typeof req.body?.password==='string'?req.body.password:'';
  if(email!==OWNER_EMAIL||!password||password.length>128){recordFailure(req.loginIp);return send(res,401,{error:'Invalid credentials'});}
  const signed=await provider('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password}});
  if(!signed.ok||!signed.data?.access_token){recordFailure(req.loginIp);return send(res,401,{error:'Invalid credentials'});}
  const verified=await account(signed.data.access_token);
  if(!verified){recordFailure(req.loginIp);return send(res,403,{error:'This account is not authorized for administrator access'});}
  fails.delete(req.loginIp);
  setCookie(res,signed.data.access_token,Math.min(Math.max(300,Number(signed.data.expires_in||3300)-60),3300));
  return send(res,200,{ok:true,profile:{name:verified.profile.display_name||OWNER_NAME,email:OWNER_EMAIL,role:OWNER_ROLE,requiresPasswordChange:verified.profile.must_change_password}});
});
app.get('/api/auth/me',owner,async(req,res)=>send(res,200,{ok:true,profile:{name:req.owner.profile.display_name||OWNER_NAME,email:OWNER_EMAIL,role:OWNER_ROLE,requiresPasswordChange:req.owner.profile.must_change_password}}));
async function markPasswordChanged(token,userId){
  const result=await provider('/rest/v1/sidra_admin_profiles?user_id=eq.'+encodeURIComponent(userId),{method:'PATCH',token,data:{must_change_password:false}});
  return result.ok;
}
app.post('/api/auth/change-password',checkWriteOrigin,owner,async(req,res)=>{
  const currentPassword=req.body?.currentPassword,newPassword=req.body?.newPassword;
  if(typeof currentPassword!=='string'||currentPassword.length>128||!validPassword(newPassword)||newPassword===currentPassword)return send(res,422,{error:'Use a different strong password of at least 14 characters (upper/lowercase, number and symbol).'});
  const reauth=await provider('/auth/v1/token?grant_type=password',{method:'POST',data:{email:OWNER_EMAIL,password:currentPassword}});
  if(!reauth.ok||!isOwner(reauth.data.user,process.env.SIDRA_ADMIN_USER_ID))return send(res,401,{error:'Current password was not accepted'});
  const updated=await provider('/auth/v1/user',{method:'PUT',token:reauth.data.access_token,data:{password:newPassword}});
  if(!updated.ok)return send(res,502,{error:'Password update could not be completed'});
  if(!await markPasswordChanged(reauth.data.access_token,req.owner.user.id))return send(res,503,{error:'Password updated. Sign in again to finish account setup.'});
  clearCookie(res);
  return send(res,200,{ok:true,message:'Password updated. Sign in again using your new password.'});
});
app.post('/api/auth/recover',checkWriteOrigin,limitLogin,async(req,res)=>{
  // Do not reveal whether a given email exists.
  if(configured()&&String(req.body?.email||'').trim().toLowerCase()===OWNER_EMAIL){
    const redirect=encodeURIComponent('https://admin.sidra-tourism.com/#recovery');
    await provider('/auth/v1/recover?redirect_to='+redirect,{method:'POST',data:{email:OWNER_EMAIL}});
  }
  return send(res,202,{message:'If an eligible administrator account exists, a password-reset message has been requested.'});
});
app.post('/api/auth/reset',checkWriteOrigin,async(req,res)=>{
  if(!configured())return send(res,503,{error:'Administrator identity provider is unavailable'});
  const token=req.body?.accessToken,pass=req.body?.newPassword;
  if(typeof token!=='string'||token.length<40||token.length>4096||!validPassword(pass))return send(res,422,{error:'Invalid reset session or password'});
  const verified=await account(token);
  if(!verified)return send(res,401,{error:'Invalid or expired administrator recovery session'});
  const updated=await provider('/auth/v1/user',{method:'PUT',token,data:{password:pass}});
  if(!updated.ok)return send(res,503,{error:'Unable to update password'});
  if(!await markPasswordChanged(token,verified.user.id))return send(res,503,{error:'Password updated. Sign in again to finish account setup.'});
  clearCookie(res);
  return send(res,200,{ok:true,message:'New password saved. Sign in to access your workspace.'});
});
app.post('/api/auth/logout',checkWriteOrigin,(req,res)=>{clearCookie(res);return send(res,200,{ok:true});});
app.get('/api/workspace',owner,(req,res)=>{
  if(req.owner.profile.must_change_password)return send(res,403,{code:'PASSWORD_CHANGE_REQUIRED',error:'Change the temporary password before entering the workspace'});
  return send(res,200,{
    user:{name:req.owner.profile.display_name||OWNER_NAME,email:OWNER_EMAIL,title:'Admin',role:'admin'},
    services:[
      {name:'Flight bookings',state:'Awaiting live supplier integration'},
      {name:'Hotel reservations',state:'Supplier account active; site integration pending'},
      {name:'Car rentals & transfers',state:'Enquiry workflows only'},
      {name:'Holidays & experiences',state:'Enquiry workflows only'}
    ],
    alerts:['No live ticketing or payment operations are enabled through this admin portal.']
  });
});
app.use('/api/ops',createOperationsRouter({provider,ownerOnly:owner,checkWriteOrigin}));
app.use(express.static(path.join(root,'public'),{index:false,etag:true,maxAge:'5m'}));
app.get('/',(_req,res)=>res.sendFile(path.join(root,'public','index.html')));
app.use('/api',(_req,res)=>send(res,404,{error:'Not found'}));
app.use((_req,res)=>res.status(404).send('Not found'));
app.listen(process.env.PORT||3000,()=>console.log('Sidra Admin listening'));
