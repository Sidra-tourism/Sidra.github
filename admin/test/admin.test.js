import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OWNER_EMAIL,OWNER_NAME,isOwner,validPassword,safeOrigin,configured} from '../security.js';
const id='9f695aa9-fb14-48af-98c6-b3b4b0bf4a62';
test('owner identity requires exact Sidra admin email AND verified UUID',()=>{
  assert.equal(OWNER_EMAIL,'admin@sidra-tourism.com');
  assert.equal(OWNER_NAME,'Imath Mohamed Marzook');
  assert.equal(isOwner({id,email:OWNER_EMAIL},id),true);
  assert.equal(isOwner({id,email:'other@sidra-tourism.com'},id),false);
  assert.equal(isOwner({id:'f7b121bc-8c13-49df-9f23-5c9b62c92d8e',email:OWNER_EMAIL},id),false);
  assert.equal(isOwner({id,email:OWNER_EMAIL},''),false);
  assert.equal(isOwner({id,email:OWNER_EMAIL},'not-a-uuid'),false);
  assert.equal(isOwner({id,role:'admin'},id),false);
});
test('strong temporary replacement password policy is enforced',()=>{
  assert.equal(validPassword('G8&abcdefghijkL!'),true);
  for(const p of ['short','passwordpassword','PASSWORDPASSWORD!9','1234567890!A','abcdefgh1234567','Aa1!','x'.repeat(129)])
    assert.equal(validPassword(p),false,p);
});
test('cross-origin writes are rejected and only HTTPS exact-host allowed',()=>{
  assert.equal(safeOrigin('https://admin.sidra-tourism.com','admin.sidra-tourism.com'),true);
  assert.equal(safeOrigin('http://admin.sidra-tourism.com','admin.sidra-tourism.com'),false);
  assert.equal(safeOrigin('https://admin.sidra-tourism.com.evil.com','admin.sidra-tourism.com'),false);
  assert.equal(safeOrigin('https://sidra-tourism.com','admin.sidra-tourism.com'),false);
  assert.equal(safeOrigin('','admin.sidra-tourism.com'),false);
});
test('missing Sidra-only provider configuration fails closed',()=>{
  assert.equal(configured({}),false);
  assert.equal(configured({SIDRA_SUPABASE_URL:'https://rcavyshsxnzodoipsbun.supabase.co',SIDRA_SUPABASE_PUBLISHABLE_KEY:'anypublishablekeystringlong',SIDRA_ADMIN_USER_ID:id}),true);
  assert.equal(configured({SIDRA_SUPABASE_URL:'https://other.example.com',SIDRA_SUPABASE_PUBLISHABLE_KEY:'anypublishablekeystringlong',SIDRA_ADMIN_USER_ID:id}),false);
});
test('admin backend enforces HTTP-only cookie and owner check on workspace',()=>{
  const s=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(s,/httpOnly:true,secure:true,sameSite:'strict'/);
  assert.match(s,/isOwner\(u\.data,process\.env\.SIDRA_ADMIN_USER_ID\)/);
  assert.match(s,/must_change_password/);
  assert.match(s,/PASSWORD_CHANGE_REQUIRED/);
  assert.match(s,/checkWriteOrigin/);
  assert.match(s,/rate(?:Limit|Failure)|limitLogin/);
  assert.doesNotMatch(s,/process\.env\.SUPABASE_SERVICE_ROLE/);
  assert.doesNotMatch(s,/\/auth\/v1\/signup/);
});
test('admin frontend includes owner-only login, password setup, profile and six workspace views',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  for(const label of ['Admin Sign In','Forgot password?','Temporary password','My Profile','Imath Mohamed Marzook','admin@sidra-tourism.com'])assert.ok(html.includes(label),label);
  for(const item of ['overview','bookings','enquiries','customers','integrations','profile'])assert.ok(html.includes('data-view="'+item+'"'),item);
  assert.match(js,/\/api\/auth\/change-password/);
  assert.match(js,/\/api\/auth\/recover/);
  assert.match(js,/\/api\/auth\/reset/);
  assert.match(js,/\/api\/auth\/me/);
  assert.match(js,/\/api\/workspace/);
  assert.doesNotMatch(html,/Create admin account|Sign up as admin/i);
});
