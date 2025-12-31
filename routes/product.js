const express = require("express");
const router = express.Router();
const { GoogleGenAI } = require("@google/genai");

// Initialize Gemini (Backend side)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    res.json({ description: response.text });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to generate description" });
  }
});

module.exports = router;
