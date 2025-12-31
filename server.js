const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Import Routes
const verifyRoutes = require("./routes/verify"); // Your existing verification file
const authRoutes = require("./routes/auth"); // New Auth
const productRoutes = require("./routes/product"); // New Product AI
const locationRoutes = require("./routes/location");
const app = express();

app.use(cors());
app.use(express.json());

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Register Routes
app.use("/api/verify", verifyRoutes); // Note: Changed to /api/verify to keep it clean (Update your frontend fetch url!)
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/location", locationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
