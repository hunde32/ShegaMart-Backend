const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { GoogleGenAI } = require("@google/genai");

// 1. Cloudinary Config (Reusing your existing env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shegamart_products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage: storage });

// 2. Product Schema
const productSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  imageUrl: String, // This will now store the permanent Cloudinary URL
  createdAt: { type: Date, default: Date.now },
});

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 3. GET ALL PRODUCTS
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// 4. ADD PRODUCT (Now handles Image Upload)
router.post("/add", upload.single("image"), async (req, res) => {
  try {
    const { sellerId, title, category, price, description } = req.body;

    // Get the secure URL from Cloudinary
    const imageUrl = req.file
      ? req.file.path
      : "https://via.placeholder.com/400";

    const newProduct = new Product({
      sellerId,
      title,
      category,
      price: Number(price),
      description,
      imageUrl,
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("Add Product Error:", err);
    res.status(500).json({ error: "Failed to save product" });
  }
});

// 5. AI DESCRIPTION
router.post("/generate-description", async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title || !category)
      return res.status(400).json({ error: "Missing fields" });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write a catchy, short, and professional product description for a verified listing on ShegaMart. 
      Product Title: ${title}
      Category: ${category}
      Keep it under 50 words. Focus on sales.`,
    });

    res.json({ description: response.text() });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to generate description" });
  }
});

module.exports = router;
