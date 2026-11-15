# Sidra Tourism — customer and admin workspace (review branch)

This implementation adds `/portal` without replacing the existing public site. It is **not a ticketing system** until a licensed supplier/GDS or NDC airline provides its own authorized credentials and backend integration. IATA accreditation, BSP access and airline API entitlements are separate.

## Current functionality

- Public travel-services catalogue with explicit integration statuses and IATA external access.
- Customer email/password sign-in and optional verified signup via a **Sidra-only Supabase project**.
- Editable signed-in customer profile (display name), immutable email/role from this UI, and customer request submission/trackers; no pretend ticket booking or payment acceptance.
- Restricted staff operations, department-scoped request status updates, owner-only role assignments, audit events.
- Fail-closed when authentication is not configured. No public admin elevation, no embedded service-role keys.

## Configuration (do not apply to TLI resources)

1. Provision a dedicated Sidra Supabase project under the authorized account (not the TLI database).
2. Review and apply `database/sidra_portal.sql` in the Sidra project. Keep RLS enabled.
3. Configure only in the Sidra Vercel project's server environment: `SIDRA_SUPABASE_URL`, `SIDRA_SUPABASE_PUBLISHABLE_KEY` (safe public key) and `SIDRA_SUPABASE_SECRET_KEY` (server-only, never exposed). Legacy `SIDRA_SUPABASE_ANON_KEY` and `SIDRA_SUPABASE_SERVICE_ROLE_KEY` remain fallback aliases only; and optionally `SIDRA_ALLOW_CUSTOMER_SIGNUP=true` after email confirmations are configured.
4. In Supabase Auth, set the Sidra domain as allowed site/redirect URL, and enable email verification, abuse controls and MFA for privileged users. The system does not grant the owner role automatically: verify the exact owner Auth UUID, then manually provision a single `super_admin` row in `sidra_user_roles` through an authorized admin process.
5. Review PR and preview deployment; test authentication, data isolation, department scopes, role changes, logging and rollback before production deployment.
6. For live air shopping/ticketing, separately contract an airline NDC API, a GDS, or approved aggregator, obtain issuer ticketing authority and confirm allowed BSP settlement/form-of-payment flows. Do not put API secrets into the frontend or GitHub.

## API separation

All Supabase data operations use a server-side service role after validation of an individual user access token; the frontend receives **only** the public publishable key and the user's own short-lived access token. Existing public demonstration fares remain demonstrations, and existing disabled payment/booking endpoints are untouched.

## Tests

`node --test test/portal.test.js` tests permission policy, department scoping, service request validation and safe status limitations. Runtime integration testing still requires a dedicated staging Supabase project and browser deployment.

## Safety notes

Never paste travel-agent personal login details, IATA portal cookies, Supabase service keys, NDC credentials or card details into code or chat. This portal intentionally does not import IATA portal content or scrape authenticated BSP pages. It does not use the decommissioned IATA Open API Hub.

The signup trigger is scoped to the `sidra_private` schema and not executable by browser roles. For opaque `sb_secret_*` keys the server sends only an `apikey` header, never `Authorization: Bearer sb_secret_*`.