const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    // Password is now optional because Google users won't have one
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true }, // sparse allows multiple nulls
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    role: { type: String, default: "BUYER" },
    isVerified: { type: Boolean, default: false },

    // Location & Address (Optional initially for Google users)
    location: {
      lat: Number,
      lng: Number,
    },
    addressDetails: {
      type: { type: String, enum: ["house", "apartment"], default: "house" },
      number: String,
    },

    shegaId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
