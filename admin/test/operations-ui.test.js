import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('corporate agency admin navigation includes essential travel departments',()=>{
 const html=file('public/index.html');
 for(const section of ['overview','bookings','flights','hotels','enquiries','customers','transfers','experiences','finance','suppliers','iata','integrations','notifications','reports','audit','documents','settings','profile']){
   assert.ok(html.includes('data-view="'+section+'"'),'missing '+section+' navigation');
   assert.ok(html.includes('id="'+section+'View"'),'missing '+section+' workspace view');
 }
});
test('workspace supports authenticated data, not fake booking counts',()=>{
 const js=file('public/operations-ui.js');
 assert.match(js,/\/api\/ops\//);
 assert.match(js,/\/summary/);
 assert.match(js,/\/integrations/);
 assert.match(js,/document\.createElement/);
 assert.match(js,/textContent/);
 assert.doesNotMatch(js,/innerHTML\s*=/);
 assert.doesNotMatch(js,/window\.localStorage/);
});
test('Qatar experiences are explicitly enquiry-only pending licensed supplier arrangements',()=>{
 const html=file('public/index.html');
 assert.match(html,/Khor Al Adaid/);
 assert.match(html,/enquiry-only/i);
 assert.match(html,/licensed local operator/i);
 assert.match(html,/id="experienceForm"/);
 assert.doesNotMatch(html,/\bQAR\s*[0-9]{2,}\b/i);
});
test('IATA identity status does not impersonate agency ticketing authority or bundle unlicensed logo',()=>{
 const html=file('public/index.html');
 assert.match(html,/IATA\/IATAN/);
 assert.match(html,/agency.*verification/i);
 assert.doesNotMatch(html,/iata-logo\.png|iata-logo\.svg/i);
});
test('corporate workspace cannot issue tickets or payments directly',()=>{
 const html=file('public/index.html'),js=file('public/operations-ui.js');
 assert.doesNotMatch(js,/\/api\/ops\/bookings['"]\s*,\s*\{method:\s*['"]POST/i);
 assert.doesNotMatch(js,/\/api\/flights\/bookings/);
 assert.match(html,/ticket issuance/i);
});
