import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== EMAIL CONFIG (SAFE: use ENV, not hardcoded) =====
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ===== SIMPLE COUPON ENGINE =====
const coupons = {
  "SIDRA10": 10,
  "WELCOME20": 20
};

app.post("/api/apply-coupon", (req, res) => {
  const { code } = req.body;
  if (coupons[code]) {
    return res.json({ valid: true, discount: coupons[code] });
  }
  res.json({ valid: false });
});

// ===== BOOKING + EMAIL =====
app.post("/api/confirm-booking", async (req, res) => {
  try {
    const data = req.body;

    const invoice = `
SIDRA TOURISM

Booking Confirmation

Name: ${data.name}
Route: ${data.route}
Passengers: ${data.passengers}
Amount: ${data.amount}

Thank you for booking with us.
`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: data.email,
      subject: "Booking Confirmation - Sidra Tourism",
      text: invoice
    });

    res.json({ status: "confirmed" });
  } catch (e) {
    res.json({ status: "error", message: e.message });
  }
});

// ===== CONTACT FORM =====
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Contact Form Message",
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    });

    res.json({ status: "sent" });
  } catch (e) {
    res.json({ status: "error" });
  }
});

// ===== BASIC LOGIN (MVP ONLY) =====
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@sidra.com" && password === "admin123") {
    return res.json({ role: "admin" });
  }

  res.json({ role: "customer" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log("Server running"));
