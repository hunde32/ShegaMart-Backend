const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const Admin = require("../models/Admin");
const User = require("../models/User");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware: Strictly Verify Admin Token
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.BETTER_AUTH_SECRET);
    // CRITICAL SECURITY: Check the token payload for isAdmin flag
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Not an Admin" });
    }
    req.adminId = decoded.id;
    next();
  } catch (e) {
    res.status(403).json({ message: "Invalid Admin Token" });
  }
};

// 1. Admin Login (Secure)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Only check Database. No hardcoded emails.
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid Credentials" });

    // Sign Token with isAdmin: true
    const token = jwt.sign(
      { id: admin._id, email: admin.email, isAdmin: true, role: admin.role },
      process.env.BETTER_AUTH_SECRET,
      { expiresIn: "2h" },
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Pending Drivers (With Signed URLs)
router.get("/drivers/pending", verifyAdmin, async (req, res) => {
  try {
    const drivers = await User.find({ driverStatus: "PENDING" }).lean();

    // Generate Temporary Signed URLs for the admin to view images
    const driversWithSignedUrls = drivers.map((driver) => {
      const signUrl = (publicId) => {
        if (!publicId) return null;
        // If it's already a full URL (legacy), return it, otherwise sign it
        if (publicId.startsWith("http")) return publicId;
        return cloudinary.url(publicId, {
          secure: true,
          sign_url: true,
          type: "private", // Access private images
          expires_at: Math.floor(Date.now() / 1000) + 300, // 5 minutes validity
        });
      };

      return {
        ...driver,
        driverDocs: {
          selfieUrl: signUrl(driver.driverDocs?.selfieUrl),
          idFrontUrl: signUrl(driver.driverDocs?.idFrontUrl),
          idBackUrl: signUrl(driver.driverDocs?.idBackUrl),
        },
      };
    });

    res.json(driversWithSignedUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/check-access", async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });
    if (admin) {
      return res.json({ isAdmin: true });
    } else {
      return res.status(404).json({ isAdmin: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/check-access", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ isAdmin: false });

    // Check if this email exists in the Admin collection
    const admin = await Admin.findOne({ email });

    if (admin) {
      return res.json({ isAdmin: true });
    } else {
      return res.json({ isAdmin: false });
    }
  } catch (err) {
    console.error("Access Check Error:", err);
    res.status(500).json({ error: err.message });
  }
});
// 3. Approve/Reject Driver
router.post("/drivers/verify", verifyAdmin, async (req, res) => {
  try {
    const { userId, approved } = req.body;
    const status = approved ? "APPROVED" : "REJECTED";
    const update = { driverStatus: status };
    if (approved) update.role = "DRIVER";

    const user = await User.findByIdAndUpdate(userId, update, { new: true });

    // Optional: Delete images from Cloudinary after processing to save space/privacy
    // if (user.driverDocs) { ... delete logic ... }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
