import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const signin = readFileSync(new URL('../public/signin.html', import.meta.url), 'utf8');
const editorial = readFileSync(new URL('../public/sidra-editorial.css', import.meta.url), 'utf8');
const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('customer login is explicitly the left card and owner admin login is the right card', () => {
  const customer = signin.indexOf('id="customerSignInCard"');
  const admin = signin.indexOf('id="adminSignInCard"');
  assert.ok(customer > 0, 'Customer card has a unique id');
  assert.ok(admin > customer, 'Admin card follows customer card');
  assert.match(signin, /class="card customer-login"/);
  assert.match(signin, /class="card admin admin-login"/);
  assert.match(signin, /\.customer-login\s*\{\s*grid-column\s*:\s*1/);
  assert.match(signin, /\.admin-login\s*\{\s*grid-column\s*:\s*2/);
  assert.match(signin, /@media\(max-width:720px\)[\s\S]*?\.admin-login\s*\{\s*grid-column\s*:\s*1/);
});

test('sign in retains the correct routes and never simulates active customer authentication', () => {
  assert.match(signin, /Customer Sign In/);
  assert.match(signin, /Admin Sign In/);
  assert.match(signin, /https:\/\/admin\.sidra-tourism\.com\//);
  assert.match(signin, /disabled[^>]*>Customer Sign In/);
  assert.match(home, /href="\/signin\.html"/);
});

test('hero uses an image-free Sidra branded background while booking fields remain intact', () => {
  const hero = editorial.match(/\.editorial-layout \.hero\s*\{([^}]*)\}/)?.[1];
  assert.ok(hero, 'Main hero stylesheet exists');
  assert.doesNotMatch(hero, /url\(|unsplash|\.jpg|\.jpeg|\.png/i);
  assert.match(hero, /linear-gradient\(/);
  assert.match(home, /id="fromCountry"/);
  assert.match(home, /id="toCountry"/);
  assert.match(home, /id="departureDate"/);
});

test('admin sign-in button is directly below customer recovery links and not duplicated on right', () => {
  const customerCard = signin.match(/<section class="card customer-login"[\s\S]*?<\/section>/)?.[0];
  const adminCard = signin.match(/<section class="card admin admin-login"[\s\S]*?<\/section>/)?.[0];
  assert.ok(customerCard && adminCard);
  const forgot = customerCard.indexOf('Forgot password?');
  const linksEnd = customerCard.indexOf('</div>', forgot);
  const adminButton = customerCard.indexOf('id="adminSignInButton"');
  assert.ok(forgot > 0 && linksEnd > forgot && adminButton > linksEnd, 'Admin button is immediately after the recovery links');
  assert.match(customerCard, /<a[^>]*id="adminSignInButton"[^>]*href="https:\/\/admin\.sidra-tourism\.com\/"[^>]*>Admin Sign In<\/a>/);
  assert.doesNotMatch(adminCard, /<a[^>]+href="https:\/\/admin\.sidra-tourism\.com\/"[^>]*>Admin Sign In<\/a>/);
  assert.equal((signin.match(/id="adminSignInButton"/g)||[]).length,1);
});
