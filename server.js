import express from "express";
import axios from "axios";

const app = express();

app.get("/", (req, res) => {
  res.send("Sidra Tourism API Running");
});

app.get("/api/flight-status", async (req, res) => {
  try {
    const response = await axios.get(
      "https://flight-status.iata.rapidapi.com/flights/status/20171231+EZY+0123+D",
      {
        headers: {
          "X-RapidAPI-Key": process.env.SIDRA_API_KEY,
          "X-RapidAPI-Host": "flight-status.iata.rapidapi.com"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
