import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sampleFlights = [
  { id: "SIDRA-QR001", airline: "Qatar Airways", flight: "QR001", from: "DOH", to: "LHR", departure: "07:45", arrival: "13:15", duration: "7h 30m", stops: "Direct", price: "450", currency: "USD", status: "Available" },
  { id: "SIDRA-EK202", airline: "Emirates", flight: "EK202", from: "DOH", to: "LHR", departure: "10:30", arrival: "17:00", duration: "6h 30m", stops: "1 Stop", price: "480", currency: "USD", status: "Available" },
  { id: "SIDRA-TK1985", airline: "Turkish Airlines", flight: "TK1985", from: "DOH", to: "IST", departure: "11:20", arrival: "15:25", duration: "4h 05m", stops: "Direct", price: "380", currency: "USD", status: "Available" },
  { id: "SIDRA-FZ020", airline: "Flydubai", flight: "FZ020", from: "DOH", to: "DXB", departure: "14:10", arrival: "16:20", duration: "1h 10m", stops: "Direct", price: "220", currency: "USD", status: "Available" }
];

function getFallbackFlights(from, to) {
  const cleanFrom = String(from || "").trim().toUpperCase();
  const cleanTo = String(to || "").trim().toUpperCase();
  const filtered = sampleFlights.filter((flight) => {
    const matchesFrom = !cleanFrom || flight.from.includes(cleanFrom) || flight.airline.toUpperCase().includes(cleanFrom);
    const matchesTo = !cleanTo || flight.to.includes(cleanTo) || flight.airline.toUpperCase().includes(cleanTo);
    return matchesFrom && matchesTo;
  });
  return filtered.length ? filtered : sampleFlights;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getAmadeusToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetchWithTimeout("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) throw new Error(`Amadeus token error: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

function mapAmadeusOffer(offer) {
  const itinerary = offer.itineraries?.[0];
  const segments = itinerary?.segments || [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const carrier = firstSegment?.carrierCode || offer.validatingAirlineCodes?.[0] || "Airline";
  return {
    id: offer.id || `AMADEUS-${Math.random()}`,
    airline: carrier,
    flight: `${carrier}${firstSegment?.number || ""}`,
    from: firstSegment?.departure?.iataCode || "N/A",
    to: lastSegment?.arrival?.iataCode || "N/A",
    departure: firstSegment?.departure?.at ? new Date(firstSegment.departure.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    arrival: lastSegment?.arrival?.at ? new Date(lastSegment.arrival.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    duration: itinerary?.duration?.replace("PT", "").replace("H", "h ").replace("M", "m") || "Duration TBC",
    stops: segments.length > 1 ? `${segments.length - 1} stop(s)` : "Direct",
    price: offer.price?.total || "N/A",
    currency: offer.price?.currency || "USD",
    status: "Live Offer"
  };
}

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "working", message: "Sidra Tourism API Running" });
});

app.get("/api/flight-search", async (req, res) => {
  const from = String(req.query.from || "DOH").trim().toUpperCase();
  const to = String(req.query.to || "LHR").trim().toUpperCase();
  const departureDate = String(req.query.departureDate || new Date().toISOString().split("T")[0]);
  const adults = String(req.query.adults || "1");
  const fallback = getFallbackFlights(from, to);

  try {
    const token = await getAmadeusToken();
    if (!token) {
      return res.status(200).json({ status: "working", provider: "Sidra Tourism Demo Engine", mode: "demo", results: fallback });
    }

    const searchParams = new URLSearchParams({
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate,
      adults,
      currencyCode: "USD",
      max: "10"
    });

    const response = await fetchWithTimeout(`https://test.api.amadeus.com/v2/shopping/flight-offers?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`Amadeus search error: ${response.status}`);
    const data = await response.json();
    const liveResults = (data.data || []).map(mapAmadeusOffer);

    return res.status(200).json({
      status: "working",
      provider: "Amadeus Self-Service API",
      mode: "live-test",
      results: liveResults.length ? liveResults : fallback
    });
  } catch (error) {
    return res.status(200).json({
      status: "working",
      provider: "Sidra Tourism Demo Engine",
      mode: "fallback",
      message: error.name === "AbortError" ? "External API timeout; fallback data shown." : error.message,
      results: fallback
    });
  }
});

app.get("/api/flight-status", (req, res) => {
  res.status(200).json({ status: "working", flights: sampleFlights });
});

app.get("/api/ticket-validation", (req, res) => {
  res.status(200).json({ status: "working", message: "Ticket validation endpoint active" });
});

app.post("/api/booking-request", (req, res) => {
  res.status(200).json({ status: "received", message: "Booking request received.", request: req.body });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Sidra Tourism API running on port ${PORT}`);
});
