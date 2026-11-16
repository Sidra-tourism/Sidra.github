import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
const loginScript=readFileSync(new URL('../public/sidra-ota.js', import.meta.url),'utf8');
const choices=readFileSync(new URL('../public/signin.html', import.meta.url),'utf8');

test('header renders one user icon and one Sign In label',()=>{
  const icon=page.match(/<a class="account-icon"[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(icon,'header sign-in link exists');
  assert.equal((page.match(/class="account-icon"/g)||[]).length,1);
  assert.equal((icon.match(/class="account-text"/g)||[]).length,1);
  assert.equal((icon.match(/>Sign In<\/span>/g)||[]).length,1);
  assert.match(icon,/href="\/signin\.html"/);
  assert.doesNotMatch(loginScript,/icon\.append\(accountLabel\)/);
  assert.doesNotMatch(loginScript,/icon\.addEventListener\(['"]click['"]/);
});

test('clicking the single header link navigates to Customer/Admin account choices',()=>{
  assert.match(page,/<a class="account-icon" href="\/signin\.html"/);
  assert.match(choices,/id="customerSignInCard"/);
  assert.match(choices,/id="adminSignInCard"/);
  assert.ok(choices.indexOf('id="customerSignInCard"')<choices.indexOf('id="adminSignInCard"'));
  assert.match(choices,/id="adminSignInButton"[^>]*href="https:\/\/admin\.sidra-tourism\.com\//);
  assert.doesNotMatch(loginScript,/quickSignIn|previewLoginForm|showModal\(/);
});
