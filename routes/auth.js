const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");

// --- CONFIGURATION ---
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;

// --- NODEMAILER CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// --- GOOGLE LOGIN (Trusted - Auto Verified) ---
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
        isEmailVerified: true, // Google users are trusted automatically
        shegaId: generatedShegaId,
        location: { lat: 9.005401, lng: 38.763611 },
        addressDetails: { type: "house", number: "" },
      });
      await user.save();
    } else {
      if (!user.googleId) {
        user.googleId = sub;
        user.isEmailVerified = true; // Trust Google
        await user.save();
      }
    }

    const appToken = jwt.sign({ id: user._id }, BETTER_AUTH_SECRET, {
      expiresIn: "7d",
    });
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

    const decoded = jwt.verify(token, BETTER_AUTH_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// --- UPDATE PROFILE ROUTE ---
router.put("/update-profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, BETTER_AUTH_SECRET);

    const { phone, addressDetails, firstName, lastName } = req.body;

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

// --- SEND REAL VERIFICATION EMAIL (Using Nodemailer) ---
router.post("/send-verification", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, BETTER_AUTH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isEmailVerified)
      return res.status(400).json({ message: "Already verified" });

    // Double check: if user is Google user, they shouldn't verify
    if (user.googleId) {
      user.isEmailVerified = true;
      await user.save();
      return res
        .status(400)
        .json({ message: "Google accounts are automatically verified." });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to DB
    user.emailVerificationToken = code;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send Email via Nodemailer
    const mailOptions = {
      from: '"ShegaMart Security" <shegamart.com@gmail.com>',
      to: user.email,
      subject: "Your Verification Code - ShegaMart",
      html: `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #333;">Welcome to ShegaMart!</h2>
          <p>Please confirm your email address to unlock full features.</p>
          <div style="margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563EB; background: #EFF6FF; padding: 10px 20px; border-radius: 8px;">
              ${code}
            </span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 1 hour.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Verification code sent to your email!" });
  } catch (err) {
    console.error("Email Sending Error:", err);
    res.status(500).json({ error: "Failed to send email. Try again later." });
  }
});

// --- VERIFY EMAIL CODE ---
router.post("/verify-email", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { code } = req.body;

    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, BETTER_AUTH_SECRET);

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

// --- REGISTER (Manual) ---
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
      isEmailVerified: false, // Explicitly false for manual register
    });

    const savedUser = await newUser.save();

    // Use Better Auth Secret
    const token = jwt.sign({ id: savedUser._id }, BETTER_AUTH_SECRET, {
      expiresIn: "7d",
    });

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

    const token = jwt.sign({ id: user._id }, BETTER_AUTH_SECRET, {
      expiresIn: "7d",
    });
    const { password: _, ...userData } = user._doc;
    res.json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
