const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const User = require("../models/User");

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const verificationUpload = upload.fields([
  { name: "selfie", maxCount: 1 },
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
]);

// Initialize with the modern SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to format images for the new SDK
// 1. Updated Helper: The new SDK requires the "inlineData" wrapper
const fileToPart = (file) => ({
  inlineData: {
    data: file.buffer.toString("base64"),
    mimeType: file.mimetype, // Note: mimeType (camelCase) is required here
  },
});

router.post("/verify-identity", verificationUpload, async (req, res) => {
  try {
    const { userId, idType } = req.body;

    if (
      !req.files ||
      !req.files.selfie ||
      !req.files.idFront ||
      !req.files.idBack
    ) {
      return res
        .status(400)
        .json({ success: false, reason: "Missing required photos." });
    }

    // 2. Prepare the parts correctly
    const promptPart = {
      text: `
Act as a strict Identity Verification Officer specializing in ETHIOPIAN documents.
      User claims ID Type: ${idType}. Today's date is December 2025 (Gregorian).
        
      IMPORTANT DETAILL: DO NOT REJECT THE VERIFICATION BECAUSE OF ANOTHER FLAG.
      REGIONAL KNOWLEDGE BASE:
      1. FLAGS: If you see a Red-White-Black tricolor, it is likely an Oromia regional flag or a variation of an Ethiopian regional ID. It is NOT the Iraqi flag.
      2. SYMBOLS: A tree (Sycamore/Odaa) on a flag confirms it is an Oromia Regional ID.
          - If u see any flag that look a forign flag first consider will it look like an Ethiopia reginal flag if it does Don't reject them
      3. CALENDAR: Many Ethiopia ID use Both G.C and E.C. If u see something like "jan 12, 2002" or "12/NOV/1994" it is a G.C, E.C will be mostly numrical like "11/10/2022".
         - If beside of the DATE is Ge'ez (Amharic) or any other Ethiopia language it is Mostly E.C, but if infornt of Ge'ez (Amharic) is "11/NOV/1992" OR "sep 13, 1994" it will be still G.C
         - Current Year: 2025 G.C. = 2018 E.C.
         - If there is a future date on the ID it is Probobley a Expration date so don't reject them
      4. SCRIPT: Documents will contain Ge'ez (Amharic) script.

      TASKS:
      1. Analyze the ID. Check for "Date of Birth" and "Expiry Date". Convert E.C. to G.C. to verify if the user is an adult (>18).
      2. Match the face in the Selfie with the photo on the ID.
      3. Check for forgery or digital manipulation.
      

    
      Return ONLY JSON:
      { 
        "approved": boolean, 
        "reason": "string (Briefly explain conversion logic if E.C. was used)",
        "detected_info": { "calendar_used": "E.C. or G.C.", "region": "string" }
      }    `,
    };

    const selfiePart = fileToPart(req.files.selfie[0]);
    const idFrontPart = fileToPart(req.files.idFront[0]);
    const idBackPart = fileToPart(req.files.idBack[0]);

    // 3. Updated API Call for Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [promptPart, selfiePart, idFrontPart, idBackPart],
        },
      ],
    });

    // 4. Extract text from the new response format
    const resultText = response.text;
    const verificationResult = JSON.parse(
      resultText.replace(/```json|```/g, "").trim(),
    );

    if (verificationResult.approved && userId) {
      await User.findOneAndUpdate({ _id: userId }, { isVerified: true });
    }

    res.json(verificationResult);
  } catch (error) {
    console.error("Verification Error:", error);
    res
      .status(500)
      .json({ success: false, reason: "AI service error. Please try again." });
  }
});
module.exports = router;
