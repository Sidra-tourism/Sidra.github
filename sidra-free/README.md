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

## Customer/admin login roadmap
Customer accounts and staff/admin access are **not active in this Cloudflare prototype**. Build with an authenticated identity provider, role-based authorization and audit trails before allowing access to saved enquiries. The separate Supabase portal PR must **not** be merged blindly with this D1 approach.

## IATA / travel provider
Owning the public site and managing quotations does not require Booking.com, Agoda or MyTrip. Real airline inventory, PNR, ticket issuance and BSP settlement require appropriate separate airline, GDS, NDC or supplier authorization. IATA accreditation alone does not provide a general-purpose booking API key.
