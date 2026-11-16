const $ = selector => document.querySelector(selector);
const form = $('#enquiry-form');
let securityToken = '';
let ready = false;
function status(message, type = '') { const area = $('#form-status'); area.textContent = message; area.dataset.type = type; }
function setEnabled(enabled) { ready = enabled; $('#submit').disabled = !enabled; }
async function fetchJson(url, options) {
  const r = await fetch(url, { cache: 'no-store', ...options });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request unavailable');
  return data;
}
async function initialize() {
  try {
    const [catalogue, configuration] = await Promise.all([fetchJson('/api/services'), fetchJson('/api/config')]);
    const grid = $('#service-list'); grid.replaceChildren();
    for (const service of catalogue.services) {
      const card = document.createElement('article'); card.className = 'card';
      const heading = document.createElement('h3'); heading.textContent = service.title;
      const description = document.createElement('p'); description.textContent = service.description;
      const link = document.createElement('a'); link.href = '#enquiry'; link.textContent = 'Request a quote ↗';
      link.addEventListener('click', () => { $('#service').value = service.id; });
      card.append(heading, description, link); grid.append(card);
      const option = document.createElement('option'); option.value = service.id; option.textContent = service.title; $('#service').append(option);
    }
    if (!configuration.enquiriesEnabled || !configuration.turnstileSiteKey) {
      status('Online enquiries are being configured. Please contact Sidra Tourism by email.', 'warn');
      return;
    }
    status('Complete the security check to submit your enquiry.');
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      window.turnstile.render('#challenge', {
        sitekey: configuration.turnstileSiteKey,
        callback: token => { securityToken = token; setEnabled(true); status('Ready to send for review.'); },
        'expired-callback': () => { securityToken = ''; setEnabled(false); status('Security check expired. Please retry.', 'warn'); },
        'error-callback': () => { securityToken = ''; setEnabled(false); status('Security check unavailable.', 'warn'); }
      });
    };
    script.onerror = () => status('Security check cannot be loaded. Please contact our office.', 'warn');
    document.head.append(script);
  } catch { status('Travel enquiry service is unavailable. Please email the office.', 'warn'); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready || !securityToken) return;
  if (!form.reportValidity()) return;
  setEnabled(false); status('Sending your request…');
  const input = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await fetchJson('/api/enquiries', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, turnstileToken: securityToken })
    });
    form.reset(); securityToken = ''; window.turnstile?.reset();
    status('Enquiry received for staff review. Reference: ' + result.requestId + '. This is not a confirmed booking.', 'success');
  } catch (e) { securityToken = ''; window.turnstile?.reset(); status(e.message, 'warn'); }
});
initialize();
