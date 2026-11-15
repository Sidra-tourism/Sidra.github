import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { validateFlightSearch } from "./flight-policy.js";
import { createReadOnlyFareClient } from "./flight-offers-provider.js";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const bookings = [];
const contacts = [];

// Disabled without contracted production credentials and explicit public go-live approval.
const fareClient=createReadOnlyFareClient();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined
});

async function sendMailSafe({ to, subject, text }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { skipped: true, reason: "Email ENV not configured" };
  }
  return transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
}

app.get("/api/health", (req, res) => {
  res.json({ status: "working", message: "Sidra Tourism API Running" });
});

app.get("/api/flight-search", async (req, res) => {
  res.set("Cache-Control", "no-store");
  let criteria;
  try {
    criteria = validateFlightSearch(req.query);
  } catch (error) {
    return res.status(422).json({
      code: "INVALID_FLIGHT_SEARCH",
      error: error.message,
      results: []
    });
  }
  // Separate approval protects production from surprise paid API calls.
  // Do not activate until supplier contract, quotas, fraud controls and WAF verified.
  if (process.env.SIDRA_PUBLIC_FARES_ACTIVE !== "true" || !fareClient.enabled) {
    return res.status(503).json({
      code: "FLIGHT_PROVIDER_UNAVAILABLE",
      message: "Live fares are not connected. Request a verified quote from Sidra Tourism before payment.",
      criteria,
      results: [],
      pricesVerified: false,
      bookingEnabled: false,
      paymentEnabled: false
    });
  }
  try {
    // Read-only search. This does NOT verify the final ticket price or book seats.
    const result=await fareClient.search(criteria);
    return res.status(200).json(result);
  } catch (error) {
    const unavailable=error?.code==="FLIGHT_PROVIDER_UNAVAILABLE";
    return res.status(unavailable?503:502).json({
      code:unavailable?"FLIGHT_PROVIDER_UNAVAILABLE":"FLIGHT_PROVIDER_ERROR",
      message:"Live pricing is unavailable. Request a verified quote from Sidra Tourism before payment.",
      criteria,
      results:[],
      pricesVerified:false,
      bookingEnabled:false,
      paymentEnabled:false
    });
  }
});

app.get("/api/flight-status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(503).json({
    code: "FLIGHT_STATUS_PROVIDER_UNAVAILABLE",
    error: "Real-time flight status requires an authorized provider connection."
  });
});

app.post("/api/apply-coupon", (_req, res) => {
  return res.status(503).json({
    valid: false,
    code: "FARE_NOT_VERIFIED",
    error: "Discounts require a verified flight offer."
  });
});

app.post("/api/create-payment", (_req, res) => {
  // No payment provider is integrated yet. Do not imply a charge or payment is possible.
  res.status(501).json({ error: "Online payments are not available. Contact Sidra Tourism for a confirmed quotation." });
});

app.post("/api/confirm-booking", (_req, res) => {
  // An internal flag is insufficient. Require actual authorized inventory,
  // payment receipt, issued airline order/PNR and reconciliation first.
  res.set("Cache-Control", "no-store");
  return res.status(503).json({
    code: "TICKETING_NOT_AVAILABLE",
    error: "Booking confirmations require verified ticketing and payment connections."
  });
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
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_API_TOKEN) {
    return res.status(503).json({ error: "Admin login is not configured." });
  }
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return res.json({ status: "ok", role: "admin", token: process.env.ADMIN_API_TOKEN });
  }
  return res.status(401).json({ error: "Invalid credentials." });
});

app.get("/api/admin/bookings", (req, res) => {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token || req.get("authorization") !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  res.set("Cache-Control", "no-store");
  return res.json({ status: "working", bookings, contacts });
});

app.get("/api/ticket-validation", (req, res) => {
  res.json({ status: "working", message: "Ticket validation endpoint active" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Sidra Tourism API running on port ${PORT}`));
