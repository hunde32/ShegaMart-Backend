const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    role: { type: String, default: "BUYER" },

    // Identity Verification
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // Location
    location: {
      lat: Number,
      lng: Number,
    },
    addressDetails: {
      type: { type: String, enum: ["house", "apartment"], default: "house" },
      number: { type: String, default: "" },
    },

    shegaId: { type: String, unique: true, sparse: true },

    // --- DRIVER SPECIFIC FIELDS ---
    driverStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    driverType: { type: String, enum: ["GIG", "FULLTIME"] },
    driverStats: {
      deliveriesCompleted: { type: Number, default: 0 },
      earnings: { type: Number, default: 0 },
    },
    // FIXED: Added correct fields for Front/Back IDs
    driverDocs: {
      selfieUrl: String,
      idFrontUrl: String, // Was missing in previous schema
      idBackUrl: String, // Was missing in previous schema
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
