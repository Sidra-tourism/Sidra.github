import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Sidra Tourism API Running");
});

app.get("/api/flight-status", (req, res) => {
  res.status(200).json({
    status: "working",
    flights: [
      { flight: "EK202", from: "DXB", to: "LHR", status: "On Time" },
      { flight: "QR001", from: "DOH", to: "LHR", status: "Delayed" }
    ]
  });
});

app.get("/api/ticket-validation", (req, res) => {
  res.status(200).json({
    status: "working",
    message: "Ticket validation endpoint active"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
