/** Pure owner verification policy. Never accept a role supplied by a browser. */
export const OWNER_EMAIL='admin@sidra-tourism.com';
export const OWNER_NAME='Imath Mohamed Marzook';
export const OWNER_ROLE='Admin';
export function isOwner(user,expectedUid){
  return typeof expectedUid==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedUid)
    &&user?.id===expectedUid&&user.email?.toLowerCase()===OWNER_EMAIL;
}
export function validPassword(v){
  return typeof v==='string'&&v.length>=14&&v.length<=128&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9]/.test(v);
}
export function safeOrigin(origin,host){
  if(typeof host!=='string'||!host||typeof origin!=='string')return false;
  try {const u=new URL(origin);return u.protocol==='https:'&&u.host.toLowerCase()===host.toLowerCase();}catch{return false;}
}
export function configured(env=process.env){
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SIDRA_SUPABASE_URL||'')
    &&(env.SIDRA_SUPABASE_PUBLISHABLE_KEY||'').length>20
    &&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.SIDRA_ADMIN_USER_ID||'');
}
