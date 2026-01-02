const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Import Routes
const verifyRoutes = require("./routes/verify");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");
const locationRoutes = require("./routes/location");
const adminRoutes = require("./routes/admin"); // NEW
const driverRoutes = require("./routes/driver"); // NEW
const orderRoutes = require("./routes/orders");
const app = express();

app.use(cors());
app.use(express.json());

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Register Routes
app.use("/api/verify", verifyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/admin", adminRoutes); // NEW
app.use("/api/driver", driverRoutes); // NEW
app.use("/api/orders", orderRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
