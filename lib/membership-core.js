/** Sidra Tourism: deterministic policy only; cannot issue fares, tickets or cash balances. */
const escape = s => s.trim().replace(/\s+/g, ' ');
function isObject(input){return input && typeof input==='object' && !Array.isArray(input);}
function allowFields(input, allowed){if(!isObject(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unsupported fields');}
function required(value,label,max=100){if(typeof value!=='string'||!value.trim())throw new Error(label+' is required');const x=escape(value);if(x.length>max)throw new Error(label+' is invalid');return x;}
function optional(value,label,max=100){if(value==null||value==='')return '';return required(value,label,max);}
function validISODate(s,label){if(typeof s!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))throw new Error(label+' is invalid');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw new Error(label+' is invalid');return s;}
function code(id,year,prefix){if(!Number.isSafeInteger(id)||id<1||id>999999||!Number.isInteger(year)||year<2025||year>2100)throw new Error('Invalid sequence');return `${prefix}-${year}-${String(id).padStart(6,'0')}`;}
export const customerIdFromNumber=(id,year)=>code(id,year,'SID-QA').replace(/-(\d{6})$/,'-N$1');
export const walletIdFromNumber=(id,year)=>code(id,year,'SID-WLT');
export function computeMarkup({baseMinor,markupBasisPoints}){
  if(!Number.isSafeInteger(baseMinor)||baseMinor<0||baseMinor>10000000000)throw new Error('Invalid supplier amount');
  if(!Number.isInteger(markupBasisPoints)||markupBasisPoints<0||markupBasisPoints>10000)throw new Error('Invalid markup');
  const markupMinor=Math.round(baseMinor*markupBasisPoints/10000);
  return {baseMinor,markupMinor,totalMinor:baseMinor+markupMinor,markupBasisPoints};
}
export function validateSignupDetails(input){
 allowFields(input,['firstName','middleName','lastName','email','phone']);
 const firstName=required(input.firstName,'First name',80);
 const middleName=optional(input.middleName,'Middle name',80);
 const lastName=required(input.lastName,'Last name',80);
 const email=required(input.email,'Email',254).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email is invalid');
 const phone=required(input.phone,'Phone',25);
 if(!/^\+?[0-9\s().-]{6,25}$/.test(phone))throw new Error('Phone is invalid');
 return {firstName,middleName,lastName,email,phone};
}
export function validatePassenger(input,today=new Date().toISOString().slice(0,10)){
 allowFields(input,['firstName','middleName','lastName','dob','nationality','citizenship','relationship','passportNumber','passportExpiry','spidId','address']);
 const firstName=required(input.firstName,'First name',80),middleName=optional(input.middleName,'Middle name',80),lastName=required(input.lastName,'Last name',80);
 const dob=validISODate(input.dob,'Birth date');if(dob>today||dob<'1900-01-01')throw new Error('Birth date is invalid');
 const nationality=required(input.nationality,'Nationality',90),citizenship=required(input.citizenship,'Citizenship',90);
 const relationship=required(input.relationship,'Relationship',30);
 if(!['self','spouse','child','parent','other'].includes(relationship))throw new Error('Relationship is invalid');
 const passportNumber=optional(input.passportNumber,'Passport number',32).toUpperCase();
 const passportExpiry=optional(input.passportExpiry,'Passport expiry date',10);
 if(Boolean(passportNumber)!==Boolean(passportExpiry))throw new Error('Passport and expiry must both be provided');
 if(passportExpiry&&validISODate(passportExpiry,'Passport expiry')<today)throw new Error('Passport expiry is in the past');
 const spidId=optional(input.spidId,'SPID / National ID',60);
 const address=optional(input.address,'Address',300);
 return {firstName,middleName,lastName,dob,nationality,citizenship,relationship,passportNumber,passportExpiry,spidId,address};
}
export function cleanSettings(input){allowFields(input,['markupBasisPoints']);if(!Number.isInteger(input.markupBasisPoints)||input.markupBasisPoints<0||input.markupBasisPoints>10000)throw new Error('Invalid markup');return {markupBasisPoints:input.markupBasisPoints};}