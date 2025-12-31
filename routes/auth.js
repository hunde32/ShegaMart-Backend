const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Helper: DJB2 Hash logic for Shega ID (Moved from Frontend to Backend)
const generateShegaId = (firstName, lastName, doorNumber) => {
  const seedString =
    `${firstName}${lastName}${doorNumber || "0"}`.toUpperCase();
  let hash = 5381;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) + hash + seedString.charCodeAt(i);
  }
  return Math.abs(hash).toString();
};

// REGISTER
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

    // 1. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Generate Shega ID
    const shegaId = generateShegaId(
      firstName,
      lastName,
      addressDetails?.number,
    );

    // 4. Create User
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

    // 5. Create Token
    const token = jwt.sign(
      { id: savedUser._id },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" },
    );

    // Return user info (excluding password)
    const { password: _, ...userData } = savedUser._doc;
    res.status(201).json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find User
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 2. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    // 3. Create Token
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
