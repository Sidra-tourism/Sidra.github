/**
 * Validate customer-supplied flight search criteria, never invent fares.
 */
function requiredText(value, label, maxLength = 80) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required');
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length > maxLength) throw new Error(label + ' is invalid');
  return cleaned;
}
function airportCode(value, label) {
  const code = requiredText(value, label, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(label + ' must be a three-letter IATA airport code');
  return code;
}
function dateValue(value, label, min) {
  const s = requiredText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(label + ' is invalid');
  const date = new Date(s + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s || s < min) {
    throw new Error(label + ' is invalid or earlier than permitted');
  }
  return s;
}
function passengerCount(value, label, min, max) {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(label + ' passenger count is invalid');
  }
  return n;
}
export function validateFlightSearch(input, today = new Date().toISOString().slice(0, 10)) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Departure country is required');
  const fromCountry = requiredText(input.fromCountry, 'Departure country');
  const from = airportCode(input.from, 'Departure airport');
  const toCountry = requiredText(input.toCountry, 'Destination country');
  const to = airportCode(input.to, 'Destination airport');
  if (from === to) throw new Error('Departure and destination airports must be different');
  const departureDate = dateValue(input.departureDate, 'Departure date', today);
  const tripType = input.tripType || 'oneway';
  if (!['oneway', 'roundtrip'].includes(tripType)) throw new Error('Trip type is invalid');
  const returnDate = tripType === 'roundtrip' ? dateValue(input.returnDate, 'Return date', departureDate) : null;
  const adults = passengerCount(input.adults ?? 1, 'Adults', 1, 9);
  const children = passengerCount(input.children ?? 0, 'Children', 0, 8);
  if (adults + children > 9) throw new Error('Total passenger count exceeds 9');
  return { fromCountry, from, toCountry, to, departureDate, tripType, returnDate, adults, children };
}
