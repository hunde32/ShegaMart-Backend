const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store hashed password
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    role: { type: String, default: "BUYER" }, // BUYER, SELLER, ADMIN
    isVerified: { type: Boolean, default: false },

    // Location & Address
    location: {
      lat: Number,
      lng: Number,
    },
    addressDetails: {
      type: { type: String, enum: ["house", "apartment"], default: "house" },
      number: String,
    },

    // The custom Shega ID (Generated once at registration)
    shegaId: { type: String, unique: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
