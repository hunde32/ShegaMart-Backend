const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    pickupLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    dropoffLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "CANCELLED"],
      default: "OPEN",
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    payout: { type: Number, required: true }, // Earnings for the driver
    type: { type: String, enum: ["GIG", "FULLTIME"], default: "GIG" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Delivery", deliverySchema);
