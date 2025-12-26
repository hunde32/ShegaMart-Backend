require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const verifyRoutes = require("./routes/verify"); // We will create this next

const app = express();

// Middleware
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json());

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.use("/api", verifyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
