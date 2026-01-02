const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const User = require("../models/User");
const Delivery = require("../models/Delivery");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage Engine (Private Uploads)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shegamart_drivers",
    type: "private", // RESTRICTED ACCESS
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage: storage });

const driverUpload = upload.fields([
  { name: "selfie", maxCount: 1 },
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
]);

// 1. Apply to be a Driver
router.post("/apply", driverUpload, async (req, res) => {
  try {
    const { userId, jobType } = req.body;

    if (
      !req.files ||
      !req.files.selfie ||
      !req.files.idFront ||
      !req.files.idBack
    ) {
      return res
        .status(400)
        .json({
          error: "All 3 photos (Selfie, Front ID, Back ID) are required",
        });
    }

    // Cloudinary returns the 'public_id' or 'path' which we store
    // We store the public_id so we can generate signed URLs later
    const selfieId = req.files.selfie[0].filename;
    const idFrontId = req.files.idFront[0].filename;
    const idBackId = req.files.idBack[0].filename;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        driverStatus: "PENDING",
        driverType: jobType,
        driverDocs: {
          selfieUrl: selfieId, // Store Cloudinary Public ID
          idFrontUrl: idFrontId, // Store Cloudinary Public ID
          idBackUrl: idBackId, // Store Cloudinary Public ID
        },
      },
      { new: true },
    );

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Application failed" });
  }
});

// 2. Get Available Deliveries (unchanged)
router.get("/deliveries", async (req, res) => {
  try {
    const { type } = req.query;
    const deliveries = await Delivery.find({
      status: "OPEN",
      type: type || "GIG",
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Accept Delivery (unchanged)
router.post("/accept", async (req, res) => {
  try {
    const { deliveryId, driverId } = req.body;
    const delivery = await Delivery.findOneAndUpdate(
      { _id: deliveryId, status: "OPEN" },
      { status: "ASSIGNED", driverId: driverId },
      { new: true },
    );
    if (!delivery)
      return res.status(400).json({ error: "Delivery unavailable" });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Complete Delivery (unchanged)
router.post("/complete", async (req, res) => {
  try {
    const { deliveryId, driverId } = req.body;
    const delivery = await Delivery.findOneAndUpdate(
      {
        _id: deliveryId,
        driverId,
        status: { $in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      { status: "DELIVERED" },
      { new: true },
    );

    if (!delivery) return res.status(400).json({ error: "Cannot complete" });

    const user = await User.findById(driverId);
    user.driverStats.deliveriesCompleted += 1;
    user.driverStats.earnings += delivery.payout;
    await user.save();

    res.json({ success: true, delivery, stats: user.driverStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
