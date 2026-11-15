# Sidra Tourism — isolated free-first booking enquiry platform

A separate Cloudflare Workers + D1 prototype. It does **not** reuse Time Logistics or IK.business accounts, infrastructure, data or credentials. It starts with request-to-book, NOT unlicensed live ticket issuance.

## Scope
- Responsive public website reusing the original repository public/logo.png at build time.
- Flight, hotel, holiday, transfer, visa assistance and insurance enquiries.
- Server-side strict request validation, mandatory Cloudflare Turnstile, private D1 enquiry table.
- No public admin/data read API; no auto-ticketing, PNR, payment, live fares, scraping or IATA credential reuse.
- Sidra contact email: admin@sidra-tourism.com. The full office address is withheld until verified by Sidra Tourism.

## Costs and safety
GitHub Free and Cloudflare Workers Free + D1 Free can support limited development and low-volume use. Free services have quotas and no uptime guarantee. Never promise uninterrupted operation. Do not mix Sidra with any existing company accounts.

## Testing
Run the test command from sidra-free: npm test.
Run the build command from sidra-free: npm run build. The build copies the real Sidra logo from ../public/logo.png into site/logo.png. Keep all secrets outside GitHub.

## Deployment — only when Sidra's own Cloudflare account is ready
1. Create a **dedicated Sidra Tourism Cloudflare Free account** with a Sidra-controlled email. Do not use TLI or IK account.
2. Connect GitHub Sidra-tourism/Sidra.github and configure the root directory as sidra-free. Deploy to a staging workers.dev hostname first; keep the existing live website and DNS unchanged.
3. Create a **Sidra-only** Cloudflare D1 database called sidra-tourism. Apply sidra-free/schema.sql ONLY to this database. Add its actual ID to the commented d1_databases block in wrangler.toml under binding SIDRA_DB.
4. Create a Cloudflare Turnstile widget for the staging host. Set TURNSTILE_SITE_KEY as a public environment variable and store TURNSTILE_SECRET_KEY via Cloudflare secret management.
5. After configuring D1/Turnstile, run npm run build; deploy using an appropriate verified Wrangler version in the Sidra Cloudflare account.
6. Verify mobile, desktop, security challenge, persistence of a real test enquiry, and error paths before any DNS cutover.
7. Later, assign sidra-tourism.com to this site only after explicit production readiness approval. Preserve Hostinger email MX/SPF/DKIM records during DNS changes.

If D1 or Turnstile is unconfigured, the enquiry form stays disabled and the API fails closed, so customer data is not silently lost.

## Private Sidra owner dashboard — development module only
This branch now also includes an **independent**, authenticated Cloudflare Worker for staff/owner administration:

- `src/admin-worker.js`: verifies Cloudflare Access JWT signatures via its public JWKS, issuer, audience, expiration and `SIDRA_ADMIN_EMAIL` before serving **any** dashboard asset or API response.
- `admin-ui/`: minimal private enquiry-review screen; only verified owners can view enquiries or change the request state.
- `admin-schema.sql`: additive D1 audit-events table to log authorized status transitions.
- `wrangler.admin.toml`: separate admin Worker configuration; unlike the public Worker, all assets run through the authentication check first.
- `test/admin.test.js`: signed-token validation, refusal without configuration, denied access, origin controls, audit update tests.

**This dashboard is NOT deployed or accessible on the live domain yet.** Never copy an admin password or Access secret into GitHub. Keep `admin@sidra-tourism.com` as the designated owner, but use a Sidra-specific Cloudflare Access policy with MFA and strong session restrictions, not a hardcoded website password.

### Private admin staging checklist
1. Provision a Sidra-only Cloudflare account and D1 database. Apply public `schema.sql` **first** and then the additive `admin-schema.sql` in that same Sidra-only D1 database.
2. Set up a separate Cloudflare Access application for a private admin staging hostname; require only explicitly approved owner identities and MFA. Do not leave a publicly accessible `workers.dev` route on the admin Worker.
3. Configure the real `SIDRA_DB` binding in `wrangler.admin.toml`. Configure `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `SIDRA_ADMIN_EMAIL` as private Sidra-only Worker environment variables/secrets. Never use TLI/IK credentials or databases.
4. Deploy the public and admin Workers **separately to staging** from the feature branch. Test denial before authentication, owner login, authorized enquiry reads, unauthorized requests, audited status transitions, and deployment errors. Confirm both desktop and mobile.
5. Review an actual backup/restore procedure, rate limits, retention and privacy requirements before customer data or production usage. Leave existing `sidra-tourism.com` DNS, Vercel production, live ticketing, payments and automated bookings unchanged until reviewed and explicitly approved.

Customer self-service login and department-specific access controls remain **unimplemented** in this Cloudflare-only stack. A separate Supabase portal draft PR exists and must not be merged blindly with D1. The private dashboard module is owner-only, not a customer portal.


## IATA / travel provider
Owning the public site and managing quotations does not require Booking.com, Agoda or MyTrip. Real airline inventory, PNR, ticket issuance and BSP settlement require appropriate separate airline, GDS, NDC or supplier authorization. IATA accreditation alone does not provide a general-purpose booking API key.
