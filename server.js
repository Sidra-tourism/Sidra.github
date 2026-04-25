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
  {
    id: "SIDRA-EK202",
    airline: "Emirates",
    flight: "EK202",
    from: "DXB",
    to: "LHR",
    departure: "09:30",
    arrival: "14:10",
    duration: "7h 40m",
    stops: "Direct",
    price: "320",
    currency: "USD",
    status: "On Time"
  },
  {
    id: "SIDRA-QR001",
    airline: "Qatar Airways",
    flight: "QR001",
    from: "DOH",
    to: "LHR",
    departure: "07:45",
    arrival: "13:15",
    duration: "7h 30m",
    stops: "Direct",
    price: "450",
    currency: "USD",
    status: "Available"
  },
  {
    id: "SIDRA-TK1985",
    airline: "Turkish Airlines",
    flight: "TK1985",
    from: "IST",
    to: "LHR",
    departure: "11:20",
    arrival: "13:25",
    duration: "4h 05m",
    stops: "Direct",
    price: "380",
    currency: "USD",
    status: "Available"
  }
];

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "working", message: "Sidra Tourism API Running" });
});

app.get("/api/flight-search", (req, res) => {
  const from = String(req.query.from || "").trim().toUpperCase();
  const to = String(req.query.to || "").trim().toUpperCase();

  const filteredFlights = sampleFlights.filter((flight) => {
    const matchesFrom = !from || flight.from.includes(from) || flight.airline.toUpperCase().includes(from);
    const matchesTo = !to || flight.to.includes(to) || flight.airline.toUpperCase().includes(to);
    return matchesFrom && matchesTo;
  });

  res.status(200).json({
    status: "working",
    provider: "Sidra Tourism Demo Engine",
    message: "Live Amadeus integration can be enabled after API keys are added.",
    results: filteredFlights.length ? filteredFlights : sampleFlights
  });
});

app.get("/api/flight-status", (req, res) => {
  res.status(200).json({ status: "working", flights: sampleFlights });
});

app.get("/api/ticket-validation", (req, res) => {
  res.status(200).json({ status: "working", message: "Ticket validation endpoint active" });
});

app.post("/api/booking-request", (req, res) => {
  res.status(200).json({
    status: "received",
    message: "Booking request received. Sidra Tourism team will contact the customer shortly.",
    request: req.body
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Sidra Tourism API running on port ${PORT}`);
});
