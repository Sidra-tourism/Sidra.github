/** Sidra Tourism only. No third-party fares, ticket issuance or payment claims. */
export const SERVICES = Object.freeze([
  Object.freeze({ id: 'flights', title: 'Flight enquiries', description: 'Request routes, dates and a verified quotation.' }),
  Object.freeze({ id: 'hotels', title: 'Hotel enquiries', description: 'Ask Sidra for a hotel quotation.' }),
  Object.freeze({ id: 'holidays', title: 'Holiday packages', description: 'Arrange a reviewed travel itinerary.' }),
  Object.freeze({ id: 'transfers', title: 'Transfers & car rentals', description: 'Ask for airport transfers or vehicle options.' }),
  Object.freeze({ id: 'visas', title: 'Visa assistance', description: 'Enquire about travel-document services.' }),
  Object.freeze({ id: 'insurance', title: 'Travel insurance enquiry', description: 'Request an authorized provider referral.' })
]);
const KEYS = new Set(['service', 'fullName', 'email', 'phone', 'origin', 'destination', 'travelDate', 'travelers', 'notes']);
function cleanString(value, min, max, label) {
  if (typeof value !== 'string') throw new Error(label + ' is required');
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(label + ' has invalid length');
  return text;
}
function optional(value, max, label) {
  if (value === undefined || value === null || value === '') return '';
  return cleanString(value, 1, max, label);
}
function validDate(value) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid travel date');
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error('Invalid travel date');
  return value;
}
export function validateEnquiry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid enquiry');
  if (Object.keys(input).some(key => !KEYS.has(key))) throw new Error('Unsupported enquiry field');
  const service = cleanString(input.service, 1, 30, 'Service');
  if (!SERVICES.some(s => s.id === service)) throw new Error('Invalid service');
  const fullName = cleanString(input.fullName, 2, 90, 'Name');
  const email = cleanString(input.email, 3, 254, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  const phone = optional(input.phone, 35, 'Phone');
  if (phone && !/^[+\d\s()\-.]{5,35}$/.test(phone)) throw new Error('Invalid phone');
  const origin = optional(input.origin, 80, 'Origin');
  const destination = optional(input.destination, 80, 'Destination');
  const travelDate = validDate(input.travelDate);
  const travelers = input.travelers === undefined || input.travelers === '' ? 1 : Number(input.travelers);
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 9) throw new Error('Invalid passenger count');
  const notes = optional(input.notes, 1200, 'Notes');
  return { service, fullName, email, phone, origin, destination, travelDate, travelers, notes };
}
