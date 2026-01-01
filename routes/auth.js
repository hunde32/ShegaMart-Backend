const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
// const nodemailer = require("nodemailer"); // Uncomment if using real email

// --- CONFIG ---
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "ER39a0hUG4KaSTzNKJP6pLsHBnydtzNU";

// Helper: DJB2 Hash logic for Shega ID
const generateShegaId = (firstName, lastName, doorNumber) => {
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

// --- GOOGLE LOGIN ---
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!googleResponse.ok) throw new Error("Failed to fetch user data");
    const googleUser = await googleResponse.json();
    const { email, sub, given_name, family_name } = googleUser;

    let user = await User.findOne({ email });

    if (!user) {
      const generatedShegaId = generateShegaId(
        given_name || "User",
        family_name || "Name",
        "0",
      );
      user = new User({
        firstName: given_name || "User",
        lastName: family_name || "Name",
        email,
        googleId: sub,
        role: "BUYER",
        isVerified: false,
        isEmailVerified: true, // Google emails are trusted automatically
        shegaId: generatedShegaId,
        location: { lat: 9.005401, lng: 38.763611 },
        addressDetails: { type: "house", number: "" }, // Explicitly empty
      });
      await user.save();
    } else {
      if (!user.googleId) {
        user.googleId = sub;
        user.isEmailVerified = true; // Trust Google
        await user.save();
      }
    }

    const appToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" },
    );
    const { password: _, ...userData } = user._doc;
    res.json({ token: appToken, user: userData });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// --- ME ROUTE ---
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

// --- NEW: UPDATE PROFILE ROUTE ---
router.put("/update-profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");

    const { phone, addressDetails, firstName, lastName } = req.body;

    // Build update object
    const updateData = {};
    if (phone) updateData.phone = phone;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (addressDetails) {
      updateData.addressDetails = addressDetails;
    }

    const user = await User.findByIdAndUpdate(
      decoded.id,
      { $set: updateData },
      { new: true },
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// --- NEW: SEND EMAIL VERIFICATION CODE ---
router.post("/send-verification", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isEmailVerified)
      return res.status(400).json({ message: "Already verified" });

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    user.emailVerificationToken = code;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // MOCK EMAIL SENDING (Check your server console)
    console.log(
      `[Better Auth Mock] Code for ${user.email}: ${code} (Secret: ${BETTER_AUTH_SECRET.substring(0, 5)}...)`,
    );

    // If you had nodemailer, you would send it here.

    res.json({
      message: "Verification code sent (Check console)",
      debugCode: code,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: VERIFY EMAIL CODE ---
router.post("/verify-email", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { code } = req.body;

    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isEmailVerified)
      return res.json({ success: true, message: "Already verified" });

    if (
      user.emailVerificationToken !== code ||
      user.emailVerificationExpires < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const { password: _, ...userData } = user._doc;
    res.json({ success: true, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REGISTER ---
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

    const doorNum = addressDetails?.number || "";
    const shegaId = generateShegaId(firstName, lastName, doorNum);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      location,
      addressDetails: { ...addressDetails, number: doorNum },
      shegaId,
      role: "BUYER",
      isEmailVerified: false,
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

// --- LOGIN ---
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
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
