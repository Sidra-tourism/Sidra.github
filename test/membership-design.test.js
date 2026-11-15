import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/sidra-premium.css', import.meta.url), 'utf8');
const account = readFileSync(new URL('../public/account.html', import.meta.url), 'utf8');
const accountJs = readFileSync(new URL('../public/account.js', import.meta.url), 'utf8');

test('top navigation is exactly Home, Our Services, About Us, Contact Us', () => {
  const nav = html.match(/<nav[^>]*class="nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'Expected primary nav');
  const items = Array.from(nav.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g), m => ({href:m[1], label:m[2].replace(/<[^>]*>/g,'').trim()}));
  assert.deepEqual(items, [
    {href:'#home',label:'Home'},
    {href:'#services',label:'Our Services'},
    {href:'#about',label:'About Us'},
    {href:'#contact',label:'Contact Us'}
  ]);
  for(const anchor of ['home','services','about','contact'])assert.match(html,new RegExp('id="'+anchor+'"'));
});

test('login action is an accessible profile icon, not a text button', () => {
  const icon = html.match(/<a[^>]*class="account-icon"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(icon, 'Expected account icon anchor');
  assert.match(icon[0],/href="\/account(?:#signin)?"/);
  assert.match(icon[0],/aria-label="Sign in or create an account"/);
  assert.match(icon[1],/<svg\b/);
  assert.doesNotMatch(icon[1],/Sign in|Create account|Register/i);
  assert.doesNotMatch(html,/>Sign in \/ Create account<\/a>/);
});

test('flight, hotel and vehicle search remain available without fake defaults', () => {
  for(const id of ['flightArea','hotelArea','carArea','fromCountry','fromCity','toCountry','toCity','departureDate']){
    assert.match(html, new RegExp('id="'+id+'"'));
  }
  assert.match(html,/validateFlightForm/);
  assert.doesNotMatch(html,/From \$\d+|setRoute\('DOH'|Demo Engine/);
  assert.match(css,/\.search-card/);
});

test('login form supports username or email, password and recovery or sign up actions', () => {
  assert.match(account,/<input[^>]*id="loginEmail"[^>]*type="text"/);
  assert.match(account,/<input[^>]*id="loginPassword"[^>]*type="password"/);
  assert.match(account,/>Forgot password\?<\/button>/);
  assert.match(account,/>Create a new account<\/button>/);
  assert.match(account, /id="recoveryForm"/);
  assert.match(account, /id="resetForm"/);
  assert.match(account, /id="signUpForm"/);
  assert.match(accountJs, /Username sign-in is not available yet/);
});

test('site supports navigable responsive booking layout with its own Sidra branding', () => {
  assert.match(html, /Sidra Tourism Logo/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /site-header/);
  assert.match(css, /site-search/);
  assert.match(html, /Premium travel planning|Find your next journey/);
});
