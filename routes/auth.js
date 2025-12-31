const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// You technically don't need the google-auth-library for this specific method,
// but we will use standard fetch to get user info.

// Helper: DJB2 Hash logic for Shega ID
// Helper: DJB2 Hash logic for Shega ID
const generateShegaId = (firstName, lastName, doorNumber) => {
  // This ensures the ID is unique every time, even for users with the same name.
  const uniqueEntropy =
    Date.now().toString() + Math.floor(Math.random() * 1000);

  const seedString =
    `${firstName}${lastName}${doorNumber || "0"}${uniqueEntropy}`.toUpperCase();

  let hash = 5381;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) + hash + seedString.charCodeAt(i);
  }
  return Math.abs(hash).toString();
};

// --- GOOGLE LOGIN (FIXED) ---
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body; // This is the Access Token (ya29...)

    // 1. Use the Access Token to get User Info from Google
    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!googleResponse.ok) {
      throw new Error("Failed to fetch user data from Google");
    }

    const googleUser = await googleResponse.json();

    // googleUser contains: { sub, name, given_name, family_name, email, picture, ... }
    const { email, sub, given_name, family_name } = googleUser;

    // 2. Check if user exists in our DB
    let user = await User.findOne({ email });

    if (!user) {
      // --- FIX: Generate ShegaID and Default Location for Google Users ---
      const generatedShegaId = generateShegaId(
        given_name || "User",
        family_name || "Name",
        "0", // Default door number for Google signups
      );

      // 3. If not, create a new user with ALL required fields
      user = new User({
        firstName: given_name || "User",
        lastName: family_name || "Name",
        email,
        googleId: sub,
        role: "BUYER",
        isVerified: false,
        shegaId: generatedShegaId, // <--- Fixes Duplicate Key Error
        location: {
          // <--- Fixes Map Crash (Default: Addis Ababa)
          lat: 9.005401,
          lng: 38.763611,
        },
        addressDetails: {
          type: "house",
          number: "Pending", // User can update this later
        },
      });
      await user.save();
    } else {
      // If user exists but doesn't have googleId linked, link it now
      if (!user.googleId) {
        user.googleId = sub;
        await user.save();
      }
    }

    // 4. Generate App Token (JWT) for your website
    const appToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" },
    );

    // 5. Send back the token and user data
    const { password: _, ...userData } = user._doc;
    res.json({ token: appToken, user: userData });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// --- ME ROUTE (For Page Refresh / Remember Me) ---
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// --- REGISTER (Standard Email/Pass) ---
router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      location,
      addressDetails,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const shegaId = generateShegaId(
      firstName,
      lastName,
      addressDetails?.number,
    );

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      location,
      addressDetails,
      shegaId,
      role: "BUYER",
    });

    const savedUser = await newUser.save();
    const token = jwt.sign(
      { id: savedUser._id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" },
    );

    const { password: _, ...userData } = savedUser._doc;
    res.status(201).json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOGIN (Standard Email/Pass) ---
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Google users might not have a password
    if (!user.password)
      return res.status(400).json({ message: "Please login with Google" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" },
    );

    const { password: _, ...userData } = user._doc;
    res.json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
