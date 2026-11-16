# SIDRA TOURISM | LIVE AIRLINE TICKETING & OPERATIONS RELEASE PLAN
**Status:** implementation planning / private admin preview; **NO PRODUCTION TICKETING APPROVAL** as of 2026-11-16.
**Legal entity:** Sidra Tourism LLC, Doha, Qatar. Director is an IATA/IATAN ID card holder. Agency-level BSP/ticket authority and public logo usage still need source verification.

## 1. Distribution decision and provider entitlement
The IATA NDC standard describes distribution messages; it does not provide a universal airline fare/booking key by itself.
Primary candidate: Nuitée Connect Flights API, which provides a single supplier integration across GDS/NDC/LCC networks.
- **Sandbox Flights API**: same \`sand_...\` key type as Hotels; sandbox inventory and prices are synthetic/incomplete.
- **Production Flights API**: specifically activate/request in Nuitée dashboard (not enabled automatically by hotel production access).
- **Ticketing and ownership**: confirm which airline/consolidator issues tickets, financial settlement, refunds, support, taxes, IATA arrangements, and permitted payment method.
- **IATA agency**: verify BSP / BSPlink participation and airline ticketing authority in the IATA portal; the director's ID card is not equivalent to all agency entitlements.

Sources:
https://docs.nuitee.com/docs/getting-access-to-flights
https://nuitee.com/connect/flights
https://www.iata.org/en/services/travel-agency-program/accreditation-travel/

## 2. Correct live flight flow (all server-mediated)
1. **Search:** \`POST /v3.0/flights/rates\` with legs, passenger composition, point-of-sale country and currency. No cached/placeholder "real fares".
2. **Select and verify:** \`/flights/verify\` immediately before checkout; show changed price, baggage rules, limitations, fare expiry, cancellation conditions.
3. **Prebook:** capture validated passengers (including passport/identity only if the actual route needs it) and contact details, then \`/flights/prebook\`. Store provider's \`prebookId\`, \`transactionId\` and expiration securely; never expose API secret.
4. **Payment:** provider-recommended Nuitée Stripe Payment SDK, \`usePaymentSdk: true\`, latest payment intent transaction. Customer payment must be verified via server-side signed gateway webhook or trusted provider lookup (not a browser redirect or user-provided Boolean).
5. **Complete reservation:** only after payment is verified, call \`POST /v3.0/flights/bookings\` with original prebook and latest transaction. Use retries with idempotency keys and a persistent booking ledger; do not duplicate bookings on timeouts.
6. **Pending state:** \`bookingId\` / \`bookingRef\` may exist while airline ticketing is still pending. Admin must see **supplier pending / ticket pending**; customer sees "**We are confirming your booking**."
7. **Confirm ticket:** subscribe to \`flight.book.confirmed\`, authenticate delivery (shared token and documented HMAC where available), deduplicate \`event_id\`, re-fetch \`GET /v3.0/flights/bookings/{bookingId}\` when needed, validate final status and ticket data, and only then mark **ticket issued**. Later \`flight.book.pending.confirmation\` events must never downgrade a confirmed booking.
8. **Fulfil:** enqueue an email job to the customer with airline, itinerary, booking reference, fare rules, baggage, ticket number if provided, help contact and any required regulatory disclosures. Set \`customer_notified_at\` ONLY after email provider delivery acceptance. Independently enqueue an admin notification, an auditable record, and a customer account itinerary update.
9. **After-sales:** supplier schedule changes, cancellations, refunds, disputes, chargebacks and amendments require explicit workflows, agent intervention, audit and customer updates. No silent refund or ticket voiding.

Official flow: https://docs.nuitee.com/docs/build-a-flight-booking-experience
Booking API: https://docs.nuitee.com/reference/post_flights-bookings
Confirmed booking: https://docs.nuitee.com/reference/get_flights-bookings-bookingid
Webhook event catalogue: https://docs.nuitee.com/docs/using-liteapi-webhooks
Stripe server-side verification: https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted

## 3. Architecture and duties
\`\`\`
Public mobile/web search
   -> Sidra server validation + current supplier offer API
   -> Verify / prebook + pending booking record
   -> Secure payment SDK + signed webhook
   -> Idempotent booking-confirmation worker
   -> Nuitée airline / consolidator
   -> Signed flight.book.confirmed + authoritative provider GET
   -> Durable DB event log + notification outbox
   -> Customer ticket email AND admin portal booking alert
\`\`\`
Enforce:
- **Server-side-only secrets** for supplier APIs, payment webhook verification, email and customer private details.
- **Persistent Postgres** booking state, payment ledger, webhook event ID dedupe and transactional outbox; avoid in-memory processing for customer money.
- **Role-based identity** and Row Level Security; only a verified booking event can move a flight to \`ticket_issued\`.
- **Secrets isolated to Sidra**, not TLI or IK; separate Preview and Production secrets and deployments.
- **Strong event validation:** signed webhook, fixed supplier host, exact booking ID, amount/currency reconciliation, replay defense, out-of-order event handling, and fail-closed state machine.
- **No ticket attachment or customer confirmation** when payment succeeded but carrier ticket status remains unconfirmed.
- **Customer service controls** for errors and refunds, and operational alerts requiring human review.
- **GDPR/privacy requirements** appropriate to applicable jurisdictions; minimize and encrypt sensitive traveller documents.

## 4. Admin operational departments
Preview includes: overview, bookings, flights, hotels, enquiries, customer directory, cars/transfers, Qatar guided experiences, finance/payment view, suppliers, IATA/distribution, integration status, admin notifications, reports, audit, documents, settings and profile.
Current implemented actions: manually log an enquiry, change its review status, create **private, enquiry-only** sightseeing drafts, read/acknowledge internal alerts. Persistent data requires the supplied Sidra-only SQL migration and owner-authenticated verification.
The following remain **not yet connected**: public enquiries, real customer membership, production supplier booking events, actual payment ledger, ticket/voucher documents, external email delivery, team HR and staff role management.

## 5. IATA branding release gate
The official IATA agent logo has restricted agency usage. It must come from the IATA Customer Portal's approved artwork archive and be displayed alongside the prescribed agent wording, only after verifying that Sidra's agency is eligible. Do not copy a logo out of the director's ID card or expose the personal card verification number publicly.
https://portal.iata.org/faq/s/article/How-can-my-agency-use-the-IATA-logo-and-which-type?language=en_US

## 6. Qatar experiences
Khor Al Adaid nature sightseeing, desert sunset scenery and guided cultural visits are **draft, enquiry-only concepts** pending agreements with licensed local guides/operators, operating safety requirements, pickup logistics and availability. No invented QAR rates or automatic booking/confirmation.
Official tourism context: https://visitqatar.com/intl-en/things-to-do/adventure-sports/desert/khor-al-adaid

## 7. Launch acceptance tests (hard blockers)
- [ ] Nuitée production flight entitlement confirmed in account and by supplier.
- [ ] Real authorized live fare search responds for two future origin/destination combinations.
- [ ] Fare verify expires/reprices correctly; correct baggage, currency and taxes displayed.
- [ ] Sandbox prebook→payment→book test succeeds with signed webhook and no double-booking.
- [ ] Payment gateway event signature, amount/currency validation and replay controls verified.
- [ ] Flight pending ticket → confirmed with real provider response, accurate ticket number.
- [ ] No ticket email on payment success or pending booking alone; verified confirmation email delivers once.
- [ ] Admin inbox receives booking, payment, failure, schedule-change and ticket alerts once.
- [ ] Supplier failure, timeout, refund and cancellation workflows tested.
- [ ] Customer signup/login, document privacy and session expiration tested.
- [ ] IATA agent branding authorization and agency eligibility verified.
- [ ] Production changes approved; monitoring, operational runbook, backups and rollback ready.

**Do not activate paid supplier bookings, ticketing, or customer payments before the above passes.**
