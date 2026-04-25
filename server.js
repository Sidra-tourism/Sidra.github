import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const bookings = [];
const contacts = [];

const sampleFlights = [
  { id: "SIDRA-QR001", airline: "Qatar Airways", flight: "QR001", from: "DOH", to: "LHR", departure: "07:45", arrival: "13:15", duration: "7h 30m", stops: "Direct", price: "450", currency: "USD", status: "Available" },
  { id: "SIDRA-EK202", airline: "Emirates", flight: "EK202", from: "DOH", to: "LHR", departure: "10:30", arrival: "17:00", duration: "6h 30m", stops: "1 Stop", price: "480", currency: "USD", status: "Available" },
  { id: "SIDRA-TK1985", airline: "Turkish Airlines", flight: "TK1985", from: "DOH", to: "IST", departure: "11:20", arrival: "15:25", duration: "4h 05m", stops: "Direct", price: "380", currency: "USD", status: "Available" },
  { id: "SIDRA-FZ020", airline: "Flydubai", flight: "FZ020", from: "DOH", to: "DXB", departure: "14:10", arrival: "16:20", duration: "1h 10m", stops: "Direct", price: "220", currency: "USD", status: "Available" }
];

const coupons = { SIDRA10: 10, WELCOME20: 20 };

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined
});

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

async function sendMailSafe({ to, subject, text }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { skipped: true, reason: "Email ENV not configured" };
  }
  return transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
}

app.get("/api/health", (req, res) => {
  res.json({ status: "working", message: "Sidra Tourism API Running" });
});

app.get("/api/flight-search", (req, res) => {
  const from = req.query.from || "DOH";
  const to = req.query.to || "LHR";
  res.json({ status: "working", provider: "Sidra Tourism Demo Engine", mode: "stable", results: getFallbackFlights(from, to) });
});

app.get("/api/flight-status", (req, res) => {
  res.json({ status: "working", flights: sampleFlights });
});

app.post("/api/apply-coupon", (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (coupons[code]) return res.json({ valid: true, code, discount: coupons[code] });
  res.json({ valid: false, discount: 0 });
});

app.post("/api/create-payment", (req, res) => {
  const amount = Number(req.body.amount || 0);
  res.json({
    status: "ready",
    provider: "PayPal",
    amount,
    message: "PayPal client-side checkout is ready. Add PAYPAL_CLIENT_ID to frontend when available."
  });
});

app.post("/api/confirm-booking", async (req, res) => {
  const data = req.body || {};
  const reference = `SIDRA-${Date.now()}`;
  const booking = { reference, createdAt: new Date().toISOString(), ...data };
  bookings.unshift(booking);

  const invoice = `SIDRA TOURISM\nAccredited IATA Agent\n\nBooking Confirmation / Invoice\nReference: ${reference}\nName: ${data.name || "Customer"}\nEmail: ${data.email || "N/A"}\nRoute: ${data.route || "N/A"}\nPassengers: ${data.passengers || "N/A"}\nCoupon: ${data.coupon || "N/A"}\nAmount: ${data.amount || "N/A"}\n\nOffice: Building 615, Al Tobah Street, Muaither, PO Box 1994, Ar-Rayyan, Qatar\nContact: +974 3336 6348\n\nThank you for booking with Sidra Tourism.`;

  const emailResult = await sendMailSafe({
    to: data.email || process.env.EMAIL_USER,
    subject: `Booking Confirmation - ${reference}`,
    text: invoice
  }).catch((error) => ({ error: error.message }));

  res.json({ status: "confirmed", reference, email: emailResult });
});

app.post("/api/contact", async (req, res) => {
  const data = req.body || {};
  contacts.unshift({ ...data, createdAt: new Date().toISOString() });
  const emailResult = await sendMailSafe({
    to: process.env.EMAIL_USER,
    subject: "New Sidra Tourism Contact Message",
    text: `Name: ${data.name || "N/A"}\nEmail: ${data.email || "N/A"}\nPhone: ${data.phone || "N/A"}\nMessage: ${data.message || "N/A"}`
  }).catch((error) => ({ error: error.message }));
  res.json({ status: "received", email: emailResult });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (email === (process.env.ADMIN_EMAIL || "admin@sidratourism.com") && password === (process.env.ADMIN_PASSWORD || "admin123")) {
    return res.json({ status: "ok", role: "admin" });
  }
  res.json({ status: "ok", role: "customer" });
});

app.get("/api/admin/bookings", (req, res) => {
  res.json({ status: "working", bookings, contacts });
});

app.get("/api/ticket-validation", (req, res) => {
  res.json({ status: "working", message: "Ticket validation endpoint active" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Sidra Tourism API running on port ${PORT}`));
