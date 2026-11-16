import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
test('public account icon opens a real sign-in page and labels the icon',()=>{
 const home=file('index.html');
 assert.match(home, /class="account-icon" href="\/signin\.html"/);
 assert.match(home, /class="account-text">Sign In<\/span>/);
 assert.doesNotMatch(home, /href="#signin"/);
});
test('sign-in page provides a separate owner-only admin sign-in',()=>{
 const h=file('signin.html');
 assert.match(h, /Customer Sign In/);
 assert.match(h, /Admin Sign In/);
 assert.match(h, /https:\/\/admin\.sidra-tourism\.com\//);
 assert.match(h, /Email \/ Username/);
 assert.match(h, /Password/);
 assert.match(h, /Forgot password/);
 assert.match(h, /Create a new account/);
});
test('customer login stays disabled until backend authentication is verified',()=>{
 const h=file('signin.html');
 assert.match(h,/Customer account sign-in is not yet activated/);
 assert.match(h,/disabled[^>]*>Customer Sign In/);
 assert.doesNotMatch(h,/auth\.supabase\.co|sb_secret_|service_role/);
});
