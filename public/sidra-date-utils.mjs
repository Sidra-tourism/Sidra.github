// Sidra Tourism local-calendar helpers. Calendar dates are not UTC timestamps.
export function localDateISO(date = new Date()) {
  const p=(n)=>String(n).padStart(2,'0');
  return date.getFullYear()+'-'+p(date.getMonth()+1)+'-'+p(date.getDate());
}
export function validLocalISO(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return false;
  const [y,m,d]=iso.split('-').map(Number);
  const parsed=new Date(y,m-1,d);
  return parsed.getFullYear()===y&&parsed.getMonth()===m-1&&parsed.getDate()===d;
}
export function addLocalDays(dateISO,days){
  if(!validLocalISO(dateISO)||!Number.isInteger(days)||Math.abs(days)>3660)throw Error('Invalid calendar date');
  const [y,m,d]=dateISO.split('-').map(Number);
  const date=new Date(y,m-1,d,12,0,0); // noon avoids DST-midnight gaps
  date.setDate(date.getDate()+days);
  return localDateISO(date);
}
export function formatTravelDate(iso,locale='en-US'){
  if(!validLocalISO(iso))return 'Select dates';
  const [y,m,d]=iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale,{weekday:'short',month:'short',day:'numeric'}).format(new Date(y,m-1,d,12));
}
export function formatTravelRange(from,to,locale='en-US'){
  return formatTravelDate(from,locale)+(to?' – '+formatTravelDate(to,locale):'');
}
export function validTravelRange(from,to,minDate=localDateISO()){
  return validLocalISO(from)&&validLocalISO(to)&&from>=minDate&&to>=from;
}
