// Sidra Tourism portal: pure role and request policy. Never trust role claims from browsers.
export const SERVICES = Object.freeze([
  { id: 'flights', name: 'Flights & Ticket Requests', group: 'Travel', customerRequest: true, integration: 'pending_supplier_access', live: false },
  { id: 'hotels', name: 'Hotel Reservations', group: 'Travel', customerRequest: true, integration: 'pending_supplier_access', live: false },
  { id: 'cars', name: 'Car Rentals & Transfers', group: 'Travel', customerRequest: true, integration: 'pending_supplier_access', live: false },
  { id: 'holidays', name: 'Holiday Packages', group: 'Travel', customerRequest: true, integration: 'manual_review', live: false },
  { id: 'visas', name: 'Visa Assistance', group: 'Travel', customerRequest: true, integration: 'manual_review', live: false },
  { id: 'insurance', name: 'Travel Insurance Enquiries', group: 'Travel', customerRequest: true, integration: 'pending_licensed_provider', live: false },
  { id: 'bsp', name: 'BSP Reporting & Settlement', group: 'IATA Operations', customerRequest: false, integration: 'external_iata_portal', live: false },
  { id: 'easypay', name: 'IATA EasyPay', group: 'IATA Operations', customerRequest: false, integration: 'external_iata_portal', live: false },
  { id: 'accreditation', name: 'Accreditation Management', group: 'IATA Operations', customerRequest: false, integration: 'external_iata_portal', live: false },
  { id: 'ticketing', name: 'Ticketing Authority & GDS/NDC', group: 'IATA Operations', customerRequest: false, integration: 'pending_airline_onboarding', live: false }
]);
const PERMISSIONS = Object.freeze({
  customer: ['create_request', 'view_own_requests'],
  support: ['view_requests', 'manage_requests'],
  ticketing: ['view_requests', 'manage_requests'],
  reservations: ['view_requests', 'manage_requests'],
  finance: ['view_finance'],
  admin: ['view_requests', 'manage_requests', 'view_finance', 'view_users'],
  super_admin: ['view_requests', 'manage_requests', 'view_finance', 'view_users', 'manage_roles']
});
export function can(role, permission) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, role) && PERMISSIONS[role].includes(permission);
}
export function canAccessService(role, service) {
  if (role === 'admin' || role === 'super_admin' || role === 'support') return true;
  if (role === 'ticketing') return service === 'flights';
  if (role === 'reservations') return ['hotels', 'cars', 'holidays', 'visas', 'insurance'].includes(service);
  return false;
}
export function parseRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request fields');
  const fields = Object.keys(input);
  if (fields.some(key => !['service', 'summary', 'details'].includes(key))) throw new Error('Unexpected request fields');
  const service = typeof input.service === 'string' ? input.service.trim() : '';
  if (!SERVICES.some(item => item.id === service && item.customerRequest)) throw new Error('Invalid service');
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const details = typeof input.details === 'string' ? input.details.trim() : '';
  if (summary.length < 3 || summary.length > 200) throw new Error('Invalid summary length');
  if (details.length > 1200) throw new Error('Invalid details length');
  return { service, summary, details };
}
export function validateStatus(status) {
  if (!['requested', 'reviewing', 'quoted', 'awaiting_customer', 'closed'].includes(status)) throw new Error('Invalid status');
  return status;
}

// Supabase opaque secret keys are not bearer JWTs. Never expose this header set to browsers.
export function buildServerHeaders(secret, upsert = false) {
  const headers = { apikey: secret, 'content-type': 'application/json', prefer: upsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation' };
  if (!secret.startsWith('sb_secret_')) headers.authorization = `Bearer ${secret}`;
  return headers;
}

export function validateDisplayName(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'displayName')) throw new Error('Invalid profile fields');
  const name = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (name.length < 1 || name.length > 100) throw new Error('Invalid display name length');
  return name;
}