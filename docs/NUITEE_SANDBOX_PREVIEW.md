# Sidra Tourism — private Nuitée hotel sandbox preview

This is a **development-only search adapter**, not a flight or hotel booking gateway. Production is fail-closed by design.

## Required variables (Vercel Preview environment ONLY)

| Variable | Purpose |
| --- | --- |
| `SIDRA_NUITEE_SANDBOX_ENABLED=true` | Explicit preview opt-in |
| `SIDRA_NUITEE_SANDBOX_API_KEY` | **Sandbox** Nuitée key beginning `sand_`, stored as a **Secret** |
| `SIDRA_NUITEE_PREVIEW_TOKEN` | Separate randomly generated secret (minimum 32 characters), stored as a **Secret** |
| `VERCEL_ENV` | Automatically set by Vercel; must be `preview` |

Never set any of these for Production, never supply a production key in the sandbox-key field, and never commit keys to GitHub. The API refuses all requests when `VERCEL_ENV=production`, irrespective of other settings.

## Preview-only endpoints

- `GET /api/hotel-sandbox/places?q=Paris` — destination lookup.
- `POST /api/hotel-sandbox/rates` — sample room rates.

Both require `Authorization: Bearer <SIDRA_NUITEE_PREVIEW_TOKEN>` and have `Cache-Control: no-store`.

Example POST body:

```json
{
  "placeId": "ChIJdd4hrwug2EcRmSrV3Vo6llI",
  "checkin": "2026-12-10",
  "checkout": "2026-12-12",
  "adults": 2,
  "rooms": 1,
  "guestNationality": "LK",
  "currency": "USD"
}
```

The response contains `sandbox: true`, `pricesVerified: false`, `bookingEnabled: false`, and `paymentEnabled: false`. No offer IDs or payment data are returned. If the provider's response is not explicitly marked as sandbox, the adapter refuses it.

No public homepage wiring or live price claims are included in this PR. Flight pricing, prebook, booking, payments and ticket issuance are all **out of scope**.

## Release gate

1. Run `node --test test/*.test.js` and syntax checks; review CI.
2. Set Preview-only variables using Vercel's secret storage; protect preview links.
3. Redeploy the isolated branch after setting variables; test controlled rate searches.
4. Verify data use, response shape, fees, regulatory approvals, logging and rate limiting before considering production integration.
5. Never merge a preview feature into production without preserving the production gate and verifying its behavior independently.

Official API documentation: https://docs.nuitee.com/reference/post_hotels-rates and https://docs.nuitee.com/reference/authentication
