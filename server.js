const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const stringSimilarity = require("string-similarity");

const app = express();
app.use(cors());
app.use(express.json());
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

// 📁 File upload setup
const upload = multer({ dest: "uploads/" });

// 📦 Load data
const drugs = require("./drugs.json");
const interactions = require("./data.json");

// ==============================
// 🔍 CHECK INTERACTION (manual)
// ==============================
app.post("/check", (req, res) => {
  const { drug1, drug2 } = req.body;

  const d1 = drug1.toLowerCase().trim();
  const d2 = drug2.toLowerCase().trim();

  const found = interactions.find(d => {
    const drug1 = d.drug1.toLowerCase().trim();
    const drug2 = d.drug2.toLowerCase().trim();

    return (
      (drug1 === d1 && drug2 === d2) ||
      (drug1 === d2 && drug2 === d1)
    );
  });

  if (found) {
    res.json(found);
  } else {
    res.json({
      risk: "SAFE",
      explanation: "No known interaction found."
    });
  }
});

// ==============================
// 🔎 SEARCH DRUG INFO
// ==============================
app.get("/drug/:name", (req, res) => {
  const name = req.params.name.toLowerCase().trim();

  const drug = drugs.find(d =>
    d.name && d.name.toLowerCase() === name
  );

  if (!drug) {
    return res.json({ error: "Drug not found" });
  }

  res.json(drug);
});

// ==============================
// 📸 OCR SCAN + INTERACTION
// ==============================
app.post("/scan", upload.single("image"), async (req, res) => {
  console.log("FILE RECEIVED:", req.file);

  try {
    if (!req.file) {
      return res.json({ error: "No file uploaded" });
    }

    let result;

    try {
      result = await Tesseract.recognize(req.file.path, "eng");
    } catch (e) {
      console.error("TESSERACT FAILED:", e);
      return res.json({ error: "OCR engine failed" });
    }

    let text = result.data.text.toLowerCase();
    console.log("OCR TEXT:", text);

    // ✅ Clean text
    text = text.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

    // ✅ Split into words
    const words = text
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2);

    console.log("WORDS:", words);

    let detected = [];

    // ==============================
    // 🔍 DETECT DRUGS
    // ==============================
    drugs.forEach(d => {
      if (!d || !d.name) return;

      const name = d.name.toLowerCase().trim();

      // exact match
      if (words.includes(name)) {
        detected.push(name);
        return;
      }

      // fuzzy match
      for (let word of words) {
        const similarity = stringSimilarity.compareTwoStrings(word, name);
        if (similarity > 0.6) {
          detected.push(name);
          break;
        }
      }
    });

    detected = [...new Set(detected)];
    console.log("DETECTED DRUGS:", detected);

    // ==============================
    // 🛡 SAFETY DETECTION (fallback)
    // ==============================
    drugs.forEach(d => {
      if (!d || !d.name) return;

      const name = d.name.toLowerCase();

      if (text.includes(name) && !detected.includes(name)) {
        detected.push(name);
      }
    });

    detected = [...new Set(detected)];
    console.log("FINAL DETECTED:", detected);

    // ==============================
    // ⚠️ FIND INTERACTIONS
    // ==============================
    let interactionsFound = [];

    for (let i = 0; i < detected.length; i++) {
      for (let j = i + 1; j < detected.length; j++) {

        const d1 = detected[i];
        const d2 = detected[j];

        console.log("CHECKING PAIR:", d1, "+", d2);

        const found = interactions.find(d => {
          if (!d.drug1 || !d.drug2) return false;

          const drug1 = d.drug1.toLowerCase().trim();
          const drug2 = d.drug2.toLowerCase().trim();

          return (
            (drug1 === d1 && drug2 === d2) ||
            (drug1 === d2 && drug2 === d1)
          );
        });

        if (found) {
          console.log("MATCH FOUND:", d1, "+", d2);

          interactionsFound.push({
            pair: d1 + " + " + d2,
            risk: found.risk,
            explanation: found.explanation
          });
        }
      }
    }

    // ==============================
    // 📤 RESPONSE
    // ==============================
    res.json({
      detected,
      interactions: interactionsFound
    });

  } catch (err) {
    console.error("OCR ERROR:", err);
    res.json({ error: "OCR failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Medisafe API is running");
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});