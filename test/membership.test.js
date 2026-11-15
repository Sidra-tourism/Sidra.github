import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMarkup, customerIdFromNumber, walletIdFromNumber, validatePassenger, validateSignupDetails, cleanSettings } from '../lib/membership-core.js';

test('2026 customer ID is SID-QA-2026-N000001 and deterministic',()=> {
  assert.equal(customerIdFromNumber(1,2026),'SID-QA-2026-N000001');
  assert.equal(customerIdFromNumber(1001,2026),'SID-QA-2026-N001001');
  assert.throws(()=>customerIdFromNumber(-1,2026));
});
test('wallet codes are distinct by sequence and not used as payment instruments',()=>{
  assert.equal(walletIdFromNumber(1,2026),'SID-WLT-2026-000001');
  assert.notEqual(walletIdFromNumber(1,2026),walletIdFromNumber(2,2026));
});
test('10 percent admin markup is calculated in minor currency units, no imaginary supplier price',()=>{
  assert.deepEqual(computeMarkup({baseMinor:12345,markupBasisPoints:1000}),{baseMinor:12345,markupMinor:1235,totalMinor:13580,markupBasisPoints:1000});
  assert.throws(()=>computeMarkup({baseMinor:-1,markupBasisPoints:1000}));
  assert.throws(()=>computeMarkup({baseMinor:100,markupBasisPoints:11000}));
  assert.throws(()=>computeMarkup({baseMinor:NaN,markupBasisPoints:1000}));
});
test('validated member signup saves only minimum contact details',()=>{
  const details=validateSignupDetails({firstName:' Mira ',middleName:'',lastName:' Saleh ',email:'MIRA@EXAMPLE.COM',phone:'+974 5555 1212'});
  assert.equal(details.email,'mira@example.com');
  assert.equal(details.firstName,'Mira');
  assert.equal('passportNumber' in details,false);
  assert.throws(()=>validateSignupDetails({...details, role:'super_admin'}));
});
test('saved passengers must have complete identity and valid expiry when passport supplied',()=>{
  const person={firstName:'Mira',middleName:'',lastName:'Saleh',dob:'2001-06-13',nationality:'Qatar',citizenship:'Qatar',relationship:'self',passportNumber:'A12345678',passportExpiry:'2030-07-01'};
  assert.equal(validatePassenger(person, '2026-11-15').passportNumber,'A12345678');
  assert.throws(()=>validatePassenger({...person,passportExpiry:'2020-01-01'},'2026-11-15'),/expiry/i);
  assert.throws(()=>validatePassenger({...person,role:'admin'},'2026-11-15'));
  assert.throws(()=>validatePassenger({...person,passportNumber:'',passportExpiry:'2030-07-01'},'2026-11-15'));
});
test('admin markup is not client controlled and percentage remains bounded',()=>{
  assert.equal(cleanSettings({markupBasisPoints:1000}).markupBasisPoints,1000);
  assert.throws(()=>cleanSettings({markupBasisPoints:1000,adminWallet:'my-account'}));
  assert.throws(()=>cleanSettings({markupBasisPoints:20001}));
});