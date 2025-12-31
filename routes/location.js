// routes/location.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// 1. Secure Proxy for Reverse Geocoding (Getting address from Lat/Lng)
router.get("/reverse", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "Missing coords" });

    // Native fetch (Node 18+) or install node-fetch if using older node
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "ShegaMart-App/1.0", // Nominatim requires a User-Agent
          "Accept-Language": "en",
        },
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Geocoding Error:", error);
    res.status(500).json({ error: "Failed to fetch address" });
  }
});

// 2. Secure Proxy for Search (Searching for a place name)
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query" });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q,
      )}&addressdetails=1&limit=5&countrycodes=et`,
      {
        headers: {
          "User-Agent": "ShegaMart-App/1.0",
        },
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "Failed to search location" });
  }
});

// 3. Update User Location in Database
router.put("/update-user-location", async (req, res) => {
  try {
    const { userId, location } = req.body; // location should be { lat, lng }

    if (!userId || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { location: location },
      { new: true }, // Return the updated document
    ).select("-password"); // Don't send back the password

    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("DB Update Error:", error);
    res.status(500).json({ error: "Database update failed" });
  }
});

module.exports = router;
