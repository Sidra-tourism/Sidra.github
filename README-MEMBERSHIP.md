# Sidra Tourism — premium customer memberships (isolated preview)

**Stage:** design/implementation preview, NOT activated identity, ticketing, payments, documents or funds. This work builds on main's mandatory flight route/fare-integrity fixes; it does not merge the two older Sidra draft stacks, and does not touch Time Logistics or IK infrastructure.

## Customer experience
- Premium brand-aligned main site, retaining existing Sidra Tourism logo and validated flight search.
- Public header CTA: **Sign in / Create account** (customer entry). Staff/admin selection is on the account page.
- Account screens for email/password sign-in, create account, email OTP verification, forgot-password request and secure sign-out.
- Verified-account dashboard: Standard User label, server-assigned `SID-QA-YYYY-N######` ID, wallet code, passenger/family form, booking history, identity documents section, points and refund-credit records.
- Travel identity fields include first/middle/last names, date of birth, nationality, citizenship, address, optional SPID/national ID, passport number/expiry. Profile photo is optional. **Sensitive details and document uploads are not collected at signup**. Those may be submitted only after verified email, and document uploads remain disabled until private storage is operational.
- Premium `/admin-workspace` screen: server-authorized admin markup policy, supplier integration health, developer/MCP readiness; live commercial operations remain disabled.

## Account identity and OTP prerequisites
- Existing Sidra-only Supabase project reference observed in the browser: `rcavyshsxnzodoipsbun`, but the connected Supabase tool currently has **permission denied** for it. Do NOT use the Time Logistics database or copy its keys.
- Verify Sidra project ownership and approved database environment. Review and apply `database/sidra_membership.sql` only to that project **after a fresh backup and security review**. Additions create owner-scoped members/passengers/booking history, unique IDs, non-transferable credit/rewards ledgers, roles, admin markup and transactional audit; no live cash movements.
- Configure `SIDRA_SUPABASE_URL`, `SIDRA_SUPABASE_PUBLISHABLE_KEY` and `SIDRA_SUPABASE_SECRET_KEY` in the Sidra Vercel project (publishable may be exposed to browsers; secret must remain server-only).
- Configure `SIDRA_PII_ENCRYPTION_KEY_B64` as a random 32-byte key, base64 encoded, stored only in a secret manager and backed up securely for rotation/restore. **Never paste it into GitHub/chat.** Do not enable passenger writes until validated.
- In Supabase Auth, enable email confirmations and use an OTP template containing `{{ .Token }}`. Confirm `verifyOtp`/`signup` and recovery flows against the actual Sidra project before enabling customer signup.
- ONLY when full connection, data migration and access-control tests pass: set `SIDRA_MEMBERSHIP_ENABLED=true`; only then set `SIDRA_CUSTOMER_SIGNUP_ENABLED=true` after OTP sender verification, rate limiting, MFA and abuse checks. Those flags are currently intentionally absent.
- Owner/admin roles are provisioned manually after verified Sidra Auth UUID and MFA; public signup only provisions `customer`.

## Email sender clarification
The requested sender `no-reply@sidraperson.com` does **not** match the verified Sidra website domain `sidra-tourism.com`. Sender-domain control, DKIM/SPF/DMARC and a mailbox or authorized transactional provider have **not** been verified. Do not send from it or claim it is configured until ownership and the exact domain are confirmed. Email OTPs require custom authenticated SMTP in Supabase at launch.

## Ticketing, wallet and markup
- IATA EASY PAY is for agent-to-airline BSP settlement, not customer card checkout or a split-charge payment processor.
- Admin markup percentage is stored as basis points (e.g. 1000 = 10.00%); only server-authorized admin and an **atomic audited** DB operation may change it.
- Wallet and points ledgers are private membership accounting. No cash wallet, deposit, refund disbursement, withdrawals, ticket rewards or actual balances are fabricated.
- No charge or ticket issuance without a separately authorized live airline/GDS/NDC inventory provider, a merchant payment processor, supplier repricing, ticketing/PNR workflow, signed webhook, reconciliation and explicit production approval.
- Customer QR generation, secure image/document storage, owner wallet settlement and live reward accrual need additional implementation/verification. The UI labels these as pending rather than claiming they are active.

## Admin subdomain
`admin.sidra-tourism.com` is the intended private admin hostname, but is NOT provisioned in this preview. Creating its DNS or mapping it to public production before authenticated, isolated deployment would expose an unfinished login and is not approved.

## Tests
From the branch root: `node --test test/membership.test.js test/membership-routes.test.js`. The tests cover member ID formatting, 10% markup arithmetic, strict signup/passenger validation, encryption, fail-closed configuration and authorization, preview content and DB security guardrails. Browser/auth, RLS, private storage, receipt, real payment and issuance end-to-end testing remain pending.