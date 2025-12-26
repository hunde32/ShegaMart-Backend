const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  isVerified: { type: Boolean, default: false },
  // You can add more fields here as needed
});

module.exports = mongoose.model("User", userSchema);
