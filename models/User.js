const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for Google users
    googleId: { type: String, unique: true, sparse: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    role: { type: String, default: "BUYER" },

    // Identity Verification (ID Card)
    isVerified: { type: Boolean, default: false },

    // Email Verification (New)
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // Location & Address
    location: {
      lat: Number,
      lng: Number,
    },
    addressDetails: {
      type: { type: String, enum: ["house", "apartment"], default: "house" },
      number: { type: String, default: "" }, // Default empty to detect missing info later
    },

    shegaId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
