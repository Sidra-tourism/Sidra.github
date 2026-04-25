import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sampleFlights = [
  { id: "SIDRA-EK202", airline: "Emirates", flight: "EK202", from: "DXB", to: "LHR", departure: "09:30", arrival: "14:10", duration: "7h 40m", stops: "Direct", price: "320", currency: "USD", status: "On Time" },
  { id: "SIDRA-QR001", airline: "Qatar Airways", flight: "QR001", from: "DOH", to: "LHR", departure: "07:45", arrival: "13:15", duration: "7h 30m", stops: "Direct", price: "450", currency: "USD", status: "Available" },
  { id: "SIDRA-TK1985", airline: "Turkish Airlines", flight: "TK1985", from: "IST", to: "LHR", departure: "11:20", arrival: "13:25", duration: "4h 05m", stops: "Direct", price: "380", currency: "USD", status: "Available" }
];

function getFallbackFlights(from, to) {
  const cleanFrom = String(from || "").trim().toUpperCase();
  const cleanTo = String(to || "").trim().toUpperCase();
  const filteredFlights = sampleFlights.filter((flight) => {
    const matchesFrom = !cleanFrom || flight.from.includes(cleanFrom) || flight.airline.toUpperCase().includes(cleanFrom);
    const matchesTo = !cleanTo || flight.to.includes(cleanTo) || flight.airline.toUpperCase().includes(cleanTo);
    return matchesFrom && matchesTo;
  });
  return filteredFlights.length ? filteredFlights : sampleFlights;
}

async function getAmadeusToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) {
    throw new Error(`Amadeus token error: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

function mapAmadeusOffer(offer) {
  const firstItinerary = offer.itineraries?.[0];
  const firstSegment = firstItinerary?.segments?.[0];
  const lastSegment = firstItinerary?.segments?.[firstItinerary.segments.length - 1];
  const carrier = firstSegment?.carrierCode || offer.validatingAirlineCodes?.[0] || "Airline";

  return {
    id: offer.id,
    airline: carrier,
    flight: `${carrier}${firstSegment?.number || ""}`,
    from: firstSegment?.departure?.iataCode || "N/A",
    to: lastSegment?.arrival?.iataCode || "N/A",
    departure: firstSegment?.departure?.at ? new Date(firstSegment.departure.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    arrival: lastSegment?.arrival?.at ? new Date(lastSegment.arrival.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    duration: firstItinerary?.duration?.replace("PT", "").replace("H", "h ").replace("M", "m") || "Duration TBC",
    stops: firstItinerary?.segments?.length > 1 ? `${firstItinerary.segments.length - 1} stop(s)` : "Direct",
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

  try {
    const token = await getAmadeusToken();

    if (!token) {
      return res.status(200).json({
        status: "working",
        provider: "Sidra Tourism Demo Engine",
        mode: "demo",
        message: "Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET environment variables to enable live Amadeus data.",
        results: getFallbackFlights(from, to)
      });
    }

    const searchParams = new URLSearchParams({
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate,
      adults,
      currencyCode: "USD",
      max: "10"
    });

    const response = await fetch(`https://test.api.amadeus.com/v2/shopping/flight-offers?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Amadeus search error: ${response.status}`);
    }

    const data = await response.json();
    const results = (data.data || []).map(mapAmadeusOffer);

    return res.status(200).json({
      status: "working",
      provider: "Amadeus Self-Service API",
      mode: "live-test",
      results: results.length ? results : getFallbackFlights(from, to)
    });
  } catch (error) {
    return res.status(200).json({
      status: "working",
      provider: "Sidra Tourism Demo Engine",
      mode: "fallback",
      message: error.message,
      results: getFallbackFlights(from, to)
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
  res.status(200).json({ status: "received", message: "Booking request received. Sidra Tourism team will contact the customer shortly.", request: req.body });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Sidra Tourism API running on port ${PORT}`);
});
