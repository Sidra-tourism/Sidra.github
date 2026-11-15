# Sidra Tourism — Deployment readiness checkpoint (2026-11-15)

This is a **development-only** checkpoint for the independent Cloudflare Workers + D1 implementation on branch `feature/sidra-free-independent-stack`. It is not approval to deploy to production or merge the branch.

## Verified

- Dedicated **Sidra Tourism** Cloudflare dashboard is accessible in the owner's connected Opera session. The Workers & Pages dashboard displayed **No projects found** during read-only inspection.
- Public Sidra domain `sidra-tourism.com` responds HTTP 200 and still serves the existing Vercel-backed website. The `/api/health` response remains the original Express API; the independent Cloudflare Worker is not live.
- Private owner-only admin Worker code and static dashboard are committed to this Sidra-only repository; no other company repository or infrastructure was modified.
- The security tests reproduce and protect against malformed JWT claim objects and incorrectly reporting an unaudited status update as audited.
- Local private admin suite: **9 / 9 tests passed** after the fixes.
- GitHub Actions `Sidra independent free stack tests` completed successfully for commit `40c7e265c9d59a4a28a2e31885b9293b3e909a4c`.
- The public enquiry flow remains request-to-quote only. No live fares, PNR issuance, supplier or IATA API integration, payment collection, or automatic confirmation.

## Blocking prerequisites for staging

1. An **authorized write-capable Cloudflare account connection or approved owner-driven configuration** is needed. Connected Opera currently provides page inspection/navigation, not the ability to create/manage Workers, D1, secrets, or Access applications through this chat.
2. Create a **Sidra-only** D1 database. Apply `schema.sql` and the additive `admin-schema.sql`; use the returned Sidra D1 ID only in Sidra configuration.
3. Create a separate public staging Worker using `wrangler.toml`. Configure Cloudflare Turnstile **site key + secret** through secured Cloudflare settings. Never put secrets in this public Git repository.
4. Create a separate private staging Worker using `wrangler.admin.toml`. Configure Cloudflare Access with owner-only identity, MFA, a matching issuer and Access AUD. Avoid publishing an unprotected admin `workers.dev` endpoint.
5. Run real staging integration tests: Turnstile success/rejection, D1 enquiry persistence, sign-in and denied routes, permitted owner read and update, D1 audit writes, fault handling, mobile/desktop UX, and security headers.
6. Check data retention, privacy/legal basis, abuse limits, backup/restore, operational quotas, and monitoring. Free-tier plans do **not** guarantee uninterrupted uptime.
7. Do not merge either draft PR or change `sidra-tourism.com` / `www` DNS without explicit production release authorization. Preserve all Hostinger mail records (MX, SPF, DKIM, DMARC).

## Admin password/security note

Temporary passwords previously shared in chat must be **rotated** and must not be committed. The Cloudflare admin design does not use a hardcoded login password; it requires a dedicated Cloudflare Access identity and MFA.

## Separation

The independent Cloudflare enquiry platform (PR #2) and preview Supabase customer/admin portal (PR #1) are different architectures. **Do not combine their databases or merge these drafts automatically.** Preserve production Sidra, Time Logistics and IK systems.
