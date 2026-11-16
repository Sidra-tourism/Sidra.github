import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('Sidra homepage gives a clear Qatar experiences entry point',()=>{
 const page=read('index.html');
 assert.match(page,/href="\/qatar-experiences\.html"/);
 assert.match(page,/Qatar Experiences/);
});
test('Qatar guided experiences page is branded and mobile responsive',()=>{
 const s=read('qatar-experiences.html');
 for(const x of ['Sidra Tourism','Khor Al Adaid','Doha desert sunset','Qatar culture','licensed local operator','Request an enquiry','admin@sidra-tourism.com'])assert.ok(s.includes(x),x);
 assert.match(s,/<meta name="viewport"/);
 assert.match(s,/@media\s*\(max-width:\s*720px\)/);
});
test('guided sightseeing is not falsely sold as booked inventory or live pricing',()=>{
 const s=read('qatar-experiences.html');
 assert.doesNotMatch(s,/\bQAR\s*\d{2,}/i);
 assert.doesNotMatch(s,/\bBook now\b/i);
 assert.doesNotMatch(s,/ticket issued|instant confirmed/i);
 assert.match(s,/availability.*operator/i);
 assert.doesNotMatch(s,/dune bashing|self-drive|quad biking/i);
});
test('do not claim agency IATA accreditation or use agent logo without confirmation',()=>{
 const s=read('index.html');
 assert.doesNotMatch(s,/ACCREDITED IATA AGENT/);
 assert.doesNotMatch(s,/iata-logo\.(?:png|svg)/i);
});
