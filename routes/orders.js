const express = require("express");
const router = express.Router();
const Delivery = require("../models/Delivery");
const User = require("../models/User");

// CHECKOUT LOGIC (No Auto-Assign)
router.post("/checkout", async (req, res) => {
  try {
    const { userId, userName, userPhone, location, totalAmount } = req.body;

    if (!userId || !location) {
      return res.status(400).json({ error: "Missing user or location data" });
    }

    // Payout Logic: Base 150 + 5%
    const driverPayout = Math.floor(150 + totalAmount * 0.05);

    // FIXED: Removed Auto-Assign. All jobs start as OPEN.
    // This allows Full-time and Gig drivers to compete/select based on availability.
    const newDelivery = new Delivery({
      orderId: `ORD-${Date.now()}`,
      customerName: userName,
      customerPhone: userPhone,
      pickupLocation: {
        lat: 9.005401,
        lng: 38.763611,
        address: "ShegaMart Central Warehouse",
      },
      dropoffLocation: {
        lat: location.lat,
        lng: location.lng,
        address: "Customer Location",
      },
      payout: driverPayout,
      status: "OPEN",
      type: "GIG", // Default to Gig, but visible to all
    });

    await newDelivery.save();
    res.json({ success: true, delivery: newDelivery });
  } catch (err) {
    console.error("Checkout Error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

// GET DELIVERIES
router.get("/my-list", async (req, res) => {
  try {
    const { driverId, type } = req.query;

    // 1. Always get jobs SPECIFICALLY assigned to this driver (Active jobs)
    const myJobs = await Delivery.find({
      driverId: driverId,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
    });

    // 2. Get OPEN jobs available for everyone
    const openJobs = await Delivery.find({
      status: "OPEN",
    });

    // Combine them.
    // Full-time drivers see OPEN jobs + Their assigned jobs.
    // Gig drivers see OPEN jobs + Their assigned jobs.
    res.json([...myJobs, ...openJobs]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
