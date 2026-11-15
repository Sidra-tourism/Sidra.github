'use strict';
const $ = id => document.getElementById(id);
const state = { config: null, token: sessionStorage.getItem('sidra_portal_session') || '', user: null, services: [], view: 'services' };
const staff = new Set(['support', 'ticketing', 'reservations', 'finance', 'admin', 'super_admin']);
const statuses = ['requested', 'reviewing', 'quoted', 'awaiting_customer', 'closed'];
function element(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text); if (className) n.className = className; return n; }
function message(text, type = '') { $('notice').textContent = text; $('notice').className = `notice ${type}`; }
async function json(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Unable to complete request');
  return value;
}
async function api(path, options = {}) {
  if (!state.token) throw new Error('Sign in first');
  const result = await json(`/api/portal/${path}`, { ...options, headers: { authorization: `Bearer ${state.token}`, ...(options.body ? { 'content-type': 'application/json' } : {}) } });
  return result;
}
function navigate(view) {
  state.view = view;
  for (const v of ['services', 'requests', 'admin']) $(`${v}Panel`).classList.toggle('hidden', view !== v);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === view));
  if (view === 'requests' && state.user) loadRequests();
  if (view === 'admin' && state.user) loadAdmin();
}
function renderServices() {
  const grid = $('serviceGrid'); grid.replaceChildren(); $('serviceSelect').replaceChildren();
  for (const item of state.services) {
    const card = element('article', undefined, 'service');
    card.append(element('div', item.group, 'meta'), element('h3', item.name), element('p', item.customerRequest ? 'Send an enquiry to the Sidra team. A verified offer is required before booking.' : 'Available through separate authorized IATA or provider access.', 'sub'), element('p', item.integration.replaceAll('_',' '), 'state'));
    if (item.customerRequest) {
      const opt = element('option', item.name); opt.value = item.id; $('serviceSelect').append(opt);
      const btn = element('button', 'Request review', 'action'); btn.type = 'button'; btn.addEventListener('click', () => { navigate('requests'); $('serviceSelect').value = item.id; if (!state.user) message('Sign in to submit a travel enquiry.', 'warn'); }); card.append(btn);
    } else {
      const a = element('a', 'Open IATA portal', 'action'); a.href = 'https://portal.iata.org/s/'; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a);
    }
    grid.append(card);
  }
}
function renderAuth() {
  const logged = !!state.user;
  $('authPanel').classList.toggle('hidden', logged);
  $('logout').classList.toggle('hidden', !logged);
  $('adminNav').classList.toggle('hidden', !(logged && staff.has(state.user.role)));
  $('currentRole').textContent = logged ? `${state.user.role.replaceAll('_', ' ')} • ${state.user.email}` : 'Guest';
  $('signUp').classList.toggle('hidden', !state.config?.customerSignupEnabled);
  $('signIn').disabled = !state.config?.configured;
  $('signUp').disabled = !state.config?.configured;
  if (!logged && state.view === 'admin') navigate('services');
  if (logged) message(`Signed in as ${state.user.role.replaceAll('_', ' ')}. Access is restricted to your assigned role.`);
}
async function restoreUser() {
  if (!state.token || !state.config?.configured) { state.token = ''; state.user = null; renderAuth(); return; }
  try { state.user = (await api('me')).user; } catch { state.user = null; state.token = ''; sessionStorage.removeItem('sidra_portal_session'); }
  renderAuth();
}
async function signIn(event) {
  event.preventDefault();
  if (!state.config?.configured) return message('Authentication is not configured.', 'warn');
  const email = $('email').value.trim(); const password = $('password').value;
  try {
    const result = await json(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: state.config.supabaseAnonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!result.access_token) throw new Error('No session returned');
    state.token = result.access_token; sessionStorage.setItem('sidra_portal_session', state.token); $('password').value = ''; await restoreUser();
  } catch (e) { message(e.message, 'error'); }
}
async function signUp() {
  if (!state.config?.configured || !state.config.customerSignupEnabled) return;
  try {
    const result = await json(`${state.config.supabaseUrl}/auth/v1/signup`, { method: 'POST', headers: { apikey: state.config.supabaseAnonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }) });
    message(result.id ? 'Account created. Confirm your email if requested, then sign in.' : 'Registration submitted. Check your email for confirmation.');
    $('password').value = '';
  } catch (e) { message(e.message, 'error'); }
}
function logout() { state.user = null; state.token = ''; sessionStorage.removeItem('sidra_portal_session'); renderAuth(); navigate('services'); message('Signed out.'); }
function renderRequest(row, management = false) {
  const item = element('article', undefined, 'record'); item.append(element('h4', `${row.service.toUpperCase()}: ${row.summary}`), element('p', row.details || 'No additional details.'), element('p', `Status: ${row.status} • Created: ${new Date(row.created_at).toLocaleString()}`));
  if (management && ['admin', 'super_admin', 'ticketing', 'reservations', 'support'].includes(state.user?.role)) {
    const select = element('select'); for (const v of statuses) { const o = element('option', v.replaceAll('_',' ')); o.value = v; select.append(o); } select.value = row.status;
    const save = element('button', 'Update', 'outline'); save.addEventListener('click', async () => { try { await api(`admin/requests/${encodeURIComponent(row.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); message('Request status updated.'); await loadAdmin(); } catch (e) { message(e.message, 'error'); } });
    const actions = element('div', undefined, 'row'); actions.append(select, save); item.append(actions);
  } return item;
}
async function loadRequests() {
  const list = $('requestList'); list.replaceChildren();
  if (!state.user) { list.append(element('p', 'Sign in to view requests.', 'hint')); return; }
  try { const result = await api('requests'); for (const row of result.requests) list.append(renderRequest(row)); if (!result.requests.length) list.append(element('p', 'No requests yet.', 'hint')); } catch (e) { message(e.message, 'error'); }
}
async function createRequest(e) {
  e.preventDefault();
  if (!state.user) return message('Sign in before submitting a request.', 'warn');
  const payload = { service: $('serviceSelect').value, summary: $('summary').value.trim(), details: $('details').value.trim() };
  try { await api('requests', { method: 'POST', body: JSON.stringify(payload) }); $('requestForm').reset(); message('Your enquiry has been received for staff review. This is not a confirmed booking.'); await loadRequests(); } catch (err) { message(err.message, 'error'); }
}
async function loadAdmin() {
  $('adminRequests').replaceChildren(); $('adminOverview').replaceChildren();
  if (!staff.has(state.user?.role)) return;
  if (state.user.role === 'finance') {
    $('adminOverview').append(element('p', 'Finance reports require a separately approved BSP or payment integration. No live financial information is available.', 'hint'));
  } else {
    try {
      const [overview, requests] = await Promise.all([api('admin/overview'), api('requests')]);
      const stats = [{ key: 'Recent accessible requests', value: overview.recentRequests }, { key: 'Under review', value: overview.statusCounts.reviewing || 0 }, { key: 'Awaiting customer', value: overview.statusCounts.awaiting_customer || 0 }];
      for (const x of stats) { const c = element('div', undefined, 'stat'); c.append(element('span', x.key), element('b', x.value)); $('adminOverview').append(c); }
      for (const row of requests.requests) $('adminRequests').append(renderRequest(row, true));
      if (!requests.requests.length) $('adminRequests').append(element('p', 'No accessible requests.', 'hint'));
    } catch (e) { message(e.message, 'error'); }
  }
  $('rolesPanel').classList.toggle('hidden', state.user.role !== 'super_admin');
  if (['admin', 'super_admin'].includes(state.user.role)) {
    try {
      const users = (await api('admin/users')).users; const list = $('userList'); list.replaceChildren();
      for (const u of users) list.append(element('p', `${u.display_name || 'User'} • ${u.role} • ${u.id}`, 'hint'));
      if (!users.length) list.append(element('p', 'No registered profiles.', 'hint'));
    } catch (e) { message(e.message, 'error'); }
  }
}
async function updateRole(e) {
  e.preventDefault();
  if (state.user?.role !== 'super_admin') return message('Owner authorization required.', 'error');
  try { await api(`admin/users/${encodeURIComponent($('userId').value.trim())}/role`, { method: 'PATCH', body: JSON.stringify({ role: $('assignedRole').value }) }); message('User role updated.'); await loadAdmin(); } catch (err) { message(err.message, 'error'); }
}
async function init() {
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));
  $('loginForm').addEventListener('submit', signIn); $('signUp').addEventListener('click', signUp); $('logout').addEventListener('click', logout);
  $('requestForm').addEventListener('submit', createRequest); $('roleForm').addEventListener('submit', updateRole);
  try {
    const [config, data] = await Promise.all([json('/api/portal/config'), json('/api/portal/services')]);
    state.config = config; state.services = data.services; renderServices();
    $('connectionStatus').textContent = config.configured ? 'Identity provider connected' : 'Configuration required';
    if (!config.configured) message('Authentication and ticketing integrations are awaiting dedicated Sidra configuration. Existing public website remains available.', 'warn');
    await restoreUser();
  } catch (e) { message(`Portal setup could not load: ${e.message}`, 'error'); }
}
init();